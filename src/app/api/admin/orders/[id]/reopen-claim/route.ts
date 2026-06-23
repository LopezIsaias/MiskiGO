import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES, CLAIM_WINDOW_HOURS } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

const bodySchema = z.object({
  reason: z.string().min(1, 'Se requiere un motivo'),
})

// POST: el superadmin reabre el plazo de reclamo de un pedido entregado cuya
// ventana ya venció (CLAIM_WINDOW_HOURS §4). Reextiende claim_window_expires_at
// a now + CLAIM_WINDOW_HOURS y, si el pedido ya estaba 'completed' (cerrado por
// el cron al vencer la ventana), lo regresa a 'delivered' para volver a permitir
// reclamos. Acción exclusiva de superadmin y auditada (§4/§8).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'superadmin' || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Motivo requerido' }, { status: 422 })
  }
  const { reason } = parsed.data

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, customer_id, delivered_at, claim_window_expires_at')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  // Solo pedidos ya entregados (delivered o cerrados a completed) pueden reabrir reclamos.
  if (!order.delivered_at || !['delivered', 'completed'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Solo se puede reabrir el plazo de un pedido entregado' },
      { status: 409 },
    )
  }

  const now = new Date()
  const newExpiry = new Date(now.getTime() + CLAIM_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { error: updateErr } = await adminClient
    .from('orders')
    .update({ status: 'delivered', claim_window_expires_at: newExpiry })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[reopen-claim] order update failed:', updateErr.message)
    return NextResponse.json({ error: 'Error al reabrir el plazo' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id:        user.id,
    role_at_time:   profile!.role,
    action:         AUDIT_ACTIONS.CLAIM_WINDOW_REOPENED,
    module:         AUDIT_MODULES.CLAIMS,
    entity_type:    'order',
    entity_id:      orderId,
    previous_value: { status: order.status, claim_window_expires_at: order.claim_window_expires_at },
    new_value:      { order_id: orderId, status: 'delivered', claim_window_expires_at: newExpiry },
    notes:          reason,
  })

  await adminClient.from('notifications').insert({
    recipient_id:   order.customer_id,
    type:           'claim_window_reopened',
    channel:        'in_app',
    title:          'Plazo de reclamo reabierto',
    body:           `Reabrimos el plazo para reportar inconvenientes en tu pedido #${orderId.slice(0, 8).toUpperCase()}. Tienes hasta las ${formatTime(newExpiry)} para hacerlo desde la app.`,
    reference_type: 'order',
    reference_id:   orderId,
    status:         'sent',
    sent_at:        now.toISOString(),
  })

  return NextResponse.json({ success: true, claimWindowExpiresAt: newExpiry })
}

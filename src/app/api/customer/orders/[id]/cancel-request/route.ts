import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  if (profile?.role !== 'customer' || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const adminClient = createAdminClient()

  // Solo se puede solicitar mientras esté 'confirmed' (pagado, aún no asignado).
  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, cancellation_requested_at')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Solo puedes solicitar cancelación mientras el pedido esté confirmado y sin asignar' },
      { status: 409 }
    )
  }
  if (order.cancellation_requested_at) {
    return NextResponse.json({ error: 'Ya solicitaste la cancelación de este pedido' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const reason = parsed.data.reason ?? null

  const { error: updateErr } = await adminClient
    .from('orders')
    .update({
      cancellation_requested_at: now as never,
      cancellation_reason: reason as never,
    })
    .eq('id', orderId)

  if (updateErr) {
    return NextResponse.json({ error: 'No se pudo registrar la solicitud' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id:       user.id,
    role_at_time:  'customer',
    action:        AUDIT_ACTIONS.ORDER_CANCELLATION_REQUESTED,
    module:        AUDIT_MODULES.ORDERS,
    entity_type:   'order',
    entity_id:     orderId,
    new_value:     { cancellation_requested_at: now, reason },
  })

  // Avisar a operadores para revisión y reembolso manual
  const { data: operators } = await adminClient
    .from('users')
    .select('id')
    .in('role', ['operator', 'superadmin'])
    .eq('status', 'active')
    .limit(5)

  if (operators && operators.length > 0) {
    await adminClient.from('notifications').insert(
      operators.map((op: { id: string }) => ({
        recipient_id:   op.id,
        type:           'order_cancellation_requested',
        channel:        'in_app',
        title:          'Solicitud de cancelación de pedido',
        body:           `El cliente solicitó cancelar el pedido #${orderId.slice(0, 8).toUpperCase()}. Revisa y procesa el reembolso manualmente.`,
        reference_type: 'order',
        reference_id:   orderId,
        status:         'sent',
        sent_at:        now,
      }))
    )
  }

  return NextResponse.json({ success: true })
}

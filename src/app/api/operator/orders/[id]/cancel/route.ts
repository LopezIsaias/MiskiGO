import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const cancelSchema = z.object({
  reason: z.string().min(1, 'Se requiere un motivo'),
})

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

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Motivo requerido' }, { status: 422 })
  const { reason } = parsed.data

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, customer_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  // Solo antes de que el pedido sea asignado a un repartidor (CLAUDE.md §4).
  if (!['confirmed', 'payment_submitted'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Solo se puede cancelar antes de asignar el pedido' },
      { status: 409 }
    )
  }

  // Liberar stock reservado (asignaciones pendientes y confirmadas)
  const { data: orderItemsData } = await adminClient
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)

  for (const oi of orderItemsData ?? []) {
    const { data: assignments } = await adminClient
      .from('order_item_assignments')
      .select('id, publication_id, assigned_quantity, status')
      .eq('order_item_id', oi.id)
      .in('status', ['pending', 'confirmed'])

    for (const asg of assignments ?? []) {
      const { data: pub } = await adminClient
        .from('supplier_publications')
        .select('id, status, available_quantity')
        .eq('id', asg.publication_id)
        .maybeSingle()

      if (pub) {
        if (pub.status === 'fulfilled') {
          await adminClient
            .from('supplier_publications')
            .update({ status: 'active' })
            .eq('id', pub.id)
        } else if (pub.status === 'active') {
          const restored = Math.round((pub.available_quantity + asg.assigned_quantity) * 1000) / 1000
          await adminClient
            .from('supplier_publications')
            .update({ available_quantity: restored })
            .eq('id', pub.id)
        }
      }

      await adminClient
        .from('order_item_assignments')
        .update({ status: 'failed', failure_reason: `Pedido cancelado: ${reason}` })
        .eq('id', asg.id)
    }
  }

  await adminClient
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)

  // El reembolso es MANUAL (decisión de negocio): el operador lo procesa por
  // el módulo de billetera o por el medio original. Aquí no se mueve dinero.
  await adminClient.from('audit_log').insert({
    user_id:        user.id,
    role_at_time:   profile!.role,
    action:         AUDIT_ACTIONS.ORDER_CANCELLED_POST_PAYMENT,
    module:         AUDIT_MODULES.ORDERS,
    entity_type:    'order',
    entity_id:      orderId,
    previous_value: { status: order.status },
    new_value:      { status: 'cancelled', refund: 'manual' },
    notes:          reason,
  })

  // Notificar al cliente
  await adminClient.from('notifications').insert({
    recipient_id:   order.customer_id,
    type:           'order_cancelled',
    channel:        'in_app',
    title:          'Pedido cancelado',
    body:           `Tu pedido #${orderId.slice(0, 8).toUpperCase()} fue cancelado. Procesaremos tu reembolso a la brevedad.`,
    reference_type: 'order',
    reference_id:   orderId,
    status:         'sent',
    sent_at:        new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { formatTime } from '@/lib/utils'

const bodySchema = z.object({
  routeId:          z.string().uuid().nullable().optional(),
  confirmationCode: z.string().length(6, 'El código debe tener 6 dígitos'),
})

export async function PATCH(
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

  if (!['delivery', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { body = {} }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const { routeId, confirmationCode } = parsed.data

  const adminClient = createAdminClient()
  const now = new Date()
  const nowISO = now.toISOString()
  const claimExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const { data: rawOrder } = await adminClient
    .from('orders')
    .select('id, status, customer_id, delivery_confirmation_code')
    .eq('id', orderId)
    .in('status', ['in_transit', 'assigned'])
    .maybeSingle()

  const order = rawOrder as unknown as { id: string; status: string; customer_id: string; delivery_confirmation_code: string | null } | null

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado o no en tránsito' }, { status: 404 })
  }

  // Validate confirmation code
  if (order.delivery_confirmation_code !== confirmationCode) {
    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.DELIVERY_CODE_FAILED,
      module:       AUDIT_MODULES.DELIVERIES,
      entity_type:  'order',
      entity_id:    orderId,
      new_value:    { attempted_code: confirmationCode },
    })
    return NextResponse.json({ error: 'Código incorrecto. Verifica con el cliente.' }, { status: 422 })
  }

  await adminClient.from('orders').update({
    status:                  'delivered',
    delivered_at:            nowISO,
    claim_window_expires_at: claimExpiry,
  }).eq('id', orderId)

  if (routeId) {
    await adminClient
      .from('delivery_stops')
      .update({ status: 'delivered', completed_at: nowISO })
      .eq('route_id', routeId)
      .eq('order_id', orderId)
  }

  // Notification text from CLAUDE.md (exact wording)
  const expiryTime = formatTime(claimExpiry)
  const notifBody =
    `🌱 ¡Tu pedido ha llegado! Esperamos que estés disfrutando productos frescos directo del campo.\n` +
    `Si notas algún inconveniente, tienes hasta las ${expiryTime} para reportarlo desde la app.\n` +
    `Después de ese plazo no podremos procesar cambios en este pedido.\n` +
    `¡Gracias por confiar en Miski GO! 🙌`

  await adminClient.from('notifications').insert({
    recipient_id:   order.customer_id,
    type:           'delivery_notification',
    channel:        'in_app',
    title:          '¡Tu pedido ha llegado!',
    body:           notifBody,
    reference_type: 'order',
    reference_id:   orderId,
    status:         'sent',
    sent_at:        nowISO,
  })

  await adminClient.from('audit_log').insert({
    user_id:       user.id,
    role_at_time:  profile!.role,
    action:        AUDIT_ACTIONS.ORDER_DELIVERED,
    module:        AUDIT_MODULES.DELIVERIES,
    entity_type:   'order',
    entity_id:     orderId,
    new_value: {
      delivered_at:            nowISO,
      claim_window_expires_at: claimExpiry,
    },
  })

  return NextResponse.json({ success: true, deliveredAt: nowISO, claimWindowExpiresAt: claimExpiry })
}

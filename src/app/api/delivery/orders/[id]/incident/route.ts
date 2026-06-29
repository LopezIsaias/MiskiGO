import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.object({
  routeId:  z.string().uuid().nullable().optional(),
  reason:   z.string().min(1, 'El motivo de la incidencia es obligatorio'),
  photoUrl: z.string().url().optional(),
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
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const { routeId, reason, photoUrl } = parsed.data

  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  const { data: rawIncidentOrder } = await adminClient
    .from('orders')
    .select('id, status, delivery_attempts')
    .eq('id', orderId)
    .in('status', ['in_transit', 'assigned'])
    .maybeSingle()

  const order = rawIncidentOrder as unknown as { id: string; status: string; delivery_attempts: number | null } | null

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado o no en estado válido' }, { status: 404 })
  }

  const currentAttempts: number = order.delivery_attempts ?? 0
  const isSecondAttempt = currentAttempts >= 1

  if (isSecondAttempt && !photoUrl) {
    return NextResponse.json({ error: 'La foto es obligatoria en el segundo intento fallido.' }, { status: 422 })
  }

  if (isSecondAttempt) {
    // Second failed attempt → in_storage
    await adminClient
      .from('orders')
      .update({ status: 'in_storage', delivery_attempts: 2 as never })
      .eq('id', orderId)

    if (routeId) {
      await adminClient
        .from('delivery_stops')
        .update({ status: 'failed', failure_reason: reason, completed_at: now })
        .eq('route_id', routeId)
        .eq('order_id', orderId)
    }

    // Notify operators/superadmin
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
          type:           'delivery_in_storage',
          channel:        'in_app',
          title:          'Pedido en almacén',
          body:           `Pedido #${orderId.slice(0, 8).toUpperCase()} no pudo entregarse en 2 intentos y fue almacenado. Motivo: ${reason}`,
          reference_type: 'order',
          reference_id:   orderId,
          status:         'sent',
          sent_at:        now,
        }))
      )
    }

    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.ORDER_IN_STORAGE,
      module:       AUDIT_MODULES.DELIVERIES,
      entity_type:  'order',
      entity_id:    orderId,
      new_value:    { reason, photo_url: photoUrl ?? null, delivery_attempts: 2 },
    })
  } else {
    // First failed attempt → increment delivery_attempts to 1. El pedido sigue
    // 'in_transit' y la parada queda accionable: el repartidor puede reintentar
    // una vez más (entregar o reportar el 2do intento). No se marca 'failed' la
    // parada todavía — eso ocurre solo en el segundo intento (→ in_storage).
    await adminClient.from('orders').update({
      updated_at: now,
      delivery_attempts: 1 as never,
    }).eq('id', orderId)

    // Notify operators/superadmin
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
          type:           'delivery_incident',
          channel:        'in_app',
          title:          'Incidencia en entrega (1er intento)',
          body:           `Repartidor reportó incidencia en pedido #${orderId.slice(0, 8).toUpperCase()}: ${reason}`,
          reference_type: 'order',
          reference_id:   orderId,
          status:         'sent',
          sent_at:        now,
        }))
      )
    }

    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.DELIVERY_INCIDENT,
      module:       AUDIT_MODULES.DELIVERIES,
      entity_type:  'order',
      entity_id:    orderId,
      new_value:    { reason, route_id: routeId ?? null, delivery_attempts: 1 },
    })
  }

  return NextResponse.json({ success: true, isInStorage: isSecondAttempt })
}

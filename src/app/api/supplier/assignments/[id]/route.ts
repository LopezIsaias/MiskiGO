import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import {
  fetchReplacementCandidates,
  planReplacements,
  failOrderItemAllOrNothing,
  tryAdvanceOrderToAssigned,
} from '@/lib/utils/supplier-assignment'
import { decrementPublicationStock, restorePublicationStock } from '@/lib/utils/stock'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('fail'), reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres') }),
])

type AssignmentRow = {
  id: string
  supplier_id: string
  order_item_id: string
  publication_id: string
  assigned_quantity: number
  status: string
  order_item: {
    order_id: string
    unit_price_frozen: number
    product_id: string
  } | null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['supplier', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
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

  const adminClient = createAdminClient()
  const now = new Date().toISOString()
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local'

  // Fetch assignment — ensure it belongs to this supplier
  const { data: rawAssignment } = await adminClient
    .from('order_item_assignments')
    .select(`
      id, supplier_id, order_item_id, publication_id, assigned_quantity, status,
      order_item:order_items!order_item_id(order_id, unit_price_frozen, product_id)
    `)
    .eq('id', assignmentId)
    .eq('status', 'pending')
    .maybeSingle()

  const assignment = rawAssignment as unknown as AssignmentRow | null

  if (!assignment) {
    return NextResponse.json({ error: 'Asignación no encontrada o ya procesada' }, { status: 404 })
  }

  // Suppliers can only act on their own assignments
  if (profile?.role === 'supplier' && assignment.supplier_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (parsed.data.action === 'confirm') {
    const { error: confirmErr } = await adminClient
      .from('order_item_assignments')
      .update({ status: 'confirmed', confirmed_at: now })
      .eq('id', assignmentId)

    if (confirmErr) {
      console.error('[supplier/assignments/confirm] update failed:', confirmErr)
      return NextResponse.json({ error: 'Error al confirmar la asignación' }, { status: 500 })
    }

    const orderId = assignment.order_item?.order_id ?? null

    if (orderId) {
      // Resolver el ítem por COBERTURA DE CANTIDAD (no por "alguno confirmado").
      // El ítem solo se resuelve cuando ya no quedan asignaciones pending.
      const { data: itemAssignments } = await adminClient
        .from('order_item_assignments')
        .select('status, assigned_quantity')
        .eq('order_item_id', assignment.order_item_id)

      const { data: itemRow } = await adminClient
        .from('order_items')
        .select('quantity')
        .eq('id', assignment.order_item_id)
        .maybeSingle()

      const asgs = itemAssignments ?? []
      const anyPending = asgs.some(a => a.status === 'pending')

      if (!anyPending) {
        const confirmedQty = asgs
          .filter(a => a.status === 'confirmed')
          .reduce((s, a) => Math.round((s + Number(a.assigned_quantity)) * 1000) / 1000, 0)
        const itemQty = Number(itemRow?.quantity ?? 0)
        const covered = confirmedQty >= itemQty - 0.001

        if (covered) {
          await adminClient
            .from('order_items')
            .update({ status: 'assigned' })
            .eq('id', assignment.order_item_id)
        } else {
          // TODO-O-NADA: cobertura confirmada insuficiente y sin pendientes que la
          // completen → el ítem entero falla y se restaura/rollback de lo confirmado.
          await failOrderItemAllOrNothing(
            adminClient,
            assignment.order_item_id,
            'Cobertura parcial: ítem no alcanza la cantidad pedida (todo-o-nada)',
          )
        }

        await tryAdvanceOrderToAssigned(adminClient, orderId)
      }
    }

    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.SUPPLIER_CONFIRMED,
      module:       AUDIT_MODULES.SUPPLIERS,
      entity_type:  'order_item_assignment',
      entity_id:    assignmentId,
      ip_address:   ip,
      new_value:    { status: 'confirmed', order_item_id: assignment.order_item_id, order_id: orderId },
    })

    return NextResponse.json({ success: true })
  }

  // action === 'fail'
  const { reason } = parsed.data

  await adminClient
    .from('order_item_assignments')
    .update({ status: 'failed', failure_reason: reason })
    .eq('id', assignmentId)

  // Restaurar el stock que la publicación rechazada había cedido en checkout —
  // el proveedor no cumplirá, así que su stock vuelve al pool (coherente con
  // operator/orders/[id]/reject). Atómico vía RPC. Evita stock huérfano.
  await restorePublicationStock(adminClient, assignment.publication_id, assignment.assigned_quantity)

  await adminClient.from('audit_log').insert({
    user_id:      user.id,
    role_at_time: profile!.role,
    action:       AUDIT_ACTIONS.SUPPLIER_REJECTED,
    module:       AUDIT_MODULES.SUPPLIERS,
    entity_type:  'order_item_assignment',
    entity_id:    assignmentId,
    ip_address:   ip,
    new_value:    { status: 'failed', reason, order_item_id: assignment.order_item_id },
  })

  // Notify operators/superadmin to arrange a replacement
  const { data: operators } = await adminClient
    .from('users')
    .select('id')
    .in('role', ['operator', 'superadmin'])
    .eq('status', 'active')
    .limit(5)

  if (operators && operators.length > 0) {
    const orderId = assignment.order_item?.order_id
    await adminClient.from('notifications').insert(
      operators.map((op: { id: string }) => ({
        recipient_id:   op.id,
        type:           'supplier_rejected',
        channel:        'in_app',
        title:          'Proveedor no puede cumplir',
        body:           `Un proveedor rechazó su asignación${orderId ? ` en pedido #${orderId.slice(0, 8).toUpperCase()}` : ''}. Motivo: ${reason}`,
        reference_type: assignment.order_item?.order_id ? 'order' : 'order_item_assignment',
        reference_id:   assignment.order_item?.order_id ?? assignmentId,
        status:         'sent',
        sent_at:        now,
      }))
    )
  }

  // Try to find a replacement supplier for this order item
  if (assignment.order_item) {
    const { order_id, unit_price_frozen, product_id } = assignment.order_item

    // Corte del ciclo del pedido — solo son elegibles publicaciones anteriores al corte (§4).
    const { data: orderRow } = await adminClient
      .from('orders')
      .select('dispatch_cycle_id')
      .eq('id', order_id)
      .maybeSingle()

    const { data: cycleRow } = orderRow?.dispatch_cycle_id
      ? await adminClient
          .from('dispatch_cycles')
          .select('cutoff_at')
          .eq('id', orderRow.dispatch_cycle_id)
          .maybeSingle()
      : { data: null }

    const cutoffAt = cycleRow?.cutoff_at ?? now

    // Candidatos elegibles (filtro de corte en la consulta) + plan greedy con orden §4
    // y guard de margen. Lógica pura testeable en planReplacements().
    const candidates = await fetchReplacementCandidates(adminClient, {
      productId: product_id,
      excludeSupplierId: assignment.supplier_id,
      cutoffAt,
    })
    const plan = planReplacements(candidates, {
      assignedQuantity: assignment.assigned_quantity,
      unitPriceFrozen: unit_price_frozen,
    })
    const skippedOverPrice = plan.skippedOverPrice
    // `remaining` se recalcula con lo realmente descontado por la RPC atómica
    // (decrementPublicationStock evita sobreventa si el stock cambió en paralelo).
    let remaining = assignment.assigned_quantity

    for (const { pub, deduct } of plan.picks) {
      const deducted = await decrementPublicationStock(adminClient, pub.id, deduct)
      if (deducted <= 0) continue
      remaining = Math.round((remaining - deducted) * 1000) / 1000

      await adminClient.from('order_item_assignments').insert({
        order_item_id:          assignment.order_item_id,
        publication_id:         pub.id,
        supplier_id:            pub.supplier_id,
        assigned_quantity:      deducted,
        supplier_price_frozen:  pub.minimum_price,
        platform_margin_frozen: Math.round((unit_price_frozen - pub.minimum_price) * 100) / 100,
        status:                 'pending',
      })

      // Notify new supplier
      await adminClient.from('notifications').insert({
        recipient_id:   pub.supplier_id,
        type:           'assignment_created',
        channel:        'whatsapp',
        title:          'Nuevo pedido asignado',
        body:           `Se te asignó un pedido #${order_id.slice(0, 8).toUpperCase()}. Ingresa a tu panel para confirmar o rechazar.`,
        reference_type: 'order',
        reference_id:   order_id,
        status:         'pending',
      })
    }

    // Log reassignment attempt
    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.ASSIGNMENT_FAILED,
      module:       AUDIT_MODULES.SUPPLIERS,
      entity_type:  'order_item_assignment',
      entity_id:    assignmentId,
      ip_address:   ip,
      new_value:    {
        reason,
        replaced: remaining <= 0,
        remaining_qty: remaining,
        skipped_over_price: skippedOverPrice,
        order_id,
      },
    })

    // El gap no se cubrió del todo → TODO-O-NADA: el ítem entero falla.
    // failOrderItemAllOrNothing restaura el stock y marca como failed TODAS las
    // asignaciones aún activas del ítem (incluidos los reemplazos parciales recién
    // creados y cualquier split confirmado), evitando estados inconsistentes (#3) y
    // stock huérfano. Luego se re-evalúa el avance del pedido.
    if (remaining > 0.001) {
      await failOrderItemAllOrNothing(
        adminClient,
        assignment.order_item_id,
        `Cobertura parcial tras rechazo: ítem no cubierto totalmente (todo-o-nada). ${reason}`,
      )
      await tryAdvanceOrderToAssigned(adminClient, order_id)
    }
  }

  return NextResponse.json({ success: true })
}

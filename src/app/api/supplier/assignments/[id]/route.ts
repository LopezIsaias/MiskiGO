import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('fail'), reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres') }),
])

type AssignmentRow = {
  id: string
  supplier_id: string
  order_item_id: string
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
      id, supplier_id, order_item_id, assigned_quantity, status,
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
      // Check if all assignments for this order_item are now confirmed (none pending/failed that aren't failed)
      const { data: itemAssignments } = await adminClient
        .from('order_item_assignments')
        .select('status')
        .eq('order_item_id', assignment.order_item_id)

      const itemDone = (itemAssignments ?? []).every(
        a => a.status === 'confirmed' || a.status === 'failed',
      )
      const itemFullyCovered = (itemAssignments ?? []).some(a => a.status === 'confirmed')

      if (itemDone && itemFullyCovered) {
        await adminClient
          .from('order_items')
          .update({ status: 'assigned' })
          .eq('id', assignment.order_item_id)
      }

      // Check if all order_items for this order are assigned or failed
      const { data: allItems } = await adminClient
        .from('order_items')
        .select('status')
        .eq('order_id', orderId)

      const orderReady = (allItems ?? []).length > 0 &&
        (allItems ?? []).every(i => i.status === 'assigned' || i.status === 'failed' || i.status === 'rejected')
      const orderHasAssigned = (allItems ?? []).some(i => i.status === 'assigned')

      if (orderReady && orderHasAssigned) {
        await adminClient
          .from('orders')
          .update({ status: 'assigned' })
          .eq('id', orderId)
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

    type PubRow = {
      id: string
      available_quantity: number
      supplier_id: string
      minimum_price: number
    }

    const { data: rawPubs } = await adminClient
      .from('supplier_publications')
      .select('id, available_quantity, supplier_id, minimum_price')
      .eq('product_id', product_id)
      .eq('status', 'active')
      .gt('available_quantity', 0)
      .neq('supplier_id', assignment.supplier_id)
      .order('minimum_price', { ascending: true })
      .order('published_at', { ascending: true })
      .limit(5)

    const pubs = (rawPubs ?? []) as unknown as PubRow[]
    let remaining = assignment.assigned_quantity

    for (const pub of pubs) {
      if (remaining <= 0) break
      const deduct = Math.min(pub.available_quantity, remaining)
      remaining = Math.round((remaining - deduct) * 1000) / 1000
      const newQty = Math.round((pub.available_quantity - deduct) * 1000) / 1000

      await adminClient.from('order_item_assignments').insert({
        order_item_id:          assignment.order_item_id,
        publication_id:         pub.id,
        supplier_id:            pub.supplier_id,
        assigned_quantity:      deduct,
        supplier_price_frozen:  pub.minimum_price,
        platform_margin_frozen: Math.round((unit_price_frozen - pub.minimum_price) * 100) / 100,
        status:                 'pending',
      })

      if (newQty <= 0) {
        await adminClient.from('supplier_publications').update({ status: 'fulfilled' }).eq('id', pub.id)
      } else {
        await adminClient.from('supplier_publications').update({ available_quantity: newQty }).eq('id', pub.id)
      }

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
        order_id,
      },
    })

    // No replacement covered the gap → mark the item as failed so the operator
    // sees the manual-assign panel, and re-evaluate whether the order can advance.
    if (remaining > 0.001) {
      await adminClient
        .from('order_items')
        .update({ status: 'failed' })
        .eq('id', assignment.order_item_id)

      // Order advances once every item is resolved (assigned/failed/rejected) and
      // at least one is assigned — failed items count as resolved so the order is
      // not stuck waiting on an item with no available supplier.
      const { data: allItems } = await adminClient
        .from('order_items')
        .select('status')
        .eq('order_id', order_id)

      const orderReady = (allItems ?? []).length > 0 &&
        (allItems ?? []).every(i => i.status === 'assigned' || i.status === 'failed' || i.status === 'rejected')
      const orderHasAssigned = (allItems ?? []).some(i => i.status === 'assigned')

      if (orderReady && orderHasAssigned) {
        await adminClient
          .from('orders')
          .update({ status: 'assigned' })
          .eq('id', order_id)
      }
    }
  }

  return NextResponse.json({ success: true })
}

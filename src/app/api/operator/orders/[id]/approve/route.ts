import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

type ProvisionalAssignment = {
  id: string
  publication_id: string
  supplier_id: string
  assigned_quantity: number
  supplier_price_frozen: number
  platform_margin_frozen: number
  status: string
}

type OrderItemRow = {
  id: string
  quantity: number
  unit_price_frozen: number
  product_id: string
  order_item_assignments: ProvisionalAssignment[]
}

type PublicationWithRep = {
  id: string
  available_quantity: number
  supplier_id: string
  minimum_price: number
  published_at: string
  supplier: { reputation_score: number } | null
}

export async function POST(
  _request: Request,
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

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, dispatch_cycle_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (order.status !== 'payment_submitted') {
    return NextResponse.json({ error: 'El pedido no está pendiente de validación' }, { status: 400 })
  }

  const { data: cycle } = await adminClient
    .from('dispatch_cycles')
    .select('cutoff_at')
    .eq('id', order.dispatch_cycle_id)
    .maybeSingle()

  // --- Payment approval ---
  // setting payment_approved_at triggers the lock_order_on_payment DB trigger automatically
  const { error: updateErr } = await adminClient
    .from('orders')
    .update({
      status: 'confirmed',
      payment_approved_at: new Date().toISOString(),
      payment_approved_by: user.id,
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[approve] order update failed:', updateErr.message)
    return NextResponse.json({ error: 'Error al aprobar el pedido' }, { status: 500 })
  }

  await adminClient
    .from('payment_verifications')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'pending')

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.PAYMENT_APPROVED,
    module: AUDIT_MODULES.PAYMENTS,
    entity_type: 'order',
    entity_id: orderId,
    new_value: { status: 'confirmed', approved_by: user.id },
  })

  // --- Step 11: Supplier assignment ---
  const { data: rawItems } = await adminClient
    .from('order_items')
    .select(`
      id, quantity, unit_price_frozen, product_id,
      order_item_assignments(
        id, publication_id, supplier_id,
        assigned_quantity, supplier_price_frozen, platform_margin_frozen, status
      )
    `)
    .eq('order_id', orderId)

  const orderItems = (rawItems ?? []) as unknown as OrderItemRow[]

  let allAssigned = true
  const failedItemIds: string[] = []
  const now = new Date().toISOString()
  // Use cycle cutoff to scope valid publications; fall back to now if cycle missing
  const cutoffAt = cycle?.cutoff_at ?? now

  for (const item of orderItems) {
    const pendingAsgs = item.order_item_assignments.filter(a => a.status === 'pending')
    const coveredByProvisional = pendingAsgs.reduce(
      (s, a) => Math.round((s + a.assigned_quantity) * 1000) / 1000,
      0,
    )
    let remaining = Math.round((item.quantity - coveredByProvisional) * 1000) / 1000

    // Extra assignments created if provisional coverage has gaps (edge case: stock changed between
    // checkout and approval, e.g. another order or manual adjustment)
    const extraAssignments: {
      order_item_id: string; publication_id: string; supplier_id: string
      assigned_quantity: number; supplier_price_frozen: number; platform_margin_frozen: number
      status: string; confirmed_at: string
    }[] = []

    if (remaining > 0.001) {
      // Find active publications for this product and dispatch cycle, sorted by:
      // 1. minimum_price ASC  2. published_at ASC (FIFO)  3. reputation_score DESC
      const { data: rawPubs } = await adminClient
        .from('supplier_publications')
        .select(`
          id, available_quantity, supplier_id, minimum_price, published_at,
          supplier:users!supplier_id(reputation_score)
        `)
        .eq('product_id', item.product_id)
        .eq('status', 'active')
        .gt('available_quantity', 0)
        .lte('published_at', cutoffAt)
        .order('minimum_price', { ascending: true })
        .order('published_at', { ascending: true })

      const activePubs = ((rawPubs ?? []) as unknown as PublicationWithRep[]).sort((a, b) => {
        if (a.minimum_price !== b.minimum_price) return a.minimum_price - b.minimum_price
        if (a.published_at !== b.published_at) return a.published_at < b.published_at ? -1 : 1
        return (b.supplier?.reputation_score ?? 0) - (a.supplier?.reputation_score ?? 0)
      })

      const alreadyUsed = new Set(pendingAsgs.map(a => a.publication_id))

      for (const pub of activePubs) {
        if (remaining <= 0.001) break
        if (alreadyUsed.has(pub.id)) continue

        const deduct = Math.min(pub.available_quantity, remaining)
        remaining = Math.round((remaining - deduct) * 1000) / 1000
        const newQty = Math.round((pub.available_quantity - deduct) * 1000) / 1000

        extraAssignments.push({
          order_item_id: item.id,
          publication_id: pub.id,
          supplier_id: pub.supplier_id,
          assigned_quantity: deduct,
          supplier_price_frozen: pub.minimum_price,
          platform_margin_frozen: Math.round((item.unit_price_frozen - pub.minimum_price) * 100) / 100,
          status: 'confirmed',
          confirmed_at: now,
        })

        if (newQty <= 0) {
          await adminClient
            .from('supplier_publications')
            .update({ status: 'fulfilled' })
            .eq('id', pub.id)
        } else {
          await adminClient
            .from('supplier_publications')
            .update({ available_quantity: newQty })
            .eq('id', pub.id)
        }
      }
    }

    const fullyResolved = remaining <= 0.001

    if (!fullyResolved) {
      allAssigned = false
      failedItemIds.push(item.id)

      await adminClient
        .from('order_items')
        .update({ status: 'failed' })
        .eq('id', item.id)

      if (pendingAsgs.length > 0) {
        await adminClient
          .from('order_item_assignments')
          .update({ status: 'failed', failure_reason: 'Stock insuficiente al aprobar pago' })
          .in('id', pendingAsgs.map(a => a.id))
      }
    } else {
      // Confirm provisional reservations from checkout
      if (pendingAsgs.length > 0) {
        await adminClient
          .from('order_item_assignments')
          .update({ status: 'confirmed', confirmed_at: now })
          .in('id', pendingAsgs.map(a => a.id))
      }
      // Insert supplementary assignments that filled any gap
      if (extraAssignments.length > 0) {
        await adminClient.from('order_item_assignments').insert(extraAssignments)
      }
      await adminClient
        .from('order_items')
        .update({ status: 'assigned' })
        .eq('id', item.id)
    }
  }

  // Advance order to 'assigned' once all items have a confirmed supplier
  if (allAssigned) {
    await adminClient
      .from('orders')
      .update({ status: 'assigned' })
      .eq('id', orderId)
  }

  // In-app alert for the operator when one or more items cannot be fulfilled
  if (failedItemIds.length > 0) {
    await adminClient.from('notifications').insert({
      recipient_id: user.id,
      type: 'assignment_failed',
      channel: 'in_app',
      title: 'Asignación incompleta',
      body: `El pedido #${orderId.slice(0, 8).toUpperCase()} tiene ${failedItemIds.length} ítem(s) sin stock suficiente. Se requiere intervención manual.`,
      reference_type: 'order',
      reference_id: orderId,
      status: 'sent',
      sent_at: now,
    })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: allAssigned ? AUDIT_ACTIONS.SUPPLIER_ASSIGNED : AUDIT_ACTIONS.ASSIGNMENT_FAILED,
    module: AUDIT_MODULES.ORDERS,
    entity_type: 'order',
    entity_id: orderId,
    new_value: {
      status: allAssigned ? 'assigned' : 'confirmed',
      total_items: orderItems.length,
      assigned_items: orderItems.length - failedItemIds.length,
      failed_items: failedItemIds.length,
    },
  })

  return NextResponse.json({
    success: true,
    assigned: allAssigned,
    assignedItems: orderItems.length - failedItemIds.length,
    failedItems: failedItemIds.length,
  })
}

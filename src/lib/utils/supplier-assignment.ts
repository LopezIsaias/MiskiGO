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

export interface AssignmentResult {
  allAssigned: boolean
  assignedItems: number
  failedItems: number
}

export interface AssignmentParams {
  orderId: string
  userId: string
  userRole: string
  cutoffAt: string
  // If provided, an in-app notification is sent to this user when items fail to assign.
  // Omit when calling from checkout (no operator context available).
  operatorId?: string
}

/**
 * Confirms provisional supplier assignments created at checkout and advances the order
 * to `assigned`. If any item has a coverage gap (stock changed since checkout), runs
 * a supplementary greedy search before deciding the item failed.
 *
 * Priority: minimum_price ASC → published_at ASC (FIFO) → reputation_score DESC.
 */
export async function runSupplierAssignment(params: AssignmentParams): Promise<AssignmentResult> {
  const { orderId, userId, userRole, cutoffAt, operatorId } = params
  const adminClient = createAdminClient()

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

  for (const item of orderItems) {
    const pendingAsgs = item.order_item_assignments.filter(a => a.status === 'pending')
    const coveredByProvisional = pendingAsgs.reduce(
      (s, a) => Math.round((s + a.assigned_quantity) * 1000) / 1000,
      0,
    )
    let remaining = Math.round((item.quantity - coveredByProvisional) * 1000) / 1000

    // Supplementary greedy fill for any coverage gap (edge case: stock changed since checkout)
    const extraAssignments: {
      order_item_id: string; publication_id: string; supplier_id: string
      assigned_quantity: number; supplier_price_frozen: number; platform_margin_frozen: number
      status: string; confirmed_at: string
    }[] = []

    if (remaining > 0.001) {
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
          await adminClient.from('supplier_publications').update({ status: 'fulfilled' }).eq('id', pub.id)
        } else {
          await adminClient.from('supplier_publications').update({ available_quantity: newQty }).eq('id', pub.id)
        }
      }
    }

    const fullyResolved = remaining <= 0.001

    if (!fullyResolved) {
      allAssigned = false
      failedItemIds.push(item.id)

      await adminClient.from('order_items').update({ status: 'failed' }).eq('id', item.id)

      if (pendingAsgs.length > 0) {
        await adminClient
          .from('order_item_assignments')
          .update({ status: 'failed', failure_reason: 'Stock insuficiente al confirmar pago' })
          .in('id', pendingAsgs.map(a => a.id))
      }
    } else {
      if (pendingAsgs.length > 0) {
        await adminClient
          .from('order_item_assignments')
          .update({ status: 'confirmed', confirmed_at: now })
          .in('id', pendingAsgs.map(a => a.id))
      }
      if (extraAssignments.length > 0) {
        await adminClient.from('order_item_assignments').insert(extraAssignments)
      }
      await adminClient.from('order_items').update({ status: 'assigned' }).eq('id', item.id)
    }
  }

  if (allAssigned) {
    await adminClient.from('orders').update({ status: 'assigned' }).eq('id', orderId)
  }

  if (failedItemIds.length > 0 && operatorId) {
    await adminClient.from('notifications').insert({
      recipient_id: operatorId,
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
    user_id: userId,
    role_at_time: userRole,
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

  return {
    allAssigned,
    assignedItems: orderItems.length - failedItemIds.length,
    failedItems: failedItemIds.length,
  }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { decrementPublicationStock } from '@/lib/utils/stock'

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

// Plan built during gap-fill loop — DB is NOT touched until fullyResolved is confirmed.
type ExtraAssignmentPlan = {
  publication_id: string
  supplier_id: string
  assigned_quantity: number
  supplier_price_frozen: number
  platform_margin_frozen: number
  origAvailableQty: number  // used to compute newQty at apply time
}

/**
 * Orden de asignación de proveedores (CLAUDE.md §4):
 *   1. minimum_price ASC
 *   2. published_at ASC (FIFO) en empate de precio
 *   3. reputation_score DESC en empate de precio Y fecha
 */
export function comparePublicationsForAssignment(
  a: Pick<PublicationWithRep, 'minimum_price' | 'published_at' | 'supplier'>,
  b: Pick<PublicationWithRep, 'minimum_price' | 'published_at' | 'supplier'>,
): number {
  if (a.minimum_price !== b.minimum_price) return a.minimum_price - b.minimum_price
  if (a.published_at !== b.published_at) return a.published_at < b.published_at ? -1 : 1
  return (b.supplier?.reputation_score ?? 0) - (a.supplier?.reputation_score ?? 0)
}

/** Publicación candidata para reemplazar a un proveedor que rechazó su asignación. */
export interface ReplacementCandidate {
  id: string
  available_quantity: number
  supplier_id: string
  minimum_price: number
  published_at: string
  supplier: { reputation_score: number } | null
}

export interface ReplacementPick {
  pub: ReplacementCandidate
  deduct: number
}

export interface ReplacementPlan {
  picks: ReplacementPick[]
  remaining: number
  /** true si se descartó ≥1 candidato por superar el precio congelado (margen negativo). */
  skippedOverPrice: boolean
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000

/**
 * Selecciona publicaciones de reemplazo (greedy) respetando el orden §4 y el guard de margen:
 *   - Orden: minimum_price ASC → published_at ASC → reputation_score DESC.
 *   - Guard (§4): descarta cualquier candidato con minimum_price > unitPriceFrozen,
 *     porque auto-asignarlo congelaría un margen negativo. El gap restante se deja
 *     para resolución manual del operador (override auditado).
 * NO toca la BD — el llamador aplica los picks (insert asignación + decremento de stock).
 * El filtro de corte (published_at ≤ cutoff) se aplica en la consulta, no aquí.
 */
export function planReplacements(
  candidates: ReplacementCandidate[],
  opts: { assignedQuantity: number; unitPriceFrozen: number },
): ReplacementPlan {
  const sorted = [...candidates].sort(comparePublicationsForAssignment)
  let remaining = opts.assignedQuantity
  let skippedOverPrice = false
  const picks: ReplacementPick[] = []

  for (const pub of sorted) {
    if (remaining <= 0.001) break
    if (pub.minimum_price > opts.unitPriceFrozen) {
      skippedOverPrice = true
      continue
    }
    const deduct = Math.min(pub.available_quantity, remaining)
    remaining = round3(remaining - deduct)
    picks.push({ pub, deduct })
  }

  return { picks, remaining, skippedOverPrice }
}

type AdminClientLike = ReturnType<typeof createAdminClient>

/**
 * Consulta candidatos de reemplazo para un producto, excluyendo al proveedor que rechazó
 * y aplicando el filtro de corte (§4): solo publicaciones activas con stock publicadas
 * antes o en el corte del ciclo.
 */
export async function fetchReplacementCandidates(
  adminClient: AdminClientLike,
  opts: { productId: string; excludeSupplierId: string; cutoffAt: string },
): Promise<ReplacementCandidate[]> {
  const { data } = await adminClient
    .from('supplier_publications')
    .select('id, available_quantity, supplier_id, minimum_price, published_at, supplier:users!supplier_id(reputation_score)')
    .eq('product_id', opts.productId)
    .eq('status', 'active')
    .gt('available_quantity', 0)
    .neq('supplier_id', opts.excludeSupplierId)
    .lte('published_at', opts.cutoffAt)

  return (data ?? []) as unknown as ReplacementCandidate[]
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
  const notifiedSuppliers = new Set<string>()

  for (const item of orderItems) {
    const pendingAsgs = item.order_item_assignments.filter(a => a.status === 'pending')
    const coveredByProvisional = pendingAsgs.reduce(
      (s, a) => Math.round((s + a.assigned_quantity) * 1000) / 1000,
      0,
    )
    let remaining = Math.round((item.quantity - coveredByProvisional) * 1000) / 1000

    // PLAN phase: build supplementary assignments WITHOUT touching the DB.
    // Stock decrements are applied only if the item ends up fully resolved.
    const extraPlans: ExtraAssignmentPlan[] = []

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

      const activePubs = ((rawPubs ?? []) as unknown as PublicationWithRep[])
        .sort(comparePublicationsForAssignment)

      const alreadyUsed = new Set(pendingAsgs.map(a => a.publication_id))

      for (const pub of activePubs) {
        if (remaining <= 0.001) break
        if (alreadyUsed.has(pub.id)) continue
        const deduct = Math.min(pub.available_quantity, remaining)
        remaining = Math.round((remaining - deduct) * 1000) / 1000
        extraPlans.push({
          publication_id: pub.id,
          supplier_id: pub.supplier_id,
          assigned_quantity: deduct,
          supplier_price_frozen: pub.minimum_price,
          platform_margin_frozen: Math.round((item.unit_price_frozen - pub.minimum_price) * 100) / 100,
          origAvailableQty: pub.available_quantity,
        })
      }
    }

    const fullyResolved = remaining <= 0.001

    if (!fullyResolved) {
      // Item fails — gap-fill plans are discarded, no stock changes made.
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
      // APPLY phase: item fully covered — decrement stock atómicamente y persistir.
      // decrementPublicationStock (RPC con FOR UPDATE) evita sobreventa si el stock
      // cambió desde la fase PLAN. Si descuenta menos de lo planeado, se asigna lo
      // realmente descontado; el faltante residual lo cubre el flujo de confirmación
      // del proveedor / recepción más adelante.
      const appliedExtras: ExtraAssignmentPlan[] = []
      for (const plan of extraPlans) {
        const deducted = await decrementPublicationStock(adminClient, plan.publication_id, plan.assigned_quantity)
        if (deducted > 0) appliedExtras.push({ ...plan, assigned_quantity: deducted })
      }

      // Keep existing provisional assignments as 'pending' — supplier must confirm.
      if (pendingAsgs.length > 0) {
        for (const a of pendingAsgs) notifiedSuppliers.add(a.supplier_id)
      }

      if (appliedExtras.length > 0) {
        await adminClient.from('order_item_assignments').insert(
          appliedExtras.map(p => ({
            order_item_id: item.id,
            publication_id: p.publication_id,
            supplier_id: p.supplier_id,
            assigned_quantity: p.assigned_quantity,
            supplier_price_frozen: p.supplier_price_frozen,
            platform_margin_frozen: p.platform_margin_frozen,
            status: 'pending',
          }))
        )
        for (const p of appliedExtras) notifiedSuppliers.add(p.supplier_id)
      }
      // order_items and order stay at current status until suppliers confirm.
    }
  }

  // Notify each confirmed supplier once
  if (notifiedSuppliers.size > 0) {
    await adminClient.from('notifications').insert(
      [...notifiedSuppliers].map(supplierId => ({
        recipient_id:   supplierId,
        type:           'assignment_created',
        channel:        'whatsapp',
        title:          'Nuevo pedido asignado',
        body:           `Se te asignó un pedido #${orderId.slice(0, 8).toUpperCase()}. Ingresa a tu panel para confirmar o rechazar.`,
        reference_type: 'order',
        reference_id:   orderId,
        status:         'pending',
      }))
    )
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
      // Order stays 'confirmed' — advances to 'assigned' after supplier confirmation.
      status: 'confirmed',
      stock_covered: allAssigned,
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

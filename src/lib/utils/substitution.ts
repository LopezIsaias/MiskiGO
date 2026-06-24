import type { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { decrementPublicationStock, restorePublicationStock } from '@/lib/utils/stock'
import { proposeRefundsForFailedItems, tryAdvanceOrderToAssigned } from '@/lib/utils/supplier-assignment'

type AdminClientLike = ReturnType<typeof createAdminClient>

const round2 = (n: number): number => Math.round(n * 100) / 100
const round3 = (n: number): number => Math.round(n * 1000) / 1000

/**
 * Regla de precio del sustituto (pura, testeable):
 *   - charged ≤ original (el sustituto nunca cuesta más).
 *   - charged ≥ minimumPrice del proveedor (no margen negativo).
 */
export function validateSubstitutionPrice(
  opts: { original: number; charged: number; minimumPrice: number },
): { ok: true } | { ok: false; error: string } {
  if (opts.charged > opts.original + 0.001) return { ok: false, error: 'El sustituto no puede costar más que el original' }
  if (opts.charged < opts.minimumPrice - 0.001) return { ok: false, error: 'El precio quedaría por debajo del costo del proveedor (margen negativo)' }
  return { ok: true }
}

/** Diferencia a favor del cliente (≥ 0) que se acredita a billetera. */
export function substitutionPriceDifference(original: number, charged: number, quantity: number): number {
  return round2((original - charged) * quantity)
}

export interface ProposeResult { ok: boolean; error?: string; substitutionId?: string }

/**
 * Sustitución (§4, decisión de negocio): por un order_item 'failed' (sin stock,
 * TODO-O-NADA), el operador PROPONE un producto alternativo en vez de solo
 * reembolsar. El cliente lo acepta/rechaza después (consentimiento).
 *
 * Reglas:
 *   - El ítem debe estar 'failed'.
 *   - La publicación debe estar activa, ser del producto sustituto, de la región
 *     del pedido y tener stock ≥ cantidad del ítem.
 *   - Tope de precio: charged ≤ original_unit_price (el sustituto nunca cuesta más).
 *   - Guard de margen: charged ≥ publication.minimum_price (no margen negativo).
 * NO descuenta stock todavía (se descuenta al aceptar) — evita retener stock por
 * propuestas que el cliente quizá rechace. ponytail: si el stock se agota entre
 * propuesta y aceptación, la aceptación falla limpiamente y se reintenta/reembolsa.
 */
export async function proposeSubstitution(
  admin: AdminClientLike,
  params: {
    orderItemId: string
    substituteProductId: string
    publicationId: string
    chargedUnitPrice: number
    proposedBy: string
    proposedByRole: string
  },
): Promise<ProposeResult> {
  const { orderItemId, substituteProductId, publicationId, chargedUnitPrice, proposedBy, proposedByRole } = params

  const { data: item } = await admin
    .from('order_items')
    .select('id, order_id, quantity, unit_price_frozen, status')
    .eq('id', orderItemId)
    .maybeSingle()
  if (!item) return { ok: false, error: 'Ítem no encontrado' }
  if (item.status !== 'failed') return { ok: false, error: 'Solo se puede sustituir un ítem sin stock (failed)' }

  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, region_id, status')
    .eq('id', item.order_id)
    .maybeSingle()
  if (!order) return { ok: false, error: 'Pedido no encontrado' }
  if (['pending_payment', 'payment_submitted', 'cancelled'].includes(order.status)) {
    return { ok: false, error: 'El pedido no está pagado' }
  }

  const { data: pub } = await admin
    .from('supplier_publications')
    .select('id, product_id, region_id, available_quantity, minimum_price, status')
    .eq('id', publicationId)
    .maybeSingle()
  if (!pub) return { ok: false, error: 'Publicación no encontrada' }
  if (pub.status !== 'active') return { ok: false, error: 'La publicación no está activa' }
  if (pub.product_id !== substituteProductId) return { ok: false, error: 'La publicación no corresponde al producto sustituto' }
  if (order.region_id && pub.region_id !== order.region_id) return { ok: false, error: 'La publicación es de otra región' }

  const quantity = Number(item.quantity)
  if (Number(pub.available_quantity) < quantity - 0.001) return { ok: false, error: 'Stock insuficiente para sustituir' }

  const original = Number(item.unit_price_frozen)
  const charged = round2(chargedUnitPrice)
  const priceCheck = validateSubstitutionPrice({ original, charged, minimumPrice: Number(pub.minimum_price) })
  if (!priceCheck.ok) return { ok: false, error: priceCheck.error }

  const priceDifference = substitutionPriceDifference(original, charged, quantity)

  const { data: inserted, error: insErr } = await admin
    .from('order_item_substitutions')
    .insert({
      order_item_id:         orderItemId,
      order_id:              order.id,
      substitute_product_id: substituteProductId,
      publication_id:        publicationId,
      quantity,
      original_unit_price:   original,
      charged_unit_price:    charged,
      price_difference:      priceDifference,
      status:                'proposed',
      proposed_by:           proposedBy,
    })
    .select('id')
    .maybeSingle()

  // El índice único parcial bloquea una segunda propuesta activa para el mismo ítem.
  if (insErr) return { ok: false, error: 'Ya hay una propuesta activa para este ítem o datos inválidos' }

  await admin.from('audit_log').insert({
    user_id:      proposedBy,
    role_at_time: proposedByRole,
    action:       AUDIT_ACTIONS.SUBSTITUTION_PROPOSED,
    module:       AUDIT_MODULES.ORDERS,
    entity_type:  'order_item',
    entity_id:    orderItemId,
    new_value:    { substitution_id: inserted?.id, substitute_product_id: substituteProductId, charged_unit_price: charged, price_difference: priceDifference },
  })

  const { data: prod } = await admin.from('products').select('name').eq('id', substituteProductId).maybeSingle()
  const creditMsg = priceDifference > 0 ? ` Te acreditaremos S/ ${priceDifference.toFixed(2)} de diferencia a tu billetera.` : ''
  await admin.from('notifications').insert({
    recipient_id:   order.customer_id,
    type:           'substitution_proposed',
    channel:        'whatsapp',
    title:          'Producto alternativo para tu pedido',
    body:           `Un producto de tu pedido #${order.id.slice(0, 8).toUpperCase()} se agotó. Te ofrecemos ${prod?.name ?? 'un producto alternativo'} en su lugar, al mismo precio o menos.${creditMsg} Acéptalo o recházalo desde la app.`,
    reference_type: 'order',
    reference_id:   order.id,
    status:         'pending',
  })

  return { ok: true, substitutionId: inserted?.id }
}

export interface RespondResult { ok: boolean; error?: string }

/**
 * El cliente ACEPTA la sustitución. Atómico en lo que importa:
 *   1. Descuenta stock del sustituto (RPC). Si no alcanza, restaura y aborta.
 *   2. Crea la asignación CONFIRMED (precio y margen congelados).
 *   3. Repunta el order_item: product_id, unit_price_frozen y subtotal_frozen al
 *      sustituto; status 'assigned'.
 *   4. Cancela el reembolso pendiente de la Fase 3 para ese ítem (ya no aplica).
 *   5. Si hubo diferencia a favor, crea crédito de billetera PENDIENTE (lo aprueba
 *      el superadmin, §3). Los totales del pedido NO cambian: total_amount = lo
 *      pagado; la diferencia se devuelve por billetera (igual que el reembolso).
 *   6. Reintenta avanzar el pedido a 'assigned' y audita.
 */
export async function acceptSubstitution(
  admin: AdminClientLike,
  substitutionId: string,
  customerId: string,
): Promise<RespondResult> {
  const { data: sub } = await admin
    .from('order_item_substitutions')
    .select('id, order_item_id, order_id, substitute_product_id, publication_id, quantity, charged_unit_price, price_difference, status')
    .eq('id', substitutionId)
    .maybeSingle()
  if (!sub) return { ok: false, error: 'Propuesta no encontrada' }
  if (sub.status !== 'proposed') return { ok: false, error: 'La propuesta ya fue respondida' }

  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id')
    .eq('id', sub.order_id)
    .maybeSingle()
  if (!order || order.customer_id !== customerId) return { ok: false, error: 'No autorizado' }

  const { data: pub } = await admin
    .from('supplier_publications')
    .select('id, supplier_id, minimum_price')
    .eq('id', sub.publication_id)
    .maybeSingle()
  if (!pub) return { ok: false, error: 'Publicación no disponible' }

  const quantity = Number(sub.quantity)
  const charged = Number(sub.charged_unit_price)

  // 1. Stock atómico.
  const deducted = await decrementPublicationStock(admin, sub.publication_id, quantity)
  if (deducted < quantity - 0.001) {
    if (deducted > 0) await restorePublicationStock(admin, sub.publication_id, deducted)
    return { ok: false, error: 'El producto alternativo se agotó. Lo reembolsaremos a tu billetera.' }
  }

  // 2. Asignación confirmada.
  await admin.from('order_item_assignments').insert({
    order_item_id:          sub.order_item_id,
    publication_id:         sub.publication_id,
    supplier_id:            pub.supplier_id,
    assigned_quantity:      deducted,
    supplier_price_frozen:  Number(pub.minimum_price),
    platform_margin_frozen: round2(charged - Number(pub.minimum_price)),
    status:                 'confirmed',
    confirmed_at:           new Date().toISOString(),
  })

  // 3. Repuntar el ítem al sustituto.
  await admin.from('order_items').update({
    product_id:        sub.substitute_product_id,
    unit_price_frozen: charged,
    subtotal_frozen:   round2(charged * quantity),
    status:            'assigned',
  }).eq('id', sub.order_item_id)

  // 4. Cancelar reembolso pendiente de Fase 3 para este ítem (ya no aplica).
  const { data: pendingRefunds } = await admin
    .from('wallet_transactions')
    .select('id, notes')
    .eq('reference_order_id', sub.order_id)
    .eq('type', 'refund')
    .eq('status', 'pending')
  for (const tx of pendingRefunds ?? []) {
    if (new RegExp(`refund_item:${sub.order_item_id}`).test(tx.notes ?? '')) {
      await admin.from('wallet_transactions').update({ status: 'rejected', notes: `${tx.notes} — sustituido` }).eq('id', tx.id)
    }
  }

  // 5. Crédito por diferencia (pendiente de aprobación del superadmin, §3).
  const priceDifference = round2(Number(sub.price_difference))
  if (priceDifference > 0.001) {
    const { data: cust } = await admin.from('users').select('wallet_balance').eq('id', customerId).maybeSingle()
    const balance = Number(cust?.wallet_balance ?? 0)
    await admin.from('wallet_transactions').insert({
      user_id:            customerId,
      type:               'refund',
      amount:             priceDifference,
      balance_before:     balance,
      balance_after:      round3(balance + priceDifference),
      reference_order_id: sub.order_id,
      status:             'pending',
      notes:              `substitution_diff:${sub.id} — diferencia por producto alternativo`,
    })
  }

  // 6. Marcar aceptada, avanzar pedido, auditar.
  await admin.from('order_item_substitutions')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', sub.id)

  await tryAdvanceOrderToAssigned(admin, sub.order_id)

  await admin.from('audit_log').insert({
    user_id:      customerId,
    role_at_time: 'customer',
    action:       AUDIT_ACTIONS.SUBSTITUTION_ACCEPTED,
    module:       AUDIT_MODULES.ORDERS,
    entity_type:  'order_item',
    entity_id:    sub.order_item_id,
    new_value:    { substitution_id: sub.id, charged_unit_price: charged, price_difference: priceDifference },
  })

  const { data: ops } = await admin
    .from('users').select('id').in('role', ['operator', 'superadmin']).eq('status', 'active').limit(5)
  if (ops && ops.length > 0) {
    const now = new Date().toISOString()
    await admin.from('notifications').insert(
      ops.map((o: { id: string }) => ({
        recipient_id:   o.id,
        type:           'substitution_accepted',
        channel:        'in_app',
        title:          'Sustitución aceptada',
        body:           `El cliente aceptó la sustitución del pedido #${sub.order_id.slice(0, 8).toUpperCase()}.${priceDifference > 0 ? ` Crédito de S/ ${priceDifference.toFixed(2)} pendiente de aprobación.` : ''}`,
        reference_type: 'order',
        reference_id:   sub.order_id,
        status:         'sent',
        sent_at:        now,
      })),
    )
  }

  return { ok: true }
}

/**
 * El cliente RECHAZA la sustitución: la marca 'rejected' y dispara el reembolso de
 * la Fase 3 para el ítem fallido (idempotente). Audita y avisa a operación.
 */
export async function rejectSubstitution(
  admin: AdminClientLike,
  substitutionId: string,
  customerId: string,
): Promise<RespondResult> {
  const { data: sub } = await admin
    .from('order_item_substitutions')
    .select('id, order_id, order_item_id, status')
    .eq('id', substitutionId)
    .maybeSingle()
  if (!sub) return { ok: false, error: 'Propuesta no encontrada' }
  if (sub.status !== 'proposed') return { ok: false, error: 'La propuesta ya fue respondida' }

  const { data: order } = await admin.from('orders').select('customer_id').eq('id', sub.order_id).maybeSingle()
  if (!order || order.customer_id !== customerId) return { ok: false, error: 'No autorizado' }

  await admin.from('order_item_substitutions')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', sub.id)

  // Cae al reembolso de la Fase 3 (idempotente; no duplica si ya existía).
  await proposeRefundsForFailedItems(admin, sub.order_id)

  await admin.from('audit_log').insert({
    user_id:      customerId,
    role_at_time: 'customer',
    action:       AUDIT_ACTIONS.SUBSTITUTION_REJECTED,
    module:       AUDIT_MODULES.ORDERS,
    entity_type:  'order_item',
    entity_id:    sub.order_item_id,
    new_value:    { substitution_id: sub.id },
  })

  return { ok: true }
}

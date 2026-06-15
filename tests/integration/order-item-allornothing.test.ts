import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createTestUser, deleteTestUser, createProduct,
  createPublication, createCycle, createOrder,
  type TestUser,
} from './helpers'
import {
  failOrderItemAllOrNothing,
  tryAdvanceOrderToAssigned,
} from '@/lib/utils/supplier-assignment'

// Inserta un order_item mínimo (precios congelados ficticios).
async function createOrderItem(
  svc: SupabaseClient,
  opts: { orderId: string; productId: string; quantity: number },
): Promise<string> {
  const { data, error } = await svc
    .from('order_items')
    .insert({
      order_id: opts.orderId,
      product_id: opts.productId,
      quantity: opts.quantity,
      unit_price_frozen: 5,
      subtotal_frozen: opts.quantity * 5,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createOrderItem falló: ${error?.message}`)
  return data.id as string
}

async function createAssignment(
  svc: SupabaseClient,
  opts: {
    orderItemId: string; publicationId: string; supplierId: string
    qty: number; status: string
  },
): Promise<string> {
  const { data, error } = await svc
    .from('order_item_assignments')
    .insert({
      order_item_id: opts.orderItemId,
      publication_id: opts.publicationId,
      supplier_id: opts.supplierId,
      assigned_quantity: opts.qty,
      supplier_price_frozen: 3,
      platform_margin_frozen: 2,
      status: opts.status,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createAssignment falló: ${error?.message}`)
  return data.id as string
}

describe.skipIf(!INTEGRATION_ENABLED)('Cobertura parcial — TODO-O-NADA (BD real)', () => {
  let svc: SupabaseClient
  let regionId: string
  let customer: TestUser
  let supA: TestUser
  let supB: TestUser
  let cycleId: string

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    customer = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente TON' })
    supA = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup A' })
    supB = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup B' })
    cycleId = await createCycle(svc, regionId)
  })

  afterAll(async () => {
    for (const u of [customer, supA, supB]) if (u) await deleteTestUser(svc, u.id)
  })

  it('falla el ítem entero y restaura el stock de TODAS las asignaciones activas (confirmed + pending)', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, quantity: 5 })

    // Stock base 10 en ambas pubs; las asignaciones representan stock ya cedido en checkout.
    const pubA = await createPublication(svc, { supplierId: supA.id, productId, regionId, minPrice: 3, qty: 10 })
    const pubB = await createPublication(svc, { supplierId: supB.id, productId, regionId, minPrice: 3, qty: 10 })

    await createAssignment(svc, { orderItemId: itemId, publicationId: pubA, supplierId: supA.id, qty: 3, status: 'confirmed' })
    await createAssignment(svc, { orderItemId: itemId, publicationId: pubB, supplierId: supB.id, qty: 2, status: 'pending' })

    await failOrderItemAllOrNothing(svc, itemId, 'gap no cubierto')

    // Ítem → failed
    const { data: item } = await svc.from('order_items').select('status').eq('id', itemId).single()
    expect(item?.status).toBe('failed')

    // Ambas asignaciones → failed
    const { data: asgs } = await svc
      .from('order_item_assignments')
      .select('status')
      .eq('order_item_id', itemId)
    expect((asgs ?? []).every(a => a.status === 'failed')).toBe(true)

    // Stock restaurado: 10 + qty cedido
    const { data: pa } = await svc.from('supplier_publications').select('available_quantity').eq('id', pubA).single()
    const { data: pb } = await svc.from('supplier_publications').select('available_quantity').eq('id', pubB).single()
    expect(Number(pa?.available_quantity)).toBe(13)
    expect(Number(pb?.available_quantity)).toBe(12)
  })

  it('tryAdvanceOrderToAssigned: pedido avanza a assigned cuando todos los ítems están resueltos y ≥1 assigned', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemOk = await createOrderItem(svc, { orderId, productId, quantity: 2 })
    const itemFail = await createOrderItem(svc, { orderId, productId, quantity: 2 })

    await svc.from('order_items').update({ status: 'assigned' }).eq('id', itemOk)
    await svc.from('order_items').update({ status: 'failed' }).eq('id', itemFail)

    await tryAdvanceOrderToAssigned(svc, orderId)

    const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
    expect(order?.status).toBe('assigned')
  })

  it('tryAdvanceOrderToAssigned: NO avanza si queda un ítem pending', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemOk = await createOrderItem(svc, { orderId, productId, quantity: 2 })
    await createOrderItem(svc, { orderId, productId, quantity: 2 }) // queda pending

    await svc.from('order_items').update({ status: 'assigned' }).eq('id', itemOk)

    await tryAdvanceOrderToAssigned(svc, orderId)

    const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
    expect(order?.status).toBe('confirmed') // sin cambios
  })

  it('tryAdvanceOrderToAssigned: NO avanza si TODOS los ítems fallaron (ninguno assigned)', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const i1 = await createOrderItem(svc, { orderId, productId, quantity: 2 })
    const i2 = await createOrderItem(svc, { orderId, productId, quantity: 2 })

    await svc.from('order_items').update({ status: 'failed' }).eq('id', i1)
    await svc.from('order_items').update({ status: 'failed' }).eq('id', i2)

    await tryAdvanceOrderToAssigned(svc, orderId)

    const { data: order } = await svc.from('orders').select('status').eq('id', orderId).single()
    expect(order?.status).toBe('confirmed') // queda para resolución manual del operador
  })
})

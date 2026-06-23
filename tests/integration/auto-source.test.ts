import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createTestUser, deleteTestUser, createProduct,
  createPublication, createCycle, createOrder,
  type TestUser,
} from './helpers'
import { autoSourceOrderConfirmed } from '@/lib/utils/supplier-assignment'

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

async function itemStatus(svc: SupabaseClient, itemId: string): Promise<string> {
  const { data } = await svc.from('order_items').select('status').eq('id', itemId).single()
  return data!.status as string
}
async function orderStatus(svc: SupabaseClient, orderId: string): Promise<string> {
  const { data } = await svc.from('orders').select('status').eq('id', orderId).single()
  return data!.status as string
}
async function pubQty(svc: SupabaseClient, pubId: string): Promise<number> {
  const { data } = await svc.from('supplier_publications').select('available_quantity').eq('id', pubId).single()
  return Number(data!.available_quantity)
}

describe.skipIf(!INTEGRATION_ENABLED)('autoSourceOrderConfirmed — Fase 2 demanda-primero (BD real)', () => {
  let svc: SupabaseClient
  let regionId: string
  let customer: TestUser
  let sup: TestUser
  let cycleId: string

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    customer = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente AS' })
    sup = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup AS' })
    cycleId = await createCycle(svc, regionId)
  })

  afterAll(async () => {
    for (const u of [customer, sup]) if (u) await deleteTestUser(svc, u.id)
  })

  it('asigna confirmado y avanza a assigned cuando hay oferta suficiente', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, quantity: 5 })
    const pub = await createPublication(svc, { supplierId: sup.id, productId, regionId, minPrice: 3, qty: 10 })

    const r = await autoSourceOrderConfirmed(svc, orderId)

    expect(r.assigned).toBe(1)
    expect(await itemStatus(svc, itemId)).toBe('assigned')
    expect(await orderStatus(svc, orderId)).toBe('assigned')
    expect(await pubQty(svc, pub)).toBe(5) // 10 - 5
  })

  it('deja el ítem en pending si no hay NINGUNA publicación (no lo falla)', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, quantity: 5 })

    const r = await autoSourceOrderConfirmed(svc, orderId)

    expect(r.pending).toBe(1)
    expect(await itemStatus(svc, itemId)).toBe('pending')
    expect(await orderStatus(svc, orderId)).toBe('confirmed')
  })

  it('TODO-O-NADA: oferta insuficiente falla el ítem y restaura el stock', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, quantity: 5 })
    const pub = await createPublication(svc, { supplierId: sup.id, productId, regionId, minPrice: 3, qty: 2 })

    const r = await autoSourceOrderConfirmed(svc, orderId)

    expect(r.failed).toBe(1)
    expect(await itemStatus(svc, itemId)).toBe('failed')
    expect(await pubQty(svc, pub)).toBe(2) // stock restaurado tras el fallo
  })

  it('respeta el guard de margen: descarta publicación con precio > unit_price_frozen', async () => {
    const productId = await createProduct(svc)
    const orderId = await createOrder(svc, { customerId: customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, quantity: 5 }) // unit_price_frozen = 5
    const pub = await createPublication(svc, { supplierId: sup.id, productId, regionId, minPrice: 9, qty: 10 })

    await autoSourceOrderConfirmed(svc, orderId)

    // precio 9 > 5 → no se asigna; sin otra oferta el ítem queda pending y el stock intacto.
    expect(await itemStatus(svc, itemId)).toBe('pending')
    expect(await pubQty(svc, pub)).toBe(10)
  })
})

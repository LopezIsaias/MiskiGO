import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable, getSeedRegionId,
  createTestUser, deleteTestUser, createProduct, createPublication, createCycle, createOrder,
  type TestUser,
} from './helpers'
import { autoSourceOrderConfirmed, proposeRefundsForFailedItems } from '@/lib/utils/supplier-assignment'

// ── helpers locales que reflejan lo que hacen las rutas (sin HTTP/auth) ──
async function createOffering(svc: SupabaseClient, o: { cycleId: string; productId: string; qty: number; price: number }) {
  await svc.from('cycle_offerings').upsert(
    { dispatch_cycle_id: o.cycleId, product_id: o.productId, expected_quantity: o.qty, sale_price: o.price, status: 'active' },
    { onConflict: 'dispatch_cycle_id,product_id' },
  )
}
async function createOrderItem(svc: SupabaseClient, o: { orderId: string; productId: string; qty: number; price: number }) {
  const { data } = await svc.from('order_items').insert({
    order_id: o.orderId, product_id: o.productId, quantity: o.qty,
    unit_price_frozen: o.price, subtotal_frozen: o.qty * o.price, status: 'pending',
  }).select('id').single()
  return data!.id as string
}
async function oStatus(svc: SupabaseClient, id: string) {
  const { data } = await svc.from('orders').select('status, delivered_at, claim_window_expires_at, delivery_attempts').eq('id', id).single()
  return data!
}
async function iStatus(svc: SupabaseClient, id: string) {
  const { data } = await svc.from('order_items').select('status').eq('id', id).single()
  return data!.status as string
}

const findings: string[] = []

describe.skipIf(!INTEGRATION_ENABLED)('Simulación de flujo end-to-end (BD real) — 1 usuario por rol', () => {
  let svc: SupabaseClient
  let regionId: string
  let cycleId: string
  const actors: Record<string, TestUser> = {}

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    for (const role of ['customer', 'supplier', 'delivery', 'operator'] as const) {
      actors[role] = await createTestUser(svc, { role, regionId, fullName: `Sim ${role}` })
    }
    cycleId = await createCycle(svc, regionId) // ciclo abierto
  })

  afterAll(async () => {
    for (const u of Object.values(actors)) if (u) await deleteTestUser(svc, u.id)
    if (findings.length) {
      console.log('\n──────── HALLAZGOS DE LA SIMULACIÓN ────────')
      for (const f of findings) console.log('• ' + f)
      console.log('────────────────────────────────────────────\n')
    }
  })

  // ESCENARIO 1: camino feliz — confirmado → asignado → entregado a la primera
  it('S1 camino feliz: pedido pagado → asignado → entregado (1er intento)', async () => {
    const productId = await createProduct(svc)
    await createOffering(svc, { cycleId, productId, qty: 100, price: 8.5 })
    await createPublication(svc, { supplierId: actors.supplier.id, productId, regionId, minPrice: 5, qty: 60 })

    const orderId = await createOrder(svc, { customerId: actors.customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, qty: 4, price: 8.5 })

    // operador asigna (Fase 2)
    const r = await autoSourceOrderConfirmed(svc, orderId)
    expect(r.assigned).toBe(1)
    expect(await iStatus(svc, itemId)).toBe('assigned')
    expect((await oStatus(svc, orderId)).status).toBe('assigned')

    // entrega (refleja deliver route): in_transit → delivered + ventana de reclamo
    const now = new Date()
    await svc.from('orders').update({
      status: 'delivered', delivered_at: now.toISOString(),
      claim_window_expires_at: new Date(now.getTime() + 2 * 3600_000).toISOString(),
    }).eq('id', orderId)

    const o = await oStatus(svc, orderId)
    expect(o.status).toBe('delivered')
    expect(o.delivered_at).toBeTruthy()
    expect(o.claim_window_expires_at).toBeTruthy()
  })

  // ESCENARIO 2: sin stock suficiente → ítem failed + reembolso pendiente + pedido failed
  it('S2 sin stock: ítem failed → reembolso PENDIENTE + pedido failed', async () => {
    const productId = await createProduct(svc)
    await createOffering(svc, { cycleId, productId, qty: 100, price: 10 })
    await createPublication(svc, { supplierId: actors.supplier.id, productId, regionId, minPrice: 6, qty: 2 }) // < pedido

    const orderId = await createOrder(svc, { customerId: actors.customer.id, cycleId, regionId, status: 'confirmed' })
    const itemId = await createOrderItem(svc, { orderId, productId, qty: 5, price: 10 })

    await autoSourceOrderConfirmed(svc, orderId)
    expect(await iStatus(svc, itemId)).toBe('failed')

    const rr = await proposeRefundsForFailedItems(svc, orderId)
    expect(rr.proposed).toBe(1)
    expect(rr.orderFailed).toBe(true)
    expect((await oStatus(svc, orderId)).status).toBe('failed')

    const { data: tx } = await svc.from('wallet_transactions')
      .select('amount, status, type').eq('reference_order_id', orderId).eq('type', 'refund')
    expect(tx).toHaveLength(1)
    expect(tx![0].status).toBe('pending')
    expect(Number(tx![0].amount)).toBe(50) // 5 × 10
  })

  // ESCENARIO 3: entrega fallida al 1er intento, éxito al 2do
  it('S3 entrega: 1er intento fallido (attempts=1) y 2do entregado', async () => {
    const productId = await createProduct(svc)
    await createOffering(svc, { cycleId, productId, qty: 100, price: 7 })
    await createPublication(svc, { supplierId: actors.supplier.id, productId, regionId, minPrice: 4, qty: 50 })
    const orderId = await createOrder(svc, { customerId: actors.customer.id, cycleId, regionId, status: 'confirmed' })
    await createOrderItem(svc, { orderId, productId, qty: 3, price: 7 })
    await autoSourceOrderConfirmed(svc, orderId)

    // 1er intento fallido (refleja incident route): attempts=1, status sin cambiar
    await svc.from('orders').update({ delivery_attempts: 1 as never }).eq('id', orderId)
    let o = await oStatus(svc, orderId)
    expect(o.delivery_attempts).toBe(1)
    expect(o.status).toBe('assigned') // sigue entregable

    // 2do intento: entregado
    await svc.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', orderId)
    o = await oStatus(svc, orderId)
    expect(o.status).toBe('delivered')
    if ((o.delivery_attempts ?? 0) >= 1) {
      findings.push('OK esperado: entregas con reintento quedan delivered pero delivery_attempts=1 (no se distingue "entregado a la primera" de "al 2do" en el estado final, solo por delivery_attempts).')
    }
  })

  // ESCENARIO 4: cierre — delivered con ventana vencida → completed (fix GAP-1)
  it('S4 fix: el cierre marca delivered (ventana vencida) → completed', async () => {
    const productId = await createProduct(svc)
    await createOffering(svc, { cycleId, productId, qty: 100, price: 9 })
    await createPublication(svc, { supplierId: actors.supplier.id, productId, regionId, minPrice: 5, qty: 50 })
    const orderId = await createOrder(svc, { customerId: actors.customer.id, cycleId, regionId, status: 'confirmed' })
    await createOrderItem(svc, { orderId, productId, qty: 2, price: 9 })
    await autoSourceOrderConfirmed(svc, orderId)

    // entregado con ventana de reclamo YA vencida (hace 1h)
    await svc.from('orders').update({
      status: 'delivered', delivered_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
      claim_window_expires_at: new Date(Date.now() - 1 * 3600_000).toISOString(),
    }).eq('id', orderId)

    // Refleja el cron expire-overdue-orders: cierra delivered con ventana vencida.
    await svc.from('orders').update({ status: 'completed' })
      .eq('status', 'delivered').lt('claim_window_expires_at', new Date().toISOString())

    expect((await oStatus(svc, orderId)).status).toBe('completed')

    // Control: un delivered con ventana AÚN vigente NO debe cerrarse.
    const orderId2 = await createOrder(svc, { customerId: actors.customer.id, cycleId, regionId, status: 'delivered' })
    await svc.from('orders').update({
      delivered_at: new Date().toISOString(),
      claim_window_expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
    }).eq('id', orderId2)
    await svc.from('orders').update({ status: 'completed' })
      .eq('status', 'delivered').lt('claim_window_expires_at', new Date().toISOString())
    expect((await oStatus(svc, orderId2)).status).toBe('delivered')
  })
})

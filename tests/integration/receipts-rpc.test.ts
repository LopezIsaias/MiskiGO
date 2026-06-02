import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createCycle, createOrder,
  createTestUser, deleteTestUser, type TestUser,
} from './helpers'

describe.skipIf(!INTEGRATION_ENABLED)('Numeración de comprobantes (RPC + constraints)', () => {
  let svc: SupabaseClient
  let regionId: string
  // Usuario real para satisfacer FK de orders.customer_id / receipts.customer_id.
  let actor: TestUser

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    actor = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Actor Receipts' })
  })

  afterAll(async () => {
    if (actor) await deleteTestUser(svc, actor.id)
  })

  it('next_receipt_correlative incrementa secuencialmente por serie', async () => {
    const series = `S${Date.now().toString(36)}`
    const r1 = await svc.rpc('next_receipt_correlative', { p_series: series })
    const r2 = await svc.rpc('next_receipt_correlative', { p_series: series })
    const r3 = await svc.rpc('next_receipt_correlative', { p_series: series })
    expect(r1.error).toBeNull()
    expect([r1.data, r2.data, r3.data]).toEqual([1, 2, 3])
  })

  it('series distintas llevan contadores independientes', async () => {
    const a = `A${Date.now().toString(36)}`
    const b = `B${Date.now().toString(36)}`
    await svc.rpc('next_receipt_correlative', { p_series: a })
    await svc.rpc('next_receipt_correlative', { p_series: a })
    const firstB = await svc.rpc('next_receipt_correlative', { p_series: b })
    expect(firstB.data).toBe(1)
  })

  it('llamadas concurrentes producen correlativos únicos (atomicidad)', async () => {
    const series = `C${Date.now().toString(36)}`
    const N = 25
    const results = await Promise.all(
      Array.from({ length: N }, () => svc.rpc('next_receipt_correlative', { p_series: series })),
    )
    const numbers = results.map(r => r.data as number)
    const unique = new Set(numbers)
    expect(unique.size).toBe(N)                       // sin duplicados
    expect(Math.max(...numbers)).toBe(N)              // cubre 1..N sin huecos
    expect(Math.min(...numbers)).toBe(1)
  })

  it('receipts.number es único: insertar duplicado falla', async () => {
    const cycleId = await createCycle(svc, regionId)
    const orderA = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'delivered' })
    const orderB = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'delivered' })
    const dupNumber = `U001-${Date.now().toString().slice(-8)}`

    const base = {
      customer_id: actor.id, type: 'boleta', series: 'U001', correlative: 1,
      document: '12345678', customer_name: 'Prueba', subtotal: 100, total: 100,
    }

    const first = await svc.from('receipts').insert({ ...base, order_id: orderA, number: dupNumber })
    expect(first.error).toBeNull()

    const second = await svc.from('receipts').insert({ ...base, order_id: orderB, number: dupNumber, correlative: 2 })
    expect(second.error).not.toBeNull()
  })

  it('receipts.order_id es 1:1: dos comprobantes para un pedido fallan', async () => {
    const cycleId = await createCycle(svc, regionId)
    const orderId = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'delivered' })
    const stamp = Date.now().toString().slice(-8)

    const base = {
      order_id: orderId, customer_id: actor.id, type: 'boleta', series: 'V001',
      document: '12345678', customer_name: 'Prueba', subtotal: 100, total: 100,
    }

    const first = await svc.from('receipts').insert({ ...base, correlative: 1, number: `V001-1${stamp}` })
    expect(first.error).toBeNull()

    const second = await svc.from('receipts').insert({ ...base, correlative: 2, number: `V001-2${stamp}` })
    expect(second.error).not.toBeNull()
  })
})

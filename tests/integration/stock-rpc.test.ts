import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createTestUser, deleteTestUser, createProduct, createPublication,
  type TestUser,
} from './helpers'

async function decrement(svc: SupabaseClient, pubId: string, qty: number): Promise<number> {
  const { data, error } = await svc.rpc('decrement_publication_stock', { p_pub_id: pubId, p_qty: qty })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}
async function restore(svc: SupabaseClient, pubId: string, qty: number): Promise<number> {
  const { data, error } = await svc.rpc('restore_publication_stock', { p_pub_id: pubId, p_qty: qty })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}
async function pub(svc: SupabaseClient, id: string) {
  const { data } = await svc.from('supplier_publications').select('available_quantity, status').eq('id', id).single()
  return data as { available_quantity: number; status: string }
}

describe.skipIf(!INTEGRATION_ENABLED)('Stock RPC atómico — anti-oversell (BD real)', () => {
  let svc: SupabaseClient
  let regionId: string
  let supplier: TestUser

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    supplier = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup Stock' })
  })

  afterAll(async () => {
    if (supplier) await deleteTestUser(svc, supplier.id)
  })

  it('decrement nunca descuenta más que el stock disponible y agota a fulfilled', async () => {
    const productId = await createProduct(svc)
    const pubId = await createPublication(svc, { supplierId: supplier.id, productId, regionId, minPrice: 2, qty: 10 })

    expect(await decrement(svc, pubId, 5)).toBe(5)
    expect(await decrement(svc, pubId, 8)).toBe(5) // solo quedaban 5
    expect(await decrement(svc, pubId, 1)).toBe(0) // ya agotada (fulfilled)

    // CHECK (available_quantity > 0): al agotarse NO se pone en 0; pasa a 'fulfilled'.
    const p = await pub(svc, pubId)
    expect(p.status).toBe('fulfilled')
  })

  it('CONCURRENCIA: 6 descuentos paralelos de 8 sobre stock 8 → suma descontada = 8 (sin sobreventa)', async () => {
    const productId = await createProduct(svc)
    const pubId = await createPublication(svc, { supplierId: supplier.id, productId, regionId, minPrice: 2, qty: 8 })

    const results = await Promise.all(
      Array.from({ length: 6 }, () => decrement(svc, pubId, 8)),
    )
    const totalDeducted = results.reduce((s, n) => s + n, 0)

    expect(totalDeducted).toBe(8) // jamás 48; el lock de fila serializa
    expect((await pub(svc, pubId)).status).toBe('fulfilled')
  })

  it('CONCURRENCIA parcial: 10 descuentos de 1 sobre stock 4 → exactamente 4 ganan', async () => {
    const productId = await createProduct(svc)
    const pubId = await createPublication(svc, { supplierId: supplier.id, productId, regionId, minPrice: 2, qty: 4 })

    const results = await Promise.all(Array.from({ length: 10 }, () => decrement(svc, pubId, 1)))
    const winners = results.filter(n => n === 1).length
    const totalDeducted = results.reduce((s, n) => s + n, 0)

    expect(totalDeducted).toBe(4)
    expect(winners).toBe(4)
  })

  it('restore reactiva una publicación fulfilled sin duplicar stock', async () => {
    const productId = await createProduct(svc)
    const pubId = await createPublication(svc, { supplierId: supplier.id, productId, regionId, minPrice: 2, qty: 6 })

    expect(await decrement(svc, pubId, 6)).toBe(6)
    expect((await pub(svc, pubId)).status).toBe('fulfilled')

    // 'fulfilled' dejó available_quantity intacto (6) → restore solo reactiva, no suma.
    expect(await restore(svc, pubId, 4)).toBe(0)
    const p = await pub(svc, pubId)
    expect(p.available_quantity).toBe(6)
    expect(p.status).toBe('active')
  })

  it('restore suma de vuelta en consumo parcial (publicación activa)', async () => {
    const productId = await createProduct(svc)
    const pubId = await createPublication(svc, { supplierId: supplier.id, productId, regionId, minPrice: 2, qty: 10 })

    expect(await decrement(svc, pubId, 4)).toBe(4) // queda activa con 6
    expect((await pub(svc, pubId)).available_quantity).toBe(6)

    expect(await restore(svc, pubId, 4)).toBe(4)
    expect((await pub(svc, pubId)).available_quantity).toBe(10)
  })
})

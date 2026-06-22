import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable, getSeedRegionId,
  createProduct, createTestUser, signedInClient, deleteTestUser, type TestUser,
} from './helpers'

// Aislamiento RLS por rol (CLAUDE.md § 3):
//  - supplier NUNCA ve información de otros proveedores
//  - customer ve el catálogo (publicaciones activas) pero no inserta billetera
//  - wallet_transactions: solo superadmin inserta
describe.skipIf(!INTEGRATION_ENABLED)('RLS: aislamiento por rol', () => {
  let svc: SupabaseClient
  let regionId: string
  let productId: string
  let supplierA: TestUser
  let supplierB: TestUser
  let customer: TestUser
  let pubA: string

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    productId = await createProduct(svc)
    supplierA = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Proveedor A' })
    supplierB = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Proveedor B' })
    customer = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente' })

    // supplierA publica desde su propia sesión (valida supplier_pub_insert).
    const clientA = await signedInClient(supplierA)
    const { data, error } = await clientA
      .from('supplier_publications')
      .insert({
        supplier_id: supplierA.id, product_id: productId, region_id: regionId,
        available_quantity: 100, minimum_price: 5,
        expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: 'active',
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`[integration] publish supplierA falló: ${error?.message}`)
    pubA = data.id as string
  })

  afterAll(async () => {
    if (pubA) await svc.from('supplier_publications').delete().eq('id', pubA)
    if (supplierA) await deleteTestUser(svc, supplierA.id)
    if (supplierB) await deleteTestUser(svc, supplierB.id)
    if (customer) await deleteTestUser(svc, customer.id)
    if (productId) await svc.from('products').delete().eq('id', productId)
  })

  it('un supplier NO ve las publicaciones de otro supplier', async () => {
    const clientB = await signedInClient(supplierB)
    const { data } = await clientB.from('supplier_publications').select('id').eq('id', pubA)
    expect(data ?? []).toHaveLength(0)
  })

  it('un supplier sí ve sus propias publicaciones', async () => {
    const clientA = await signedInClient(supplierA)
    const { data } = await clientA.from('supplier_publications').select('id').eq('id', pubA)
    expect((data ?? []).map(p => p.id)).toContain(pubA)
  })

  it('un supplier NO puede publicar a nombre de otro supplier (WITH CHECK)', async () => {
    const clientB = await signedInClient(supplierB)
    const { error } = await clientB
      .from('supplier_publications')
      .insert({
        supplier_id: supplierA.id, product_id: productId, region_id: regionId,
        available_quantity: 50, minimum_price: 9,
        expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: 'active',
      })
    expect(error).not.toBeNull()
  })

  it('un supplier NO puede editar la publicación de otro (RLS UPDATE → 0 filas)', async () => {
    const clientB = await signedInClient(supplierB)
    const { data } = await clientB
      .from('supplier_publications')
      .update({ minimum_price: 1 })
      .eq('id', pubA)
      .select('id')
    expect(data ?? []).toHaveLength(0)

    // El precio original no cambió (verificado con service role).
    const { data: fresh } = await svc.from('supplier_publications').select('minimum_price').eq('id', pubA).single()
    expect(Number(fresh?.minimum_price)).toBe(5)
  })

  it('un customer NO puede leer supplier_publications directo (Fase 0: sin fuga de supplier_id/minimum_price)', async () => {
    // El catálogo del cliente se sirve vía la vista catalog_availability,
    // no por acceso directo a la tabla. La policy supplier_pub_select_customer
    // fue eliminada en mig 036.
    const clientC = await signedInClient(customer)
    const { data } = await clientC.from('supplier_publications').select('id').eq('id', pubA)
    expect(data ?? []).toHaveLength(0)
  })

  it('un customer NO puede insertar wallet_transactions (solo superadmin)', async () => {
    const clientC = await signedInClient(customer)
    const { error } = await clientC
      .from('wallet_transactions')
      .insert({
        user_id: customer.id, type: 'recharge', amount: 100,
        balance_before: 0, balance_after: 100, status: 'pending',
      })
    expect(error).not.toBeNull()
  })

  it('un customer solo ve su propio historial de billetera', async () => {
    // superadmin (service role) inserta una transacción para otro usuario.
    await svc.from('wallet_transactions').insert({
      user_id: supplierA.id, type: 'bonus', amount: 10,
      balance_before: 0, balance_after: 10, status: 'approved',
    })

    const clientC = await signedInClient(customer)
    const { data } = await clientC.from('wallet_transactions').select('user_id')
    // El cliente no ve transacciones de otros usuarios.
    expect((data ?? []).every(t => t.user_id === customer.id)).toBe(true)
  })
})

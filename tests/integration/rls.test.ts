import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable, getSeedRegionId,
  createCycle, createOrder, createTestUser, signedInClient, deleteTestUser, type TestUser,
} from './helpers'

describe.skipIf(!INTEGRATION_ENABLED)('RLS: aislamiento de datos por usuario', () => {
  let svc: SupabaseClient
  let regionId: string
  let cycleId: string
  let custA: TestUser
  let custB: TestUser
  let orderA: string
  let orderB: string

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    cycleId = await createCycle(svc, regionId)
    custA = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente A' })
    custB = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente B' })
    orderA = await createOrder(svc, { customerId: custA.id, cycleId, regionId })
    orderB = await createOrder(svc, { customerId: custB.id, cycleId, regionId })
  })

  afterAll(async () => {
    if (custA) await deleteTestUser(svc, custA.id)
    if (custB) await deleteTestUser(svc, custB.id)
  })

  it('el trigger handle_new_auth_user creó el perfil con rol customer', async () => {
    const { data } = await svc.from('users').select('role, status').eq('id', custA.id).single()
    expect(data?.role).toBe('customer')
    expect(data?.status).toBe('active')
  })

  it('un cliente solo ve sus propios pedidos', async () => {
    const clientA = await signedInClient(custA)
    const { data, error } = await clientA.from('orders').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map(o => o.id)
    expect(ids).toContain(orderA)
    expect(ids).not.toContain(orderB)
  })

  it('un cliente no puede leer el pedido de otro por id directo', async () => {
    const clientB = await signedInClient(custB)
    const { data } = await clientB.from('orders').select('id').eq('id', orderA)
    expect(data ?? []).toHaveLength(0)
  })

  it('un cliente no puede modificar el pedido de otro (RLS UPDATE)', async () => {
    const clientB = await signedInClient(custB)
    const { data } = await clientB
      .from('orders')
      .update({ delivery_notes: 'intruso' })
      .eq('id', orderA)
      .select('id')
    // RLS impide ver/afectar la fila → 0 filas devueltas.
    expect(data ?? []).toHaveLength(0)
  })

  it('un cliente ve solo su comprobante', async () => {
    const stamp = Date.now().toString().slice(-8)
    await svc.from('receipts').insert({
      order_id: orderA, customer_id: custA.id, type: 'boleta', series: 'R001',
      correlative: 1, number: `R001-A${stamp}`, document: '12345678',
      customer_name: 'Cliente A', subtotal: 100, total: 100,
    })

    const clientB = await signedInClient(custB)
    const { data: seenByB } = await clientB.from('receipts').select('id').eq('order_id', orderA)
    expect(seenByB ?? []).toHaveLength(0)

    const clientA = await signedInClient(custA)
    const { data: seenByA } = await clientA.from('receipts').select('id').eq('order_id', orderA)
    expect((seenByA ?? []).length).toBe(1)
  })
})

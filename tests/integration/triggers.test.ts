import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createCycle, createOrder,
  createTestUser, deleteTestUser, type TestUser,
} from './helpers'

describe.skipIf(!INTEGRATION_ENABLED)('Triggers e inmutabilidad (BD real)', () => {
  let svc: SupabaseClient
  let regionId: string
  // El superadmin sembrado en 015 se borra en 017 (se recrea vía Admin API con
  // id aleatorio). Creamos un usuario real por suite para satisfacer las FK.
  let actor: TestUser

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    actor = await createTestUser(svc, { role: 'superadmin', regionId, fullName: 'Actor Triggers' })
  })

  afterAll(async () => {
    if (actor) await deleteTestUser(svc, actor.id)
  })

  it('lock_order_on_payment: fijar payment_approved_at bloquea el pedido', async () => {
    const cycleId = await createCycle(svc, regionId)
    const orderId = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'payment_submitted' })

    const { error } = await svc
      .from('orders')
      .update({ payment_approved_at: new Date().toISOString(), payment_approved_by: actor.id, status: 'confirmed' })
      .eq('id', orderId)
    expect(error).toBeNull()

    const { data } = await svc.from('orders').select('is_locked, locked_at').eq('id', orderId).single()
    expect(data?.is_locked).toBe(true)
    expect(data?.locked_at).not.toBeNull()
  })

  it('set_claim_window: fijar delivered_at calcula la ventana de reclamo a +2h', async () => {
    const cycleId = await createCycle(svc, regionId)
    const orderId = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'in_transit' })

    const deliveredAt = new Date()
    const { error } = await svc.from('orders').update({ delivered_at: deliveredAt.toISOString() }).eq('id', orderId)
    expect(error).toBeNull()

    const { data } = await svc.from('orders').select('delivered_at, claim_window_expires_at').eq('id', orderId).single()
    expect(data?.claim_window_expires_at).not.toBeNull()
    const diffMs = new Date(data!.claim_window_expires_at as string).getTime() - new Date(data!.delivered_at as string).getTime()
    expect(diffMs).toBe(2 * 60 * 60 * 1000)
  })

  it('audit_log es append-only: UPDATE y DELETE fallan', async () => {
    const { data: inserted, error: insErr } = await svc
      .from('audit_log')
      .insert({ user_id: actor.id, role_at_time: 'superadmin', action: 'test_action', module: 'system' })
      .select('id')
      .single()
    expect(insErr).toBeNull()
    const id = inserted!.id as string

    const { error: updErr } = await svc.from('audit_log').update({ notes: 'hack' }).eq('id', id)
    expect(updErr).not.toBeNull()

    const { error: delErr } = await svc.from('audit_log').delete().eq('id', id)
    expect(delErr).not.toBeNull()
  })

  it('wallet_transactions: aprobar (cambiar status) permitido; alterar saldo congelado falla', async () => {
    const { data: tx, error: insErr } = await svc
      .from('wallet_transactions')
      .insert({
        user_id: actor.id, type: 'recharge', amount: 50,
        balance_before: 0, balance_after: 50, status: 'pending',
      })
      .select('id')
      .single()
    expect(insErr).toBeNull()
    const id = tx!.id as string

    // Aprobación (status/approved_*) debe permitirse tras la migración 028.
    const { error: approveErr } = await svc
      .from('wallet_transactions')
      .update({ status: 'approved', approved_by: actor.id, approved_at: new Date().toISOString() })
      .eq('id', id)
    expect(approveErr).toBeNull()

    // Cambiar balance_after (campo congelado) debe fallar.
    const { error: tamperErr } = await svc
      .from('wallet_transactions')
      .update({ balance_after: 999 })
      .eq('id', id)
    expect(tamperErr).not.toBeNull()
  })

  it('receipts es inmutable: UPDATE y DELETE fallan', async () => {
    const cycleId = await createCycle(svc, regionId)
    const orderId = await createOrder(svc, { customerId: actor.id, cycleId, regionId, status: 'delivered' })

    const num = `T001-${Date.now().toString().slice(-8)}`
    const { data: rec, error: insErr } = await svc
      .from('receipts')
      .insert({
        order_id: orderId, customer_id: actor.id, type: 'boleta',
        series: 'T001', correlative: 1, number: num,
        document: '12345678', customer_name: 'Prueba', subtotal: 100, total: 100,
      })
      .select('id')
      .single()
    expect(insErr).toBeNull()
    const id = rec!.id as string

    const { error: updErr } = await svc.from('receipts').update({ total: 1 }).eq('id', id)
    expect(updErr).not.toBeNull()

    const { error: delErr } = await svc.from('receipts').delete().eq('id', id)
    expect(delErr).not.toBeNull()
  })
})

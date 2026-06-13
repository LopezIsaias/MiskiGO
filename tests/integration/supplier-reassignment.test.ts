import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INTEGRATION_ENABLED, serviceClient, assertReachable,
  getSeedRegionId, createTestUser, deleteTestUser, createProduct, createPublication,
  type TestUser,
} from './helpers'
import { fetchReplacementCandidates, planReplacements } from '@/lib/utils/supplier-assignment'

describe.skipIf(!INTEGRATION_ENABLED)('Reasignación por rechazo de proveedor (BD real)', () => {
  let svc: SupabaseClient
  let regionId: string
  let supRejected: TestUser   // proveedor que rechaza (se excluye)
  let supBefore: TestUser     // candidato válido, publicó antes del corte
  let supAfter: TestUser      // publicó DESPUÉS del corte (no elegible)
  let supHiRep: TestUser      // empata precio/fecha, mayor reputación
  let supOverPrice: TestUser  // precio sobre el congelado (guard de margen)

  beforeAll(async () => {
    await assertReachable()
    svc = serviceClient()
    regionId = await getSeedRegionId(svc)
    supRejected  = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup Rechaza' })
    supBefore    = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup Antes' })
    supAfter     = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup Despues' })
    supHiRep     = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup HiRep' })
    supOverPrice = await createTestUser(svc, { role: 'supplier', regionId, fullName: 'Sup Caro' })
  })

  afterAll(async () => {
    for (const u of [supRejected, supBefore, supAfter, supHiRep, supOverPrice]) {
      if (u) await deleteTestUser(svc, u.id)
    }
  })

  it('FIX B: fetchReplacementCandidates excluye al proveedor que rechazó y a las publicaciones post-corte', async () => {
    const productId = await createProduct(svc)
    const cutoffAt = new Date(Date.now() - 86_400_000).toISOString()      // corte: ayer
    const beforeCut = new Date(Date.now() - 2 * 86_400_000).toISOString() // antier (elegible)
    const afterCut  = new Date(Date.now() - 1_000).toISOString()          // hace 1s (post-corte)

    await createPublication(svc, { supplierId: supRejected.id, productId, regionId, minPrice: 2.0, qty: 10, publishedAt: beforeCut })
    await createPublication(svc, { supplierId: supBefore.id,   productId, regionId, minPrice: 2.0, qty: 10, publishedAt: beforeCut })
    await createPublication(svc, { supplierId: supAfter.id,    productId, regionId, minPrice: 1.5, qty: 10, publishedAt: afterCut })

    const candidates = await fetchReplacementCandidates(svc, {
      productId, excludeSupplierId: supRejected.id, cutoffAt,
    })

    const ids = candidates.map(c => c.supplier_id)
    expect(ids).toContain(supBefore.id)
    expect(ids).not.toContain(supRejected.id) // excluido por ser quien rechazó
    expect(ids).not.toContain(supAfter.id)    // excluido por publicar post-corte
  })

  it('FIX B: empate precio+fecha → planReplacements prioriza mayor reputation_score (datos reales)', async () => {
    const productId = await createProduct(svc)
    const cutoffAt = new Date(Date.now() + 86_400_000).toISOString()
    const published = new Date(Date.now() - 2 * 86_400_000).toISOString()

    // reputación distinta en la tabla users
    await svc.from('users').update({ reputation_score: 55 }).eq('id', supBefore.id)
    await svc.from('users').update({ reputation_score: 98 }).eq('id', supHiRep.id)

    await createPublication(svc, { supplierId: supBefore.id, productId, regionId, minPrice: 2.0, qty: 10, publishedAt: published })
    await createPublication(svc, { supplierId: supHiRep.id,  productId, regionId, minPrice: 2.0, qty: 10, publishedAt: published })

    const candidates = await fetchReplacementCandidates(svc, {
      productId, excludeSupplierId: supRejected.id, cutoffAt,
    })
    const { picks } = planReplacements(candidates, { assignedQuantity: 3, unitPriceFrozen: 3.45 })

    expect(picks[0].pub.supplier_id).toBe(supHiRep.id) // mayor reputación gana el empate
  })

  it('FIX C: candidato sobre el precio congelado se descarta (gap queda sin cubrir)', async () => {
    const productId = await createProduct(svc)
    const cutoffAt = new Date(Date.now() + 86_400_000).toISOString()
    const published = new Date(Date.now() - 2 * 86_400_000).toISOString()

    // único candidato disponible cuesta más que el precio congelado al cliente (3.45)
    await createPublication(svc, { supplierId: supOverPrice.id, productId, regionId, minPrice: 4.0, qty: 50, publishedAt: published })

    const candidates = await fetchReplacementCandidates(svc, {
      productId, excludeSupplierId: supRejected.id, cutoffAt,
    })
    const { picks, remaining, skippedOverPrice } = planReplacements(candidates, {
      assignedQuantity: 5, unitPriceFrozen: 3.45,
    })

    expect(picks).toHaveLength(0)
    expect(skippedOverPrice).toBe(true)
    expect(remaining).toBe(5)
  })

  it('FIX A (recepción): un refund propuesto en estado pending NO altera el saldo del cliente', async () => {
    const customer = await createTestUser(svc, { role: 'customer', regionId, fullName: 'Cliente Comp' })
    try {
      const { data: before } = await svc.from('users').select('wallet_balance').eq('id', customer.id).single()
      expect(Number(before?.wallet_balance ?? 0)).toBe(0)

      // Replica lo que ahora hace la recepción: propuesta de crédito, sin tocar saldo.
      const { error } = await svc.from('wallet_transactions').insert({
        user_id: customer.id, type: 'refund', amount: 12.5,
        balance_before: 0, balance_after: 0, status: 'pending',
        notes: 'Compensación propuesta por rechazo en recepción — requiere aprobación de superadmin',
      })
      expect(error).toBeNull()

      const { data: after } = await svc.from('users').select('wallet_balance').eq('id', customer.id).single()
      expect(Number(after?.wallet_balance ?? 0)).toBe(0) // saldo intacto hasta que superadmin apruebe
    } finally {
      await deleteTestUser(svc, customer.id)
    }
  })
})

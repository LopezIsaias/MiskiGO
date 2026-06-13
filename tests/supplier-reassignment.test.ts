import { describe, it, expect } from 'vitest'
import { planReplacements, type ReplacementCandidate } from '@/lib/utils/supplier-assignment'

// Helper para construir candidatos con valores por defecto razonables.
function cand(over: Partial<ReplacementCandidate> & { id: string }): ReplacementCandidate {
  return {
    available_quantity: 100,
    supplier_id: `sup-${over.id}`,
    minimum_price: 2.0,
    published_at: '2026-01-01T00:00:00.000Z',
    supplier: { reputation_score: 100 },
    ...over,
  }
}

describe('planReplacements — orden §4 + guard de margen', () => {
  it('ordena por minimum_price ASC (más barato primero)', () => {
    const candidates = [
      cand({ id: 'caro', minimum_price: 2.5, available_quantity: 10 }),
      cand({ id: 'barato', minimum_price: 1.8, available_quantity: 10 }),
    ]
    const { picks, remaining } = planReplacements(candidates, { assignedQuantity: 5, unitPriceFrozen: 3.45 })
    expect(picks).toHaveLength(1)
    expect(picks[0].pub.id).toBe('barato')
    expect(remaining).toBe(0)
  })

  it('empate de precio → FIFO por published_at ASC', () => {
    const candidates = [
      cand({ id: 'nuevo', minimum_price: 2.0, published_at: '2026-01-02T00:00:00.000Z' }),
      cand({ id: 'viejo', minimum_price: 2.0, published_at: '2026-01-01T00:00:00.000Z' }),
    ]
    const { picks } = planReplacements(candidates, { assignedQuantity: 5, unitPriceFrozen: 3.45 })
    expect(picks[0].pub.id).toBe('viejo')
  })

  it('empate de precio Y fecha → mayor reputation_score primero (FIX B)', () => {
    const candidates = [
      cand({ id: 'baja-rep', supplier: { reputation_score: 60 } }),
      cand({ id: 'alta-rep', supplier: { reputation_score: 95 } }),
    ]
    const { picks } = planReplacements(candidates, { assignedQuantity: 5, unitPriceFrozen: 3.45 })
    expect(picks[0].pub.id).toBe('alta-rep')
  })

  it('descarta candidatos con minimum_price > unitPriceFrozen y marca skippedOverPrice (FIX C)', () => {
    const candidates = [
      cand({ id: 'sobreprecio', minimum_price: 3.6, available_quantity: 10 }),
    ]
    const { picks, remaining, skippedOverPrice } = planReplacements(candidates, {
      assignedQuantity: 5,
      unitPriceFrozen: 3.45,
    })
    expect(picks).toHaveLength(0)
    expect(skippedOverPrice).toBe(true)
    expect(remaining).toBe(5) // gap intacto → ítem irá a 'failed' → panel manual del operador
  })

  it('elige el barato dentro de precio y NO el sobreprecio aunque sea el único con stock extra', () => {
    const candidates = [
      cand({ id: 'ok', minimum_price: 2.0, available_quantity: 3 }),
      cand({ id: 'sobreprecio', minimum_price: 4.0, available_quantity: 100 }),
    ]
    const { picks, remaining, skippedOverPrice } = planReplacements(candidates, {
      assignedQuantity: 5,
      unitPriceFrozen: 3.45,
    })
    expect(picks.map(p => p.pub.id)).toEqual(['ok'])
    expect(picks[0].deduct).toBe(3)
    expect(remaining).toBe(2) // 5 - 3; los 2 restantes NO se cubren con el sobreprecio
    expect(skippedOverPrice).toBe(true)
  })

  it('reparte greedy entre varias publicaciones dentro de precio', () => {
    const candidates = [
      cand({ id: 'a', minimum_price: 2.0, available_quantity: 3 }),
      cand({ id: 'b', minimum_price: 2.2, available_quantity: 10 }),
    ]
    const { picks, remaining } = planReplacements(candidates, { assignedQuantity: 5, unitPriceFrozen: 3.45 })
    expect(picks.map(p => [p.pub.id, p.deduct])).toEqual([['a', 3], ['b', 2]])
    expect(remaining).toBe(0)
  })

  it('precio igual al congelado SÍ es elegible (límite inclusivo)', () => {
    const candidates = [cand({ id: 'limite', minimum_price: 3.45 })]
    const { picks, skippedOverPrice } = planReplacements(candidates, { assignedQuantity: 2, unitPriceFrozen: 3.45 })
    expect(picks).toHaveLength(1)
    expect(skippedOverPrice).toBe(false)
  })
})

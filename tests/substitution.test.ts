import { describe, it, expect } from 'vitest'
import { validateSubstitutionPrice, substitutionPriceDifference, isProposalExpired } from '@/lib/utils/substitution'

describe('validateSubstitutionPrice (tope al original + guard de margen)', () => {
  it('acepta el precio igual al original', () => {
    expect(validateSubstitutionPrice({ original: 10, charged: 10, minimumPrice: 6 }).ok).toBe(true)
  })

  it('acepta un precio menor al original (genera crédito)', () => {
    expect(validateSubstitutionPrice({ original: 10, charged: 7, minimumPrice: 6 }).ok).toBe(true)
  })

  it('rechaza un precio mayor al original (el sustituto no puede costar más)', () => {
    const r = validateSubstitutionPrice({ original: 10, charged: 11, minimumPrice: 6 })
    expect(r.ok).toBe(false)
  })

  it('rechaza un precio por debajo del costo del proveedor (margen negativo)', () => {
    const r = validateSubstitutionPrice({ original: 10, charged: 5, minimumPrice: 6 })
    expect(r.ok).toBe(false)
  })
})

describe('substitutionPriceDifference (crédito a billetera)', () => {
  it('es 0 cuando el precio es igual al original', () => {
    expect(substitutionPriceDifference(10, 10, 3)).toBe(0)
  })

  it('multiplica la diferencia por la cantidad y redondea a 2 decimales', () => {
    // (10 - 7.5) * 4 = 10.00
    expect(substitutionPriceDifference(10, 7.5, 4)).toBe(10)
    // (10 - 9.33) * 3 = 2.01
    expect(substitutionPriceDifference(10, 9.33, 3)).toBe(2.01)
  })
})

describe('isProposalExpired (plazo de respuesta del cliente)', () => {
  const now = new Date('2026-06-24T12:00:00Z')

  it('vence cuando proposedAt + TTL es anterior a now', () => {
    // 49h antes, TTL 48h → vencida
    expect(isProposalExpired('2026-06-22T11:00:00Z', now, 48)).toBe(true)
  })

  it('no vence dentro del plazo', () => {
    // 24h antes, TTL 48h → vigente
    expect(isProposalExpired('2026-06-23T12:00:00Z', now, 48)).toBe(false)
  })

  it('no vence justo en el límite', () => {
    // exactamente 48h antes → now no es estrictamente mayor → vigente
    expect(isProposalExpired('2026-06-22T12:00:00Z', now, 48)).toBe(false)
  })
})

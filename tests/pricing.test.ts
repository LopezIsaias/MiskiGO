import { describe, it, expect } from 'vitest'
import {
  calculateSalePrice,
  getNextDispatchDate,
  getClaimWindowExpiry,
  isCutoffPassed,
} from '@/lib/utils'

describe('calculateSalePrice (precio de venta, vista cliente)', () => {
  it('aplica la fórmula precio / (1 - costo - margen) y redondea hacia arriba', () => {
    // 10 / (1 - 0.25 - 0.20) = 10 / 0.55 = 18.1818 → ceil a 2 dec = 18.19
    expect(calculateSalePrice(10, 0.25, 0.2)).toBe(18.19)
  })

  it('usa el proveedor más caro (precio mínimo más alto)', () => {
    const cheap = calculateSalePrice(5, 0.2, 0.2)
    const expensive = calculateSalePrice(8, 0.2, 0.2)
    expect(expensive).toBeGreaterThan(cheap)
  })

  it('lanza error si el denominador es <= 0 (costos + margen >= 100%)', () => {
    expect(() => calculateSalePrice(10, 0.6, 0.5)).toThrow()
    expect(() => calculateSalePrice(10, 0.5, 0.5)).toThrow()
  })

  it('nunca devuelve un precio menor al mínimo del proveedor', () => {
    const price = calculateSalePrice(12.5, 0.3, 0.25)
    expect(price).toBeGreaterThanOrEqual(12.5)
  })
})

describe('getNextDispatchDate (martes=2 / viernes=5)', () => {
  it('siempre cae en martes o viernes', () => {
    for (let offset = 0; offset < 14; offset++) {
      const base = new Date(2026, 0, 1 + offset)
      const next = getNextDispatchDate(base)
      expect([2, 5]).toContain(next.getDay())
    }
  })

  it('devuelve una fecha futura (o el mismo día normalizado)', () => {
    const base = new Date(2026, 0, 1, 15, 0, 0)
    const next = getNextDispatchDate(base)
    expect(next.getTime()).toBeGreaterThanOrEqual(new Date(2026, 0, 1, 0, 0, 0).getTime())
  })
})

describe('getClaimWindowExpiry (ventana de reclamo 2h)', () => {
  it('expira exactamente 2 horas después de la entrega', () => {
    const deliveredAt = '2026-06-01T10:00:00.000Z'
    const expiry = getClaimWindowExpiry(deliveredAt)
    const diffMs = expiry.getTime() - new Date(deliveredAt).getTime()
    expect(diffMs).toBe(2 * 60 * 60 * 1000)
  })
})

describe('isCutoffPassed', () => {
  it('true si el corte ya pasó', () => {
    expect(isCutoffPassed(new Date(Date.now() - 1000))).toBe(true)
  })
  it('false si el corte es futuro', () => {
    expect(isCutoffPassed(new Date(Date.now() + 60_000))).toBe(false)
  })
})

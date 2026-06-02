import { describe, it, expect } from 'vitest'
import { seriesForReceiptType, formatReceiptNumber } from '@/lib/utils/receipt'

describe('seriesForReceiptType (serie del comprobante)', () => {
  it('boleta usa serie B001', () => {
    expect(seriesForReceiptType('boleta')).toBe('B001')
  })
  it('factura usa serie F001', () => {
    expect(seriesForReceiptType('factura')).toBe('F001')
  })
  it('tipo desconocido usa fallback X001', () => {
    expect(seriesForReceiptType('nota')).toBe('X001')
  })
})

describe('formatReceiptNumber (numeración SERIE-00000000)', () => {
  it('rellena el correlativo a 8 dígitos', () => {
    expect(formatReceiptNumber('B001', 1)).toBe('B001-00000001')
    expect(formatReceiptNumber('F001', 123)).toBe('F001-00000123')
  })
  it('no trunca correlativos de más de 8 dígitos', () => {
    expect(formatReceiptNumber('B001', 123456789)).toBe('B001-123456789')
  })
  it('correlativos consecutivos producen números distintos y ordenables', () => {
    const a = formatReceiptNumber('B001', 9)
    const b = formatReceiptNumber('B001', 10)
    expect(a).not.toBe(b)
    expect(a < b).toBe(true) // 00000009 < 00000010 lexicográficamente
  })
})

import { describe, it, expect } from 'vitest'
import { formatCurrency, toSlug, toWANumber } from '@/lib/utils'

describe('formatCurrency (soles)', () => {
  it('formatea con prefijo S/ y 2 decimales', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00')
    expect(formatCurrency(18.1)).toBe('S/ 18.10')
    expect(formatCurrency(1234.5)).toBe('S/ 1234.50')
  })
})

describe('toSlug', () => {
  it('normaliza acentos y espacios a kebab-case', () => {
    expect(toSlug('Plátano Orgánico')).toBe('platano-organico')
  })
  it('elimina caracteres especiales y guiones de borde', () => {
    expect(toSlug('  ¡Café! 100% ')).toBe('cafe-100')
  })
})

describe('toWANumber (normalización de teléfono peruano para WhatsApp)', () => {
  it('antepone 51 a un celular de 9 dígitos', () => {
    expect(toWANumber('987654321')).toBe('51987654321')
  })
  it('mantiene un número que ya incluye 51', () => {
    expect(toWANumber('51987654321')).toBe('51987654321')
  })
  it('devuelve null para entradas inválidas o nulas', () => {
    expect(toWANumber(null)).toBeNull()
    expect(toWANumber('123')).toBeNull()
  })
})

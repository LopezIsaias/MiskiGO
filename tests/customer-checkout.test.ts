import { describe, it, expect } from 'vitest'
import { checkoutSchema } from '@/lib/validations/customer'

const validBase = {
  items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 2 }],
  delivery_address: 'Jr. Los Cedros 123, Tarapoto',
  payment_method: 'yape' as const,
  use_wallet: false,
  receipt_type: 'boleta' as const,
  receipt_document: '12345678',
  receipt_name: 'Juan Pérez',
}

describe('checkoutSchema — comprobante boleta', () => {
  it('acepta boleta con DNI de 8 dígitos', () => {
    expect(checkoutSchema.safeParse(validBase).success).toBe(true)
  })

  it('rechaza boleta con DNI != 8 dígitos (apunta a receipt_document)', () => {
    const res = checkoutSchema.safeParse({ ...validBase, receipt_document: '1234567' })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues.some(i => i.path.includes('receipt_document'))).toBe(true)
    }
  })
})

describe('checkoutSchema — comprobante factura', () => {
  it('acepta factura con RUC de 11 dígitos', () => {
    const res = checkoutSchema.safeParse({
      ...validBase,
      receipt_type: 'factura',
      receipt_document: '20123456789',
      receipt_name: 'Mi Empresa S.A.C.',
    })
    expect(res.success).toBe(true)
  })

  it('rechaza factura con documento de 8 dígitos (debe ser RUC de 11)', () => {
    const res = checkoutSchema.safeParse({
      ...validBase,
      receipt_type: 'factura',
      receipt_document: '12345678',
      receipt_name: 'Mi Empresa S.A.C.',
    })
    expect(res.success).toBe(false)
  })
})

describe('checkoutSchema — reglas generales', () => {
  it('rechaza carrito vacío', () => {
    expect(checkoutSchema.safeParse({ ...validBase, items: [] }).success).toBe(false)
  })

  it('rechaza nombre/razón social demasiado corto', () => {
    expect(checkoutSchema.safeParse({ ...validBase, receipt_name: 'Jo' }).success).toBe(false)
  })

  it('rechaza método de pago inválido', () => {
    expect(checkoutSchema.safeParse({ ...validBase, payment_method: 'paypal' }).success).toBe(false)
  })

  it('rechaza dirección demasiado corta', () => {
    expect(checkoutSchema.safeParse({ ...validBase, delivery_address: 'abc' }).success).toBe(false)
  })

  it('acepta los tres métodos de pago válidos', () => {
    for (const payment_method of ['yape', 'transfer', 'wallet'] as const) {
      expect(checkoutSchema.safeParse({ ...validBase, payment_method }).success).toBe(true)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { registerSchema, registerApiSchema, loginSchema } from '@/lib/validations/auth'

const validCustomer = {
  role: 'customer' as const,
  full_name: 'María López',
  email: 'maria@example.com',
  phone: '987654321',
  dni: '12345678',
  region_id: 'region-1',
  password: 'secret123',
  confirm_password: 'secret123',
}

describe('registerSchema (registro customer/supplier)', () => {
  it('acepta un customer válido', () => {
    expect(registerSchema.safeParse(validCustomer).success).toBe(true)
  })

  it('rechaza DNI que no tenga 8 dígitos', () => {
    expect(registerSchema.safeParse({ ...validCustomer, dni: '1234567' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validCustomer, dni: '123456789' }).success).toBe(false)
  })

  it('rechaza nombre con números', () => {
    expect(registerSchema.safeParse({ ...validCustomer, full_name: 'Juan 3' }).success).toBe(false)
  })

  it('rechaza contraseñas que no coinciden', () => {
    const res = registerSchema.safeParse({ ...validCustomer, confirm_password: 'otra1234' })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues.some(i => i.path.includes('confirm_password'))).toBe(true)
    }
  })

  it('rechaza contraseña de menos de 8 caracteres', () => {
    expect(registerSchema.safeParse({ ...validCustomer, password: 'short', confirm_password: 'short' }).success).toBe(false)
  })

  it('acepta RUC válido (11 dígitos) y rechaza RUC inválido', () => {
    expect(registerApiSchema.safeParse({ ...validCustomer, role: 'supplier', ruc: '20123456789' }).success).toBe(true)
    expect(registerApiSchema.safeParse({ ...validCustomer, role: 'supplier', ruc: '2012345678' }).success).toBe(false)
  })

  it('permite RUC omitido (opcional)', () => {
    expect(registerApiSchema.safeParse(validCustomer).success).toBe(true)
  })

  it('rechaza teléfono con letras', () => {
    expect(registerSchema.safeParse({ ...validCustomer, phone: '98765abc' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('acepta email + password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
  it('rechaza email inválido', () => {
    expect(loginSchema.safeParse({ email: 'no-email', password: 'x' }).success).toBe(false)
  })
})

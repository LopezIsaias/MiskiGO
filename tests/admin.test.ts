import { describe, it, expect } from 'vitest'
import { systemParamsSchema, categorySchema, createUserSchema } from '@/lib/validations/admin'

describe('systemParamsSchema (parámetros del sistema, superadmin)', () => {
  const base = { cutoff_hour: 12, claim_window_hours: 2, categories: [] }

  it('acepta valores válidos', () => {
    expect(systemParamsSchema.safeParse(base).success).toBe(true)
  })
  it('rechaza cutoff_hour fuera de 0–23', () => {
    expect(systemParamsSchema.safeParse({ ...base, cutoff_hour: 24 }).success).toBe(false)
    expect(systemParamsSchema.safeParse({ ...base, cutoff_hour: -1 }).success).toBe(false)
  })
  it('rechaza claim_window_hours fuera de 1–72', () => {
    expect(systemParamsSchema.safeParse({ ...base, claim_window_hours: 0 }).success).toBe(false)
    expect(systemParamsSchema.safeParse({ ...base, claim_window_hours: 73 }).success).toBe(false)
  })
  it('rechaza horas no enteras', () => {
    expect(systemParamsSchema.safeParse({ ...base, cutoff_hour: 12.5 }).success).toBe(false)
  })
})

describe('categorySchema (CRUD de categorías, superadmin)', () => {
  const base = {
    name: 'Frágiles',
    operational_cost_pct: 30,
    suggested_margin_pct: 22,
    estimated_waste_pct: 15,
    is_active: true,
  }
  it('acepta una categoría válida', () => {
    expect(categorySchema.safeParse(base).success).toBe(true)
  })
  it('rechaza porcentajes >= 100', () => {
    expect(categorySchema.safeParse({ ...base, operational_cost_pct: 100 }).success).toBe(false)
  })
  it('rechaza nombre demasiado corto', () => {
    expect(categorySchema.safeParse({ ...base, name: 'A' }).success).toBe(false)
  })
})

describe('createUserSchema (crear operador/repartidor, superadmin)', () => {
  const base = {
    full_name: 'Carlos Ruiz',
    dni: '87654321',
    email: 'carlos@example.com',
    phone: '987654321',
    role: 'operator' as const,
    password: 'secret123',
  }
  it('acepta operator y delivery', () => {
    expect(createUserSchema.safeParse(base).success).toBe(true)
    expect(createUserSchema.safeParse({ ...base, role: 'delivery' }).success).toBe(true)
  })
  it('rechaza roles que el superadmin no crea por aquí (p.ej. customer)', () => {
    expect(createUserSchema.safeParse({ ...base, role: 'customer' }).success).toBe(false)
  })
  it('rechaza DNI inválido', () => {
    expect(createUserSchema.safeParse({ ...base, dni: '123' }).success).toBe(false)
  })
})

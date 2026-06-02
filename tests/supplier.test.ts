import { describe, it, expect } from 'vitest'
import { publicationSchema } from '@/lib/validations/supplier'
import { comparePublicationsForAssignment } from '@/lib/utils/supplier-assignment'

const validPub = {
  product_id: '11111111-1111-4111-8111-111111111111',
  region_id: '22222222-2222-4222-8222-222222222222',
  available_quantity: 100,
  minimum_price: 5.5,
  expires_at: '2026-06-05T12:00:00.000Z',
}

describe('publicationSchema (publicación del proveedor)', () => {
  it('acepta una publicación válida', () => {
    expect(publicationSchema.safeParse(validPub).success).toBe(true)
  })
  it('rechaza cantidad <= 0', () => {
    expect(publicationSchema.safeParse({ ...validPub, available_quantity: 0 }).success).toBe(false)
  })
  it('rechaza precio mínimo <= 0', () => {
    expect(publicationSchema.safeParse({ ...validPub, minimum_price: 0 }).success).toBe(false)
  })
  it('rechaza product_id no-UUID', () => {
    expect(publicationSchema.safeParse({ ...validPub, product_id: 'abc' }).success).toBe(false)
  })
})

describe('comparePublicationsForAssignment (orden de asignación CLAUDE.md §4)', () => {
  const mk = (minimum_price: number, published_at: string, reputation_score: number) => ({
    minimum_price,
    published_at,
    supplier: { reputation_score },
  })

  it('ordena por precio mínimo ascendente', () => {
    const pubs = [mk(8, '2026-01-01', 100), mk(5, '2026-01-01', 100), mk(6, '2026-01-01', 100)]
    const sorted = [...pubs].sort(comparePublicationsForAssignment)
    expect(sorted.map(p => p.minimum_price)).toEqual([5, 6, 8])
  })

  it('en empate de precio, prioriza el publicado primero (FIFO)', () => {
    const pubs = [mk(5, '2026-01-03', 100), mk(5, '2026-01-01', 100), mk(5, '2026-01-02', 100)]
    const sorted = [...pubs].sort(comparePublicationsForAssignment)
    expect(sorted.map(p => p.published_at)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('en empate de precio y fecha, prioriza mayor reputación', () => {
    const pubs = [mk(5, '2026-01-01', 70), mk(5, '2026-01-01', 95), mk(5, '2026-01-01', 80)]
    const sorted = [...pubs].sort(comparePublicationsForAssignment)
    expect(sorted.map(p => p.supplier.reputation_score)).toEqual([95, 80, 70])
  })

  it('trata reputación faltante como 0 (queda al final)', () => {
    const a = { minimum_price: 5, published_at: '2026-01-01', supplier: null }
    const b = { minimum_price: 5, published_at: '2026-01-01', supplier: { reputation_score: 50 } }
    const sorted = [a, b].sort(comparePublicationsForAssignment)
    expect(sorted[0]).toBe(b)
  })
})

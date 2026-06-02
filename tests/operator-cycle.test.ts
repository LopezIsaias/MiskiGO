import { describe, it, expect } from 'vitest'
import { nextCycleStatus, CYCLE_TRANSITIONS } from '@/lib/constants'

describe('nextCycleStatus (transiciones del ciclo de despacho, vista operador)', () => {
  it('open → closed', () => {
    expect(nextCycleStatus('open')).toBe('closed')
  })
  it('closed → in_progress', () => {
    expect(nextCycleStatus('closed')).toBe('in_progress')
  })
  it('in_progress → completed', () => {
    expect(nextCycleStatus('in_progress')).toBe('completed')
  })
  it('completed es terminal (null)', () => {
    expect(nextCycleStatus('completed')).toBeNull()
  })
  it('estado desconocido devuelve null', () => {
    expect(nextCycleStatus('cualquiera')).toBeNull()
  })
  it('no permite saltarse pasos (open no va directo a in_progress)', () => {
    expect(nextCycleStatus('open')).not.toBe('in_progress')
  })
  it('el mapa de transiciones es lineal y sin ciclos', () => {
    expect(Object.keys(CYCLE_TRANSITIONS)).toEqual(['open', 'closed', 'in_progress'])
  })
})

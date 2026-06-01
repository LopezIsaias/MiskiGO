'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Preset = 'this_week' | 'last_week' | 'last_30' | 'custom'

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(mon.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeFor(preset: Preset): { from: string; to: string } | null {
  if (preset === 'custom') return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (preset === 'this_week') {
    return { from: toISO(getMonday(today)), to: toISO(today) }
  }
  if (preset === 'last_week') {
    const mon = getMonday(today)
    mon.setDate(mon.getDate() - 7)
    const sun = new Date(mon)
    sun.setDate(sun.getDate() + 6)
    return { from: toISO(mon), to: toISO(sun) }
  }
  const from = new Date(today)
  from.setDate(from.getDate() - 29)
  return { from: toISO(from), to: toISO(today) }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_week', label: 'Esta semana' },
  { key: 'last_week', label: 'Sem. anterior' },
  { key: 'last_30',   label: 'Últimos 30 días' },
  { key: 'custom',    label: 'Personalizado' },
]

const inputCls =
  'border border-miski-sage rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors text-gray-800'

interface Props { preset: string; from: string; to: string }

export function DateFilter({ preset, from, to }: Props) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo,   setCustomTo]   = useState(to)

  function apply(p: Preset) {
    if (p === 'custom') {
      if (customFrom && customTo)
        router.push(`/admin?preset=custom&from=${customFrom}&to=${customTo}`)
      return
    }
    const range = rangeFor(p)!
    router.push(`/admin?preset=${p}&from=${range.from}&to=${range.to}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => apply(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            preset === key
              ? 'bg-miski-forest text-white border-miski-forest'
              : 'bg-white border-miski-sage text-miski-forest hover:bg-miski-cream/50'
          }`}
        >
          {label}
        </button>
      ))}

      {preset === 'custom' && (
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs text-miski-olive">→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => apply('custom')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-miski-forest text-white hover:bg-miski-green transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}

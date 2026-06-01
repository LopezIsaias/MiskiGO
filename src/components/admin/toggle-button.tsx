'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ToggleButtonProps {
  id: string
  isActive: boolean
  endpoint: 'categories' | 'products'
}

export function ToggleButton({ id, isActive, endpoint }: ToggleButtonProps) {
  const router = useRouter()
  const [active, setActive] = useState(isActive)
  const [, startTransition] = useTransition()

  async function toggle() {
    const next = !active
    setActive(next)
    const res = await fetch(`/api/admin/${endpoint}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      setActive(active)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-miski-lime text-miski-forest hover:bg-miski-lime/80'
          : 'bg-miski-sage/50 text-miski-forest/60 hover:bg-miski-sage/70'
      }`}
    >
      {active ? 'Activa' : 'Inactiva'}
    </button>
  )
}

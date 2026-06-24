'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export interface SubstitutionProposal {
  id:               string
  orderId:          string
  originalName:     string
  substituteName:   string
  quantity:         number
  unit:             string
  chargedUnitPrice: number
  priceDifference:  number
}

// Banner de propuesta de sustitución para el cliente: acepta o rechaza un producto
// alternativo por un ítem que se quedó sin stock. Al rechazar, se procesa el reembolso.
export function SubstitutionProposalBanner({ proposal }: { proposal: SubstitutionProposal }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function respond(action: 'accept' | 'reject') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/customer/orders/${proposal.orderId}/substitution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substitutionId: proposal.id, action }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'No se pudo procesar tu respuesta')
        return
      }
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-miski-gold/40 bg-miski-gold-light/25 px-4 py-3 space-y-2">
      <p className="text-sm text-miski-forest">
        <span className="font-semibold">{proposal.originalName}</span> se agotó. Te ofrecemos{' '}
        <span className="font-semibold">{proposal.substituteName}</span> ({proposal.quantity} {proposal.unit}) en su lugar,
        a {formatCurrency(proposal.chargedUnitPrice)}/{proposal.unit}.
      </p>
      {proposal.priceDifference > 0 && (
        <p className="text-xs text-miski-forest/80">
          Te acreditaremos {formatCurrency(proposal.priceDifference)} de diferencia a tu billetera (al aprobarse).
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void respond('accept')}
          disabled={busy !== null}
          className="text-xs font-semibold text-white bg-miski-green hover:bg-miski-forest rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
        >
          {busy === 'accept' ? 'Aceptando…' : 'Aceptar cambio'}
        </button>
        <button
          onClick={() => void respond('reject')}
          disabled={busy !== null}
          className="text-xs font-semibold text-miski-forest border border-miski-border hover:bg-white rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
        >
          {busy === 'reject' ? 'Rechazando…' : 'Rechazar y reembolsar'}
        </button>
      </div>
    </div>
  )
}

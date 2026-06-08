'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  orderId:          string
  alreadyRequested: boolean
}

export function CancelOrderButton({ orderId, alreadyRequested }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(alreadyRequested)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/cancel-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo solicitar la cancelación')
        return
      }
      setRequested(true)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (requested) {
    return (
      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
        <p className="text-xs text-amber-800">
          Cancelación solicitada. Un operador la revisará y procesará tu reembolso.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700"
      >
        Solicitar cancelación
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3 space-y-2">
      <p className="text-xs text-gray-600">
        Tu pedido ya está pagado. La cancelación y el reembolso serán revisados y aprobados o denegados por un operador en un plazo máximo de 2 horas.
      </p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        rows={2}
        className="w-full border border-miski-sage rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800 resize-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Enviando...' : 'Confirmar solicitud'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 border border-miski-sage hover:bg-white transition-colors"
        >
          Volver
        </button>
      </div>
    </div>
  )
}

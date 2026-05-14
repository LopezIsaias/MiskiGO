'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  open:        'Abierto',
  closed:      'Cerrado',
  in_progress: 'En progreso',
  completed:   'Completado',
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  closed:      'bg-amber-100 text-amber-700',
  in_progress: 'bg-green-100 text-green-700',
  completed:   'bg-gray-100 text-gray-500',
}

const NEXT_STATUS: Record<string, string> = {
  open:        'closed',
  closed:      'in_progress',
  in_progress: 'completed',
}

const NEXT_LABEL: Record<string, string> = {
  open:        'Cerrar ciclo (corte de pedidos)',
  closed:      'Iniciar despacho',
  in_progress: 'Marcar como completado',
}

interface Props {
  cycleId: string
  currentStatus: string
  dispatchDate: string
}

export function CycleStatusControl({ cycleId, currentStatus, dispatchDate }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nextStatus = NEXT_STATUS[currentStatus]

  const formattedDate = new Date(dispatchDate + 'T12:00:00').toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleTransition() {
    if (!nextStatus) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/operator/cycle/${cycleId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: nextStatus }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al actualizar el estado.')
        return
      }

      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Fecha de despacho</p>
          <p className="text-sm font-semibold text-gray-800 capitalize">{formattedDate}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${STATUS_COLORS[currentStatus] ?? 'bg-gray-100 text-gray-500'}`}>
          {STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>

      {nextStatus ? (
        <div>
          <button
            onClick={handleTransition}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Actualizando…' : NEXT_LABEL[currentStatus]}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Este ciclo ha sido completado.</p>
      )}
    </div>
  )
}

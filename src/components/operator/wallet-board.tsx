'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export interface RechargeRow {
  id:         string
  amount:     number
  notes:      string | null
  proof_url:  string | null
  created_at: string
  customer:   { full_name: string; phone: string | null } | null
}

interface CardProps { tx: RechargeRow }

function RechargeCard({ tx }: CardProps) {
  const router = useRouter()
  const [rejecting,       setRejecting]       = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')
  const [done,            setDone]            = useState(false)

  const methodLabel = tx.notes?.includes('Yape') ? 'Yape' : 'Transferencia'

  async function handle(action: 'approve' | 'reject') {
    if (action === 'reject' && rejectionReason.trim().length < 5) {
      setError('Ingresa un motivo de al menos 5 caracteres.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = action === 'approve'
        ? { action: 'approve' }
        : { action: 'reject', reason: rejectionReason.trim() }

      const res = await fetch(`/api/operator/wallet/${tx.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al procesar la recarga.')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-3">
        <p className="text-xs text-gray-400">Recarga procesada.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4">
        {tx.proof_url && (
          <a href={tx.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tx.proof_url}
              alt="Comprobante"
              className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
            />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{tx.customer?.full_name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{methodLabel} · {formatDateTime(tx.created_at)}</p>
          <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(tx.amount)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
        {!rejecting ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handle('approve')}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Procesando…' : 'Aprobar'}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 border border-gray-300 hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Rechazar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Motivo del rechazo…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handle('reject')}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Procesando…' : 'Confirmar rechazo'}
              </button>
              <button
                type="button"
                onClick={() => { setRejecting(false); setError('') }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 border border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  )
}

interface Props {
  pending: RechargeRow[]
}

export function WalletBoard({ pending }: Props) {
  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-200 p-6 text-center">
          No hay recargas pendientes de revisión.
        </p>
      ) : (
        pending.map(tx => <RechargeCard key={tx.id} tx={tx} />)
      )}
    </div>
  )
}

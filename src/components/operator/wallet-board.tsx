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
      <div className="bg-miski-cream/30 rounded-xl border border-miski-sage/40 px-5 py-3">
        <p className="text-xs text-miski-olive">Recarga procesada.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4">
        {tx.proof_url && (
          <a href={tx.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tx.proof_url}
              alt="Comprobante"
              className="w-20 h-20 object-cover rounded-lg border border-miski-sage/40 hover:opacity-80 transition-opacity"
            />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-miski-forest">{tx.customer?.full_name ?? '—'}</p>
          <p className="text-xs text-miski-olive mt-0.5">{methodLabel} · {formatDateTime(tx.created_at)}</p>
          <p className="text-lg font-bold text-miski-forest mt-1">{formatCurrency(tx.amount)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 space-y-3 border-t border-miski-sage/20 pt-3">
        {!rejecting ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handle('approve')}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-miski-forest hover:bg-miski-green disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {saving ? 'Procesando…' : 'Aprobar'}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-miski-sage text-miski-forest hover:bg-miski-sage/30 transition-colors"
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
              className="w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handle('reject')}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Procesando…' : 'Confirmar rechazo'}
              </button>
              <button
                type="button"
                onClick={() => { setRejecting(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-miski-sage text-miski-forest hover:bg-miski-sage/30 transition-colors"
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
        <p className="text-sm text-miski-olive bg-white rounded-xl border border-miski-sage/40 shadow-sm p-6 text-center">
          No hay recargas pendientes de revisión.
        </p>
      ) : (
        pending.map(tx => <RechargeCard key={tx.id} tx={tx} />)
      )}
    </div>
  )
}

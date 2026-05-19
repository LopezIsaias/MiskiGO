'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export interface CreditRow {
  id:              string
  type:            string
  amount:          number
  notes:           string | null
  created_at:      string
  customer:        { full_name: string; phone: string | null } | null
  reference_order: { id: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  refund:     'Crédito por reclamo',
  bonus:      'Bono',
  adjustment: 'Ajuste manual',
}

interface CardProps { credit: CreditRow }

function CreditCard({ credit }: CardProps) {
  const router = useRouter()
  const [rejecting,       setRejecting]       = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')
  const [done,            setDone]            = useState(false)

  const orderId = credit.reference_order?.id.slice(0, 8).toUpperCase()

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

      const res = await fetch(`/api/admin/wallet/${credit.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al procesar el crédito.')
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
        <p className="text-xs text-gray-400">Crédito procesado.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{credit.customer?.full_name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {TYPE_LABEL[credit.type] ?? credit.type} · {formatDateTime(credit.created_at)}
          </p>
          {orderId && (
            <p className="text-xs text-gray-400 mt-0.5">Pedido #{orderId}</p>
          )}
          {credit.notes && (
            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-3 py-2 italic">
              {credit.notes}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xl font-bold text-blue-700">{formatCurrency(credit.amount)}</span>
      </div>

      {!rejecting ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handle('approve')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Procesando…' : 'Aprobar crédito'}
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
  )
}

interface Props {
  pending: CreditRow[]
}

export function WalletCreditsBoard({ pending }: Props) {
  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-200 p-6 text-center">
          No hay créditos pendientes de aprobación.
        </p>
      ) : (
        pending.map(c => <CreditCard key={c.id} credit={c} />)
      )}
    </div>
  )
}

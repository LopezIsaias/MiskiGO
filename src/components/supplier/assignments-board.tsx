'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'

export interface AssignmentRow {
  id:                    string
  assigned_quantity:     number
  supplier_price_frozen: number
  status:                string
  order_item: {
    product: { name: string; unit: string } | null
    order: {
      id: string
      dispatch_cycle: { dispatch_date: string } | null
    } | null
  } | null
}

interface CardProps { assignment: AssignmentRow }

function AssignmentCard({ assignment: a }: CardProps) {
  const router = useRouter()
  const [showReject, setShowReject] = useState(false)
  const [reason,     setReason]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)
  const [doneAction, setDoneAction] = useState<'confirmed' | 'failed' | null>(null)

  const product    = a.order_item?.product
  const order      = a.order_item?.order
  const cycleDate  = order?.dispatch_cycle?.dispatch_date

  async function handleAction(action: 'confirm' | 'fail') {
    if (action === 'fail' && !reason.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/supplier/assignments/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'confirm'
            ? { action: 'confirm' }
            : { action: 'fail', reason: reason.trim() }
        ),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al procesar.')
        return
      }
      setDoneAction(action === 'confirm' ? 'confirmed' : 'failed')
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
      <div className={`rounded-xl border p-4 ${
        doneAction === 'confirmed'
          ? 'border-green-200 bg-green-50'
          : 'border-red-200 bg-red-50'
      }`}>
        <p className={`text-sm font-semibold ${
          doneAction === 'confirmed' ? 'text-green-700' : 'text-red-600'
        }`}>
          {doneAction === 'confirmed' ? '✓ Confirmado correctamente' : '✕ Rechazo registrado'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{product?.name ?? '—'}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{product?.name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {a.assigned_quantity} {product?.unit} · {formatCurrency(a.supplier_price_frozen)} por unidad
          </p>
        </div>
        {cycleDate && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Entrega</p>
            <p className="text-xs font-semibold text-gray-700">{formatDate(cycleDate + 'T12:00:00')}</p>
          </div>
        )}
      </div>

      {order && (
        <p className="text-[11px] text-gray-400">
          Pedido #{order.id.slice(0, 8).toUpperCase()}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!showReject ? (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
          >
            No puedo cumplir
          </button>
          <button
            type="button"
            onClick={() => handleAction('confirm')}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Motivo por el que no puedes cumplir (obligatorio)…"
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowReject(false); setReason(''); setError('') }}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleAction('fail')}
              disabled={saving || !reason.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enviando…' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props { assignments: AssignmentRow[] }

export function AssignmentsBoard({ assignments }: Props) {
  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">No tienes pedidos pendientes de confirmación.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {assignments.map(a => (
        <AssignmentCard key={a.id} assignment={a} />
      ))}
    </div>
  )
}

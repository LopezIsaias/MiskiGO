'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime, formatCurrency } from '@/lib/utils'

export interface ClaimRow {
  id:               string
  status:           string
  claimed_quantity: number
  reason:           string
  photo_url:        string
  created_at:       string
  resolution_type:  string | null
  resolution_amount: number | null
  is_justified:     boolean | null
  resolved_at:      string | null
  customer:         { full_name: string; phone: string | null } | null
  order:            { id: string; delivery_address: string } | null
  product:          { name: string; unit: string } | null
  resolver:         { full_name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending:             'Pendiente',
  approved:            'Aprobado',
  partially_approved:  'Aprobado parcialmente',
  rejected:            'Rechazado',
}

const STATUS_COLOR: Record<string, string> = {
  pending:             'bg-yellow-100 text-yellow-800',
  approved:            'bg-green-100 text-green-800',
  partially_approved:  'bg-blue-100 text-blue-800',
  rejected:            'bg-red-100 text-red-800',
}

const RESOLUTION_LABEL: Record<string, string> = {
  wallet_credit:  'Crédito en billetera',
  external_refund: 'Reembolso externo (Yape/transferencia)',
  reprogrammed:   'Reprogramar entrega',
}

// ── Single claim card ────────────────────────────────────────────────────────

interface CardProps { claim: ClaimRow }

function ClaimCard({ claim }: CardProps) {
  const router = useRouter()
  const isPending = claim.status === 'pending'

  type Verdict = 'approved' | 'partially_approved' | 'rejected'
  const [verdict,          setVerdict]          = useState<Verdict | null>(null)
  const [resolutionType,   setResolutionType]   = useState<'wallet_credit' | 'external_refund' | 'reprogrammed' | ''>('')
  const [resolutionAmount, setResolutionAmount] = useState('')
  const [isJustified,      setIsJustified]      = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [resolved,         setResolved]         = useState(false)

  const needsType   = verdict === 'approved' || verdict === 'partially_approved'
  const needsAmount = resolutionType === 'wallet_credit' || resolutionType === 'external_refund'

  const canSubmit =
    verdict !== null &&
    (!needsType   || resolutionType !== '') &&
    (!needsAmount || (parseFloat(resolutionAmount) > 0))

  async function handleResolve() {
    if (!verdict || !canSubmit) return
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        status:       verdict,
        is_justified: verdict === 'rejected' ? false : isJustified,
        resolution_type:   needsType   ? (resolutionType || null) : null,
        resolution_amount: needsAmount ? parseFloat(resolutionAmount) : null,
      }
      const res = await fetch(`/api/operator/claims/${claim.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al resolver el reclamo.')
        return
      }
      setResolved(true)
      router.refresh()
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  const orderId = claim.order?.id.slice(0, 8).toUpperCase() ?? '—'

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${
      isPending ? 'border-yellow-200' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4 border-b border-gray-100">
        {/* Photo */}
        <a href={claim.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={claim.photo_url}
            alt="Foto del reclamo"
            className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
          />
        </a>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[claim.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[claim.status] ?? claim.status}
            </span>
            <span className="text-xs text-gray-400">{formatDateTime(claim.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {claim.customer?.full_name ?? '—'} · Pedido #{orderId}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {claim.product?.name ?? '—'} · {claim.claimed_quantity} {claim.product?.unit}
          </p>
          <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded-lg px-3 py-2 italic">
            &ldquo;{claim.reason}&rdquo;
          </p>
        </div>
      </div>

      {/* Resolved summary */}
      {!isPending && (
        <div className="px-5 py-3 text-xs text-gray-500 space-y-0.5">
          {claim.resolution_type && (
            <p>Resolución: <span className="font-medium text-gray-700">{RESOLUTION_LABEL[claim.resolution_type] ?? claim.resolution_type}</span></p>
          )}
          {claim.resolution_amount && (
            <p>Monto: <span className="font-medium text-gray-700">{formatCurrency(claim.resolution_amount)}</span></p>
          )}
          <p>Justificado: <span className="font-medium text-gray-700">{claim.is_justified ? 'Sí' : 'No'}</span></p>
          {claim.resolver && claim.resolved_at && (
            <p>Resuelto por <span className="font-medium text-gray-700">{claim.resolver.full_name}</span> el {formatDateTime(claim.resolved_at)}</p>
          )}
        </div>
      )}

      {/* Resolve form — pending only */}
      {isPending && !resolved && (
        <div className="px-5 py-4 space-y-4 bg-gray-50 border-t border-gray-100">
          {/* Verdict */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Decisión</p>
            <div className="flex gap-2 flex-wrap">
              {(['approved', 'partially_approved', 'rejected'] as Verdict[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerdict(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    verdict === v
                      ? v === 'rejected'
                        ? 'bg-red-600 text-white border-red-600'
                        : v === 'approved'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {v === 'approved' ? 'Aprobar' : v === 'partially_approved' ? 'Aprobar parcialmente' : 'Rechazar'}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution type — only if not rejected */}
          {needsType && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Tipo de resolución</p>
              <div className="space-y-1.5">
                {(['wallet_credit', 'external_refund', 'reprogrammed'] as const).map(rt => (
                  <label key={rt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`rt-${claim.id}`}
                      checked={resolutionType === rt}
                      onChange={() => setResolutionType(rt)}
                      className="accent-green-600"
                    />
                    <span className="text-xs text-gray-700">{RESOLUTION_LABEL[rt]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Amount — only for wallet_credit or external_refund */}
          {needsAmount && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Monto a {resolutionType === 'wallet_credit' ? 'acreditar' : 'reembolsar'} (S/)
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={resolutionAmount}
                onChange={e => setResolutionAmount(e.target.value)}
                placeholder="0.00"
                className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
              {resolutionType === 'wallet_credit' && (
                <p className="text-xs text-gray-400 mt-1">
                  Quedará pendiente de aprobación por el superadmin.
                </p>
              )}
            </div>
          )}

          {/* Justified — only if not rejected */}
          {verdict && verdict !== 'rejected' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isJustified}
                onChange={e => setIsJustified(e.target.checked)}
                className="w-4 h-4 accent-green-600"
              />
              <span className="text-xs text-gray-700">Reclamo justificado (afecta reputación del proveedor)</span>
            </label>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={() => void handleResolve()}
            disabled={saving || !canSubmit}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando…' : 'Confirmar resolución'}
          </button>
        </div>
      )}

      {resolved && (
        <div className="px-5 py-3 bg-green-50 border-t border-green-200">
          <p className="text-xs text-green-800 font-medium">Reclamo resuelto correctamente.</p>
        </div>
      )}
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

interface Props {
  pending:  ClaimRow[]
  resolved: ClaimRow[]
}

export function ClaimsBoard({ pending, resolved }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-200 p-6 text-center">
            No hay reclamos pendientes.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map(c => <ClaimCard key={c.id} claim={c} />)}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Resueltos ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map(c => <ClaimCard key={c.id} claim={c} />)}
          </div>
        </section>
      )}
    </div>
  )
}

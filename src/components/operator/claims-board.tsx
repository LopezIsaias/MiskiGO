'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, formatCurrency } from '@/lib/utils'

export interface ClaimRow {
  id:                   string
  status:               string
  claimed_quantity:     number
  reason:               string
  photo_url:            string
  photo_taken_at:       string | null
  photo_verification:   string | null
  created_at:           string
  resolution_type:      string | null
  resolution_amount:    number | null
  resolution_proof_url: string | null
  is_justified:         boolean | null
  resolved_at:          string | null
  reception_photo_url:  string | null
  customer:             { full_name: string; phone: string | null } | null
  order:                { id: string; delivery_address: string; total_amount: number } | null
  product:              { name: string; unit: string } | null
  resolver:             { full_name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending:             'Pendiente',
  approved:            'Aprobado',
  partially_approved:  'Aprobado parcialmente',
  rejected:            'Rechazado',
}

const STATUS_COLOR: Record<string, string> = {
  pending:             'bg-amber-100 text-amber-800',
  approved:            'bg-green-100 text-green-800',
  partially_approved:  'bg-blue-100 text-blue-700',
  rejected:            'bg-red-100 text-red-700',
}

const RESOLUTION_LABEL: Record<string, string> = {
  wallet_credit:  'Crédito en billetera',
  external_refund: 'Reembolso externo (Yape/transferencia)',
  reprogrammed:   'Reprogramar entrega',
}

// ── Single claim card ────────────────────────────────────────────────────────

interface CardProps { claim: ClaimRow; isSuperadmin: boolean }

function ClaimCard({ claim, isSuperadmin }: CardProps) {
  const router = useRouter()
  const isPending = claim.status === 'pending'

  // Reapertura de plazo de reclamo — solo superadmin (§4/§8). El endpoint valida
  // que el pedido esté entregado/cerrado; aquí basta con pedir el motivo (auditado).
  const [reopening, setReopening] = useState(false)
  const [reopenError, setReopenError] = useState('')
  const [reopened, setReopened] = useState(false)

  async function handleReopen() {
    const orderId = claim.order?.id
    if (!orderId) return
    // ponytail: window.prompt para el motivo; basta para una acción rara de superadmin
    const reason = window.prompt('Motivo para reabrir el plazo de reclamo:')
    if (!reason || !reason.trim()) return
    setReopening(true)
    setReopenError('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reopen-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setReopenError(d.error ?? 'Error al reabrir el plazo.')
        return
      }
      setReopened(true)
      router.refresh()
    } catch {
      setReopenError('Error de conexión.')
    } finally {
      setReopening(false)
    }
  }

  const proofInputRef = useRef<HTMLInputElement>(null)

  type Verdict = 'approved' | 'partially_approved' | 'rejected'
  const [verdict,          setVerdict]          = useState<Verdict | null>(null)
  const [resolutionType,   setResolutionType]   = useState<'wallet_credit' | 'external_refund' | 'reprogrammed' | ''>('')
  const [resolutionAmount, setResolutionAmount] = useState('')
  const [isJustified,      setIsJustified]      = useState(true)
  const [proofUrl,         setProofUrl]         = useState<string | null>(null)
  const [proofPreview,     setProofPreview]     = useState<string | null>(null)
  const [uploadingProof,   setUploadingProof]   = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [resolved,         setResolved]         = useState(false)

  const needsType   = verdict === 'approved' || verdict === 'partially_approved'
  const needsAmount = resolutionType === 'wallet_credit' || resolutionType === 'external_refund'
  const needsProof  = resolutionType === 'wallet_credit' || resolutionType === 'external_refund'

  // Al elegir un tipo de reembolso, el monto se precarga con el total del pedido
  // (editable). El operador puede ajustarlo para reembolsos parciales.
  function selectResolutionType(rt: 'wallet_credit' | 'external_refund' | 'reprogrammed') {
    setResolutionType(rt)
    if ((rt === 'wallet_credit' || rt === 'external_refund') && resolutionAmount === '') {
      setResolutionAmount(String(claim.order?.total_amount ?? ''))
    }
  }

  const canSubmit =
    verdict !== null &&
    (!needsType   || resolutionType !== '') &&
    (!needsAmount || (parseFloat(resolutionAmount) > 0)) &&
    (!needsProof  || proofUrl !== null)

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingProof(true)
    setError('')
    setProofPreview(URL.createObjectURL(file))
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `claims/${claim.id}_${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('resolution-proofs')
        .upload(path, file, { upsert: false })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('resolution-proofs').getPublicUrl(path)
      setProofUrl(publicUrl)
    } catch {
      setError('Error al subir el comprobante.')
      setProofPreview(null)
    } finally {
      setUploadingProof(false)
    }
  }

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
        proof_url:         needsProof  ? proofUrl : null,
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
    <div className={`bg-white rounded-xl border overflow-hidden shadow-sm ${
      isPending ? 'border-l-4 border-amber-400' : 'border-miski-border'
    }`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start gap-4 border-b border-miski-border">
        {/* Photos */}
        <div className="shrink-0 flex gap-2">
          <div className="flex flex-col items-center gap-1">
            <a href={claim.photo_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={claim.photo_url}
                alt="Foto del cliente"
                className="w-20 h-20 object-cover rounded-lg border border-miski-border hover:opacity-80 transition-opacity"
              />
            </a>
            <span className="text-[10px] text-miski-muted font-medium">Cliente</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            {claim.reception_photo_url ? (
              <a href={claim.reception_photo_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={claim.reception_photo_url}
                  alt="Foto en recepción"
                  className="w-20 h-20 object-cover rounded-lg border border-miski-green/30 hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <div className="w-20 h-20 rounded-lg border border-dashed border-miski-border bg-miski-cream/30 flex items-center justify-center">
                <span className="text-[9px] text-miski-muted text-center leading-tight px-1">
                  Sin reporte de recepción
                </span>
              </div>
            )}
            <span className="text-[10px] text-miski-muted font-medium">Repartidor</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[claim.status] ?? 'bg-gray-100 text-miski-tinta'}`}>
              {STATUS_LABEL[claim.status] ?? claim.status}
            </span>
            <span className="text-xs text-miski-muted">{formatDateTime(claim.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-miski-forest">
            {claim.customer?.full_name ?? '—'} · Pedido #{orderId}
          </p>
          <p className="text-xs text-miski-muted mt-0.5">
            {claim.product?.name ?? '—'} · {claim.claimed_quantity} {claim.product?.unit}
          </p>
          <p className="text-xs text-miski-tinta mt-1.5 bg-miski-cream/30 rounded-lg px-3 py-2 italic">
            &ldquo;{claim.reason}&rdquo;
          </p>
          {/* Fecha real de captura de la foto (EXIF, verificada en servidor) */}
          {claim.photo_verification === 'unknown' ? (
            <p className="text-xs text-amber-700 mt-1.5">
              ⚠ Foto sin fecha de captura verificable
            </p>
          ) : claim.photo_taken_at ? (
            <p className="text-xs text-miski-muted mt-1.5">
              📷 Foto tomada el <span className="font-medium text-gray-700">{formatDateTime(claim.photo_taken_at)}</span>
            </p>
          ) : null}
          {!claim.reception_photo_url && (
            <p className="text-xs text-miski-muted mt-1.5 italic">
              El repartidor no reportó problemas en recepción.
            </p>
          )}
        </div>
      </div>

      {/* Resolved summary */}
      {!isPending && (
        <div className="px-5 py-3 text-xs text-gray-500 space-y-1">
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
          {claim.resolution_proof_url && (
            <div className="pt-1">
              <p className="text-miski-muted mb-1">Comprobante:</p>
              <a href={claim.resolution_proof_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={claim.resolution_proof_url}
                  alt="Comprobante de resolución"
                  className="w-24 h-16 object-cover rounded-lg border border-miski-border hover:opacity-80 transition-opacity"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Resolve form — pending only */}
      {isPending && !resolved && (
        <div className="px-5 py-4 space-y-4 bg-miski-cream/20 border-t border-miski-border">
          {/* Verdict */}
          <div>
            <p className="text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-2">Decisión</p>
            <div className="flex gap-2 flex-wrap">
              {(['approved', 'partially_approved', 'rejected'] as Verdict[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerdict(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    verdict === v
                      ? v === 'rejected'
                        ? 'bg-red-500 text-white border-red-500'
                        : v === 'approved'
                          ? 'bg-miski-forest text-white border-miski-forest'
                          : 'bg-miski-green text-white border-miski-green'
                      : 'border border-miski-border text-miski-forest hover:bg-miski-green-soft'
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
              <p className="text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-2">Tipo de resolución</p>
              <div className="space-y-1.5">
                {(['wallet_credit', 'external_refund', 'reprogrammed'] as const).map(rt => (
                  <label key={rt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`rt-${claim.id}`}
                      checked={resolutionType === rt}
                      onChange={() => selectResolutionType(rt)}
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
              <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
                Monto a {resolutionType === 'wallet_credit' ? 'acreditar' : 'reembolsar'} (S/)
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={resolutionAmount}
                onChange={e => setResolutionAmount(e.target.value)}
                placeholder="0.00"
                className="w-40 border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
              />
              {claim.order && (
                <p className="text-xs text-miski-muted mt-1">
                  Precargado con el total del pedido ({formatCurrency(claim.order.total_amount)}). Edítalo para reembolsos parciales.
                </p>
              )}
              {resolutionType === 'wallet_credit' && (
                <p className="text-xs text-miski-muted mt-1">
                  El saldo se acreditará automáticamente al confirmar.
                </p>
              )}
            </div>
          )}

          {/* Proof upload — required for wallet_credit and external_refund */}
          {needsProof && (
            <div>
              <p className="text-xs font-semibold text-miski-tinta mb-2">
                Comprobante <span className="text-red-500">*</span>
                <span className="ml-1 text-miski-muted font-normal">
                  {resolutionType === 'wallet_credit'
                    ? '(captura del registro interno)'
                    : '(captura que muestre hora y código de operación)'}
                </span>
              </p>
              {proofPreview ? (
                <div className="relative w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofPreview} alt="Comprobante" className="w-32 h-24 object-cover rounded-lg border border-miski-border" />
                  {uploadingProof && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                      <span className="text-xs text-gray-500">Subiendo…</span>
                    </div>
                  )}
                  {!uploadingProof && proofUrl && (
                    <div className="absolute bottom-1 right-1 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">✓</div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setProofPreview(null); setProofUrl(null) }}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-miski-border rounded-full w-5 h-5 text-xs flex items-center justify-center text-miski-muted"
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => proofInputRef.current?.click()}
                  className="h-16 w-48 rounded-lg border-2 border-dashed border-miski-border text-xs text-miski-muted hover:border-miski-green hover:text-miski-green transition-colors"
                >
                  + Subir comprobante
                </button>
              )}
              <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
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
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-miski-green hover:bg-miski-forest disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? 'Guardando…' : 'Confirmar resolución'}
          </button>
        </div>
      )}

      {resolved && (
        <div className="px-5 py-3 bg-miski-lime/10 border-t border-miski-green/30">
          <p className="text-xs text-miski-forest font-medium">Reclamo resuelto correctamente.</p>
        </div>
      )}

      {/* Reabrir plazo — solo superadmin */}
      {isSuperadmin && claim.order && (
        <div className="px-5 py-3 border-t border-miski-border flex items-center gap-3 flex-wrap">
          {reopened ? (
            <p className="text-xs text-miski-forest font-medium">Plazo de reclamo reabierto.</p>
          ) : (
            <button
              type="button"
              onClick={() => void handleReopen()}
              disabled={reopening}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-miski-border text-miski-forest hover:bg-miski-green-soft disabled:opacity-50 transition-colors"
            >
              {reopening ? 'Reabriendo…' : 'Reabrir plazo de reclamo'}
            </button>
          )}
          {reopenError && <span className="text-xs text-red-600">{reopenError}</span>}
        </div>
      )}
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────

interface Props {
  pending:  ClaimRow[]
  resolved: ClaimRow[]
  isSuperadmin: boolean
}

export function ClaimsBoard({ pending, resolved, isSuperadmin }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-miski-forest/60 uppercase tracking-wide mb-3">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-miski-muted bg-white rounded-xl border border-miski-border shadow-sm p-6 text-center">
            No hay reclamos pendientes.
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map(c => <ClaimCard key={c.id} claim={c} isSuperadmin={isSuperadmin} />)}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-miski-forest/60 uppercase tracking-wide mb-3">
            Resueltos ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map(c => <ClaimCard key={c.id} claim={c} isSuperadmin={isSuperadmin} />)}
          </div>
        </section>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface Props {
  orderId: string
  isPending: boolean
  customerName: string
  customerPhone: string | null
  proofAmount: number
  walletUsed: number
  deliveryDate: string
}

function toWANumber(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('51') && digits.length === 11) return digits
  if (digits.length === 9) return `51${digits}`
  return null
}

type ActionState = 'idle' | 'approving' | 'rejecting' | 'approved' | 'rejected' | 'error'

export function PaymentActions({
  orderId, isPending, customerName, customerPhone,
  proofAmount, walletUsed, deliveryDate,
}: Props) {
  const router = useRouter()
  const [state, setState] = useState<ActionState>('idle')
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const idShort = orderId.slice(0, 8).toUpperCase()
  const waNumber = toWANumber(customerPhone)

  const approveMsg =
    `✅ ¡Hola ${customerName}! Tu pago fue validado. Tu pedido Miski GO (#${idShort}) ` +
    `por ${formatCurrency(proofAmount)} está confirmado. ` +
    (deliveryDate ? `Entrega estimada: ${deliveryDate}. ` : '') +
    `¡Gracias por confiar en nosotros! 🌱`

  const rejectMsg =
    `Hola ${customerName}, no pudimos validar tu comprobante de pago ` +
    `(Pedido Miski GO #${idShort}). ` +
    (rejectReason ? `Motivo: ${rejectReason}. ` : '') +
    `Por favor contáctanos para resolverlo. 🙏`

  async function handleApprove() {
    if (state !== 'idle') return
    setState('approving')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/approve`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(typeof data.error === 'string' ? data.error : 'Error al aprobar')
        setState('error')
        return
      }
      setState('approved')
      router.refresh()
    } catch {
      setErrorMsg('Error de conexión')
      setState('error')
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectReason.trim()) return
    if (state !== 'idle') return
    setState('rejecting')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(typeof data.error === 'string' ? data.error : 'Error al rechazar')
        setState('error')
        return
      }
      setState('rejected')
      router.refresh()
    } catch {
      setErrorMsg('Error de conexión')
      setState('error')
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      /* ignore clipboard errors */
    }
  }

  const isLoading = state === 'approving' || state === 'rejecting'
  const actionDone = state === 'approved' || state === 'rejected'

  return (
    <div className="space-y-6">
      {/* Action area */}
      {isPending && (
        <section className="bg-white rounded-xl border border-miski-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5">
            <h2 className="text-sm font-semibold text-miski-forest">Validación de pago</h2>
          </div>
          <div className="p-4 space-y-4">
            {state === 'approved' && (
              <div className="bg-miski-lime/10 border border-miski-green rounded-lg px-4 py-3 text-sm text-miski-forest font-medium">
                Pago aprobado correctamente. El pedido está confirmado y bloqueado.
              </div>
            )}
            {state === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 font-medium">
                Pago rechazado. El stock fue liberado
                {walletUsed > 0 ? ` y se reembolsaron ${formatCurrency(walletUsed)} a la billetera del cliente.` : '.'}
              </div>
            )}
            {state === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {!actionDone && (
              <div className="space-y-3">
                <form onSubmit={handleReject} className="space-y-2">
                  <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
                    Motivo de rechazo (requerido para rechazar)
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Ej: imagen ilegible, monto incorrecto, comprobante falso..."
                    className="w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
                    disabled={isLoading}
                  />
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading || !rejectReason.trim()}
                      className="flex-1 bg-red-500 text-white hover:bg-red-600 text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state === 'rejecting' ? 'Rechazando...' : 'Rechazar pago'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isLoading}
                      className="flex-1 bg-miski-forest text-white hover:bg-miski-green text-sm font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state === 'approving' ? 'Aprobando...' : 'Aprobar pago'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      )}

      {/* WhatsApp notification */}
      <section className="bg-white rounded-xl border border-miski-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-miski-forest">Notificar por WhatsApp</h2>
          {customerPhone && (
            <span className="text-xs text-miski-muted">
              Número:&nbsp;
              <span className="font-mono font-medium text-miski-forest select-all">{customerPhone}</span>
            </span>
          )}
        </div>
        <div className="p-4 space-y-4">
          {!customerPhone && (
            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              El cliente no tiene número de teléfono registrado.
            </p>
          )}

          {/* Approval message */}
          <div className={`rounded-lg border p-3 space-y-2 ${state === 'approved' ? 'border-miski-green bg-miski-lime/10' : 'border-miski-border'}`}>
            <p className="text-xs font-semibold text-miski-forest">Mensaje de aprobación</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{approveMsg}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => copyText(approveMsg, 'approve')}
                className="text-xs border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded px-2 py-1 transition-colors"
              >
                {copiedKey === 'approve' ? '¡Copiado!' : 'Copiar'}
              </button>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(approveMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-miski-green hover:text-miski-forest border border-miski-green/30 rounded px-2 py-1 transition-colors"
                >
                  Abrir en WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Rejection message */}
          <div className={`rounded-lg border p-3 space-y-2 ${state === 'rejected' ? 'border-red-300 bg-red-50' : 'border-miski-border'}`}>
            <p className="text-xs font-semibold text-miski-forest">Mensaje de rechazo</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{rejectMsg}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => copyText(rejectMsg, 'reject')}
                className="text-xs border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded px-2 py-1 transition-colors"
              >
                {copiedKey === 'reject' ? '¡Copiado!' : 'Copiar'}
              </button>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(rejectMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded px-2 py-1 transition-colors"
                >
                  Abrir en WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

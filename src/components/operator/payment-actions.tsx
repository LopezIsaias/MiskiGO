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
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Validación de pago</h2>
          </div>
          <div className="p-4 space-y-4">
            {state === 'approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
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
                  <label className="block text-xs font-medium text-gray-600">
                    Motivo de rechazo (requerido para rechazar)
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Ej: imagen ilegible, monto incorrecto, comprobante falso..."
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isLoading || !rejectReason.trim()}
                      className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {state === 'rejecting' ? 'Rechazando...' : 'Rechazar pago'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Notificar por WhatsApp</h2>
          {customerPhone && (
            <span className="text-xs text-gray-500">
              Número:&nbsp;
              <span className="font-mono font-medium text-gray-800 select-all">{customerPhone}</span>
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
          <div className={`rounded-lg border p-3 space-y-2 ${state === 'approved' ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
            <p className="text-xs font-semibold text-gray-600">Mensaje de aprobación</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{approveMsg}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => copyText(approveMsg, 'approve')}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
              >
                {copiedKey === 'approve' ? '¡Copiado!' : 'Copiar'}
              </button>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(approveMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1 transition-colors"
                >
                  Abrir en WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Rejection message */}
          <div className={`rounded-lg border p-3 space-y-2 ${state === 'rejected' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <p className="text-xs font-semibold text-gray-600">Mensaje de rechazo</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{rejectMsg}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => copyText(rejectMsg, 'reject')}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
              >
                {copiedKey === 'reject' ? '¡Copiado!' : 'Copiar'}
              </button>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(rejectMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
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

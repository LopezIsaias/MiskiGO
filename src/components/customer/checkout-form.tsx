'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cart'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg', unit: 'und.', liter: 'lt', bunch: 'atado',
}

interface Props {
  walletBalance: number
  userId: string
}

type PaymentMethod = 'yape' | 'transfer' | 'wallet'

interface OrderResult {
  orderId: string
  status: string
  walletUsed: number
  remainder: number
}

export function CheckoutForm({ walletBalance, userId }: Props) {
  const router = useRouter()
  const { items, clearCart } = useCartStore()

  const [address, setAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yape')
  const [useWallet, setUseWallet] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OrderResult | null>(null)

  const subtotal = items.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0)
  const walletApplied = useWallet && paymentMethod !== 'wallet'
    ? Math.min(walletBalance, subtotal)
    : paymentMethod === 'wallet' ? subtotal : 0
  const remainder = Math.max(0, Math.round((subtotal - walletApplied) * 100) / 100)
  const needsProof = paymentMethod !== 'wallet' && remainder > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setProofUrl(null)
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${Date.now()}_proof.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(path)
      setProofUrl(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el comprobante')
      setProofFile(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    if (!address.trim()) { setError('Ingresa una dirección de entrega'); return }
    if (needsProof && !proofUrl) { setError('Sube el comprobante de pago'); return }
    if (paymentMethod === 'wallet' && walletBalance < subtotal) {
      setError('Saldo de billetera insuficiente'); return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          delivery_address: address.trim(),
          delivery_notes: deliveryNotes.trim() || undefined,
          customer_note: customerNote.trim() || undefined,
          payment_method: paymentMethod,
          use_wallet: useWallet,
          proof_url: proofUrl ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Error al procesar el pedido')
        return
      }
      clearCart()
      setResult(data as OrderResult)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const confirmed = result.status === 'confirmed'
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmed ? 'bg-green-100' : 'bg-amber-100'}`}>
          <span className={`text-3xl font-light ${confirmed ? 'text-green-600' : 'text-amber-600'}`}>
            {confirmed ? '✓' : '⏳'}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {confirmed ? 'Pedido confirmado' : 'Comprobante recibido'}
        </h2>
        {confirmed ? (
          <p className="text-gray-600 text-sm mb-6">
            Tu pedido fue confirmado. Recibirás tu entrega en la fecha indicada.
          </p>
        ) : (
          <p className="text-gray-600 text-sm mb-6">
            Tu comprobante está siendo validado. El tiempo estimado de revisión es de 1 a 3 horas
            durante horario laboral. Te notificaremos cuando se confirme.
          </p>
        )}
        {result.walletUsed > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Se descontaron {formatCurrency(result.walletUsed)} de tu billetera.
          </p>
        )}
        <p className="text-xs text-gray-400 mb-6">N.° de pedido: {result.orderId}</p>
        <button
          onClick={() => router.push('/customer/catalog')}
          className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Volver al catálogo
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    router.replace('/customer/cart')
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Order summary */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Resumen del pedido</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map(item => (
            <div key={item.productId} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-gray-400 ml-2">
                  {item.quantity} {UNIT_LABEL[item.unit] ?? item.unit}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">{item.deliveryLabel}</p>
              </div>
              <span className="font-medium text-gray-900">
                {formatCurrency(item.estimatedPrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between text-sm font-semibold">
          <span className="text-gray-700">Total</span>
          <span className="text-gray-900">{formatCurrency(subtotal)}</span>
        </div>
      </section>

      {/* Delivery address */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Dirección de entrega</h2>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Jr. Los Cedros 123, Tarapoto"
          required
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <input
          type="text"
          value={deliveryNotes}
          onChange={e => setDeliveryNotes(e.target.value)}
          placeholder="Referencias (opcional): portón azul, segundo piso..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </section>

      {/* Payment method */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Método de pago</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['yape', 'transfer', 'wallet'] as PaymentMethod[]).map(method => {
            const labels: Record<PaymentMethod, string> = {
              yape: 'Yape', transfer: 'Transferencia', wallet: 'Billetera',
            }
            const isDisabled = method === 'wallet' && walletBalance <= 0
            return (
              <button
                key={method}
                type="button"
                disabled={isDisabled}
                onClick={() => { setPaymentMethod(method); setUseWallet(false); setProofUrl(null); setProofFile(null) }}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  paymentMethod === method
                    ? 'bg-green-600 text-white border-green-600'
                    : isDisabled
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                }`}
              >
                {labels[method]}
                {method === 'wallet' && (
                  <span className="block text-xs mt-0.5 font-normal">
                    {formatCurrency(walletBalance)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Wallet toggle for mixed payment */}
        {paymentMethod !== 'wallet' && walletBalance > 0 && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={e => setUseWallet(e.target.checked)}
              className="w-4 h-4 text-green-600 rounded border-gray-300"
            />
            Usar saldo de billetera ({formatCurrency(walletBalance)})
            {useWallet && walletApplied > 0 && (
              <span className="text-green-600 font-medium">
                — descuenta {formatCurrency(walletApplied)}
              </span>
            )}
          </label>
        )}

        {/* Wallet insufficient warning */}
        {paymentMethod === 'wallet' && walletBalance < subtotal && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            Saldo insuficiente. Tu billetera tiene {formatCurrency(walletBalance)} y el total es {formatCurrency(subtotal)}.
          </p>
        )}

        {/* Remainder display for mixed payment */}
        {useWallet && paymentMethod !== 'wallet' && remainder > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
            Saldo aplicado: {formatCurrency(walletApplied)} — Monto a pagar con comprobante:{' '}
            <strong>{formatCurrency(remainder)}</strong>
          </div>
        )}
      </section>

      {/* Proof upload */}
      {needsProof && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Comprobante de pago
            {remainder < subtotal && <span className="text-gray-400 font-normal ml-1">(por {formatCurrency(remainder)})</span>}
          </h2>
          <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            proofUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
          }`}>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="hidden" />
            {uploading ? (
              <p className="text-sm text-gray-500">Subiendo...</p>
            ) : proofUrl ? (
              <p className="text-sm text-green-700 font-medium">Comprobante cargado</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Haz clic para subir captura o PDF</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF — máx. 5 MB</p>
              </>
            )}
          </label>
          {proofFile && proofUrl && (
            <p className="text-xs text-gray-500">Archivo: {proofFile.name}</p>
          )}
        </section>
      )}

      {/* Customer note */}
      <section>
        <textarea
          value={customerNote}
          onChange={e => setCustomerNote(e.target.value)}
          placeholder="Nota al vendedor (opcional)"
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || uploading || (paymentMethod === 'wallet' && walletBalance < subtotal)}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Procesando...' : `Confirmar pedido — ${formatCurrency(subtotal)}`}
      </button>
    </form>
  )
}

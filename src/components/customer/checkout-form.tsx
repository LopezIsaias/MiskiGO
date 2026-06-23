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
  fullName: string
  dni: string
  ruc: string
}

type PaymentMethod = 'yape' | 'transfer' | 'wallet'
type ReceiptType = 'boleta' | 'factura'

interface OrderResult {
  orderId: string
  status: string
  walletUsed: number
  remainder: number
}

export function CheckoutForm({ walletBalance, userId, fullName, dni, ruc }: Props) {
  const router = useRouter()
  const { items, clearCart } = useCartStore()

  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yape')

  // Comprobante (boleta / factura)
  const [receiptType, setReceiptType] = useState<ReceiptType>('boleta')
  const [receiptDocument, setReceiptDocument] = useState(dni)
  const [receiptName, setReceiptName] = useState(fullName)
  const [useWallet, setUseWallet] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OrderResult | null>(null)

  const subtotal = items.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0)
  const walletApplied = useWallet && paymentMethod !== 'wallet'
    ? Math.min(walletBalance, subtotal)
    : paymentMethod === 'wallet' ? subtotal : 0
  const remainder = Math.max(0, Math.round((subtotal - walletApplied) * 100) / 100)
  const needsProof = paymentMethod !== 'wallet' && remainder > 0

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  const MAX_PROOF_BYTES = 5 * 1024 * 1024

  async function uploadProof(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no válido. Usa JPG, PNG, WEBP o PDF.'); return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError('El archivo supera los 5 MB.'); return
    }
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadProof(file)
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void uploadProof(file)
  }

  function captureLocation() {
    setLocationError(null)
    if (!('geolocation' in navigator)) {
      setLocationError('Tu navegador no permite ubicación.'); return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          lat: Math.round(pos.coords.latitude * 1e7) / 1e7,
          lng: Math.round(pos.coords.longitude * 1e7) / 1e7,
        })
        setLocating(false)
      },
      () => {
        setLocationError('No pudimos obtener tu ubicación. Revisa los permisos.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function handleReceiptTypeChange(type: ReceiptType) {
    setReceiptType(type)
    setError(null)
    if (type === 'boleta') {
      setReceiptDocument(dni)
      setReceiptName(fullName)
    } else {
      setReceiptDocument(ruc)
      setReceiptName('')
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

    const docDigits = receiptDocument.trim()
    if (receiptType === 'boleta' && !/^\d{8}$/.test(docDigits)) {
      setError('Para boleta, ingresa un DNI de 8 dígitos'); return
    }
    if (receiptType === 'factura' && !/^\d{11}$/.test(docDigits)) {
      setError('Para factura, ingresa un RUC de 11 dígitos'); return
    }
    if (receiptName.trim().length < 3) {
      setError(receiptType === 'factura' ? 'Ingresa la razón social' : 'Ingresa el nombre para la boleta'); return
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
          delivery_lat: coords?.lat,
          delivery_lng: coords?.lng,
          delivery_notes: deliveryNotes.trim() || undefined,
          customer_note: customerNote.trim() || undefined,
          payment_method: paymentMethod,
          use_wallet: useWallet,
          proof_url: proofUrl ?? undefined,
          receipt_type: receiptType,
          receipt_document: docDigits,
          receipt_name: receiptName.trim(),
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
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmed ? 'bg-miski-green-soft' : 'bg-miski-gold-light/50'}`}>
          <span className={`text-3xl ${confirmed ? 'text-miski-green' : 'text-miski-gold'}`}>
            {confirmed ? '✓' : '⏳'}
          </span>
        </div>
        <h2 className="font-display text-xl font-bold text-miski-forest mb-2">
          {confirmed ? 'Pedido confirmado' : 'Comprobante recibido'}
        </h2>
        {confirmed ? (
          <p className="text-miski-muted text-sm mb-6">
            Tu pedido fue confirmado. Recibirás tu entrega en la fecha indicada.
          </p>
        ) : (
          <p className="text-miski-muted text-sm mb-6">
            Tu comprobante está siendo validado. El tiempo estimado de revisión es de 1 a 3 horas
            durante horario laboral. Te notificaremos cuando se confirme.
          </p>
        )}
        {result.walletUsed > 0 && (
          <p className="text-sm text-miski-muted mb-4">
            Se descontaron <span className="tabular">{formatCurrency(result.walletUsed)}</span> de tu billetera.
          </p>
        )}
        <p className="text-xs text-miski-muted mb-6 tabular">Pedido #{result.orderId.slice(0, 8).toUpperCase()}</p>
        <button
          onClick={() => router.push('/customer/catalog')}
          className="bg-miski-green text-white px-6 py-2.5 rounded-xl font-display text-sm font-semibold hover:bg-miski-forest transition-colors"
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
      <section className="bg-white rounded-2xl border border-miski-border overflow-hidden">
        <div className="px-4 py-3 border-b border-miski-border bg-miski-green-soft">
          <h2 className="font-display text-sm font-bold text-miski-forest">Resumen del pedido</h2>
        </div>
        <div className="divide-y divide-miski-border">
          {items.map(item => (
            <div key={item.productId} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-display font-bold text-miski-forest">{item.name}</span>
                <span className="text-miski-muted ml-2 tabular">
                  {item.quantity} {UNIT_LABEL[item.unit] ?? item.unit}
                </span>
                <p className="text-xs text-miski-muted mt-0.5">{item.deliveryLabel}</p>
              </div>
              <span className="tabular font-semibold text-miski-forest">
                {formatCurrency(item.estimatedPrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-miski-border flex justify-between text-sm font-semibold bg-miski-hueso">
          <span className="text-miski-muted">Total</span>
          <span className="tabular text-miski-forest">{formatCurrency(subtotal)}</span>
        </div>
      </section>

      {/* Delivery address */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-miski-forest">Dirección de entrega</h2>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Jr. Los Cedros 123, Tarapoto"
          required
          className="w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
        />
        <input
          type="text"
          value={deliveryNotes}
          onChange={e => setDeliveryNotes(e.target.value)}
          placeholder="Referencias (opcional): portón azul, segundo piso..."
          className="w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
        />

        {/* Ubicación exacta (pin para el repartidor) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors disabled:opacity-50 ${
              coords
                ? 'border-miski-green bg-miski-lime/10 text-miski-forest'
                : 'border-miski-sage text-miski-forest hover:bg-miski-cream/40'
            }`}
          >
            {locating ? 'Obteniendo ubicación…' : coords ? '✓ Ubicación guardada' : '📍 Usar mi ubicación actual'}
          </button>
          {coords && (
            <span className="text-xs text-gray-400">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
        {locationError
          ? <p className="text-xs text-amber-700">{locationError}</p>
          : <p className="text-xs text-gray-400">Opcional: ayuda al repartidor a ubicarte con un pin exacto.</p>}
      </section>

      {/* Comprobante: boleta / factura */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-miski-forest">Comprobante</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['boleta', 'factura'] as ReceiptType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => handleReceiptTypeChange(type)}
              className={`py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                receiptType === type
                  ? 'border-miski-green bg-miski-green-soft text-miski-forest font-semibold'
                  : 'border-miski-border hover:border-miski-green/60 bg-white text-miski-muted'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-miski-forest mb-1">
            {receiptType === 'boleta' ? 'DNI (8 dígitos)' : 'RUC (11 dígitos)'}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={receiptDocument}
            onChange={e => setReceiptDocument(e.target.value.replace(/\D/g, '').slice(0, receiptType === 'boleta' ? 8 : 11))}
            placeholder={receiptType === 'boleta' ? '12345678' : '20123456789'}
            className="w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-miski-forest mb-1">
            {receiptType === 'boleta' ? 'Nombre completo' : 'Razón social'}
          </label>
          <input
            type="text"
            value={receiptName}
            onChange={e => setReceiptName(e.target.value)}
            placeholder={receiptType === 'boleta' ? 'Juan Pérez' : 'Mi Empresa S.A.C.'}
            className="w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta"
          />
        </div>
        <p className="text-xs text-gray-400">
          El comprobante se emite al completarse la entrega de tu pedido.
        </p>
      </section>

      {/* Payment method */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-miski-forest">Método de pago</h2>
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
                    ? 'border-miski-green bg-miski-green-soft text-miski-forest font-semibold'
                    : isDisabled
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'border-miski-border hover:border-miski-green/60 bg-white text-miski-muted'
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
              className="w-4 h-4 text-miski-green rounded border-miski-sage"
            />
            Usar saldo de billetera ({formatCurrency(walletBalance)})
            {useWallet && walletApplied > 0 && (
              <span className="text-miski-green font-medium">
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
          <label
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); setDragging(false) }}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragging
                ? 'border-miski-green bg-miski-lime/20'
                : proofUrl
                  ? 'border-miski-green bg-miski-lime/10'
                  : 'border-miski-sage hover:border-miski-green hover:bg-miski-cream/30'
            }`}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="hidden" />
            {uploading ? (
              <p className="text-sm text-gray-500">Subiendo...</p>
            ) : dragging ? (
              <p className="text-sm text-miski-forest font-medium">Suelta el archivo aquí</p>
            ) : proofUrl ? (
              <p className="text-sm text-miski-forest font-medium">Comprobante cargado</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Arrastra el comprobante aquí o haz clic para subir</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, PDF — máx. 5 MB</p>
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
          className="w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta resize-none"
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
        className="w-full bg-miski-green text-white py-3 rounded-xl font-display text-sm font-semibold hover:bg-miski-forest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Procesando…' : <>Confirmar pedido — <span className="tabular">{formatCurrency(subtotal)}</span></>}
      </button>
    </form>
  )
}

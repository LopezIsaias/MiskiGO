'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { extractExif } from '@/lib/utils/exif-client'
import type { ExifData } from '@/lib/utils/exif-client'

const PRESET_AMOUNTS = [20, 50, 100, 200]

export function WalletRechargeForm() {
  const router = useRouter()
  const [amount,        setAmount]        = useState('')
  const [method,        setMethod]        = useState<'yape' | 'transfer' | ''>('')
  const [proofFile,     setProofFile]     = useState<File | null>(null)
  const [proofExif,     setProofExif]     = useState<ExifData | null>(null)
  const [proofPreview,  setProofPreview]  = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsedAmount = parseFloat(amount)
  const canSubmit = parsedAmount > 0 && method !== '' && proofFile !== null && !uploading && !saving

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
    extractExif(file).then(exif => setProofExif(exif)).catch(() => {})
  }

  function clearProof() {
    setProofFile(null)
    setProofPreview('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!canSubmit || !proofFile || !method) return
    setUploading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No autenticado.'); setUploading(false); return }

    const ext = proofFile.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('wallet-proofs')
      .upload(path, proofFile, { upsert: false })

    if (uploadError) {
      setError('Error al subir el comprobante.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('wallet-proofs').getPublicUrl(path)
    setUploading(false)
    setSaving(true)

    try {
      const res = await fetch('/api/customer/wallet/recharge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: parsedAmount, method, proofUrl: publicUrl, photoMetadata: proofExif }),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al registrar la recarga.')
        return
      }

      setSuccess(true)
      router.refresh()
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
        <p className="text-green-800 font-semibold text-sm">¡Recarga enviada correctamente!</p>
        <p className="text-sm text-green-700">
          Tu comprobante está en revisión. El tiempo estimado de validación es de{' '}
          <strong>1 a 3 horas en horario laboral</strong>.
        </p>
        <p className="text-xs text-green-600 mt-1">
          Te notificaremos cuando tu saldo sea actualizado.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <h2 className="text-sm font-semibold text-gray-700">Recargar billetera</h2>

      {/* Amount presets + custom */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Monto (S/)</p>
        <div className="flex gap-2 flex-wrap mb-2">
          {PRESET_AMOUNTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                amount === String(p)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {formatCurrency(p)}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Otro monto"
          className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
        />
      </div>

      {/* Method */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Método de pago</p>
        <div className="flex gap-2">
          {(['yape', 'transfer'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                method === m
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {m === 'yape' ? 'Yape' : 'Transferencia'}
            </button>
          ))}
        </div>
      </div>

      {/* Proof upload */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Comprobante de pago</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {proofPreview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofPreview}
              alt="Comprobante"
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={clearProof}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg px-6 py-4 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            Subir comprobante
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
        className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Subiendo comprobante…' : saving ? 'Registrando…' : 'Confirmar recarga'}
      </button>
    </div>
  )
}

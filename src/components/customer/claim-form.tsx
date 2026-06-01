'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'
import { extractExif } from '@/lib/utils/exif-client'
import type { ExifData } from '@/lib/utils/exif-client'

export interface ClaimableItem {
  productId:       string
  productName:     string
  unit:            string
  orderedQuantity: number
  alreadyClaimed:  boolean
}

interface ItemState {
  selected:        boolean
  claimedQuantity: number
  reason:          string
}

interface Props {
  orderId:              string
  items:                ClaimableItem[]
  claimWindowExpiresAt: string
  customerId:           string
}

export function ClaimForm({ orderId, items, claimWindowExpiresAt, customerId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [photoUrl,       setPhotoUrl]       = useState<string | null>(null)
  const [photoExif,      setPhotoExif]      = useState<ExifData | null>(null)
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [error,          setError]          = useState('')
  const [submitted,      setSubmitted]      = useState(false)

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {}
    for (const item of items) {
      init[item.productId] = { selected: false, claimedQuantity: Math.max(1, Math.round(item.orderedQuantity)), reason: '' }
    }
    return init
  })

  const selectedCount = items.filter(i => itemStates[i.productId]?.selected).length

  function toggleItem(productId: string) {
    setItemStates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], selected: !prev[productId].selected },
    }))
  }

  function updateField(productId: string, field: 'claimedQuantity' | 'reason', value: number | string) {
    setItemStates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }))
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError('')

    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    const exif = await extractExif(file)
    setPhotoExif(exif)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('claim-photos')
        .upload(path, file, { upsert: false })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('claim-photos').getPublicUrl(path)
      setPhotoUrl(urlData.publicUrl)
    } catch {
      setError('Error al subir la foto. Intenta de nuevo.')
      setPhotoPreview(null)
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!photoUrl) { setError('La foto es obligatoria.'); return }

    const claimItems = items
      .filter(item => itemStates[item.productId]?.selected)
      .map(item => ({
        productId:       item.productId,
        claimedQuantity: itemStates[item.productId]!.claimedQuantity,
        reason:          itemStates[item.productId]!.reason.trim(),
      }))

    if (claimItems.length === 0) { setError('Selecciona al menos un producto con problema.'); return }
    if (claimItems.some(ci => !ci.reason)) { setError('Ingresa el motivo para cada producto seleccionado.'); return }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl, photoMetadata: photoExif, items: claimItems }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al enviar el reclamo.')
        return
      }
      setSubmitted(true)
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-miski-lime/15 border border-miski-green/30 rounded-xl p-8 text-center space-y-3">
        <p className="text-3xl">✅</p>
        <p className="text-sm font-semibold text-miski-forest">Reclamo enviado correctamente</p>
        <p className="text-xs text-miski-olive">El operador revisará tu caso y se comunicará contigo.</p>
        <a href="/customer/orders" className="inline-block mt-2 text-sm text-miski-green underline">
          Volver a mis pedidos
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Deadline warning */}
      <div className="bg-miski-gold-light/20 border border-miski-gold/40 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-800">
          Puedes reportar problemas hasta las{' '}
          <span className="font-semibold">{formatTime(claimWindowExpiresAt)}</span>
        </p>
      </div>

      {/* Photo */}
      <div>
        <p className="text-sm font-semibold text-miski-forest mb-1">
          Foto del problema <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-miski-olive mb-3">
          Toma una foto clara que muestre el problema con el pedido.
        </p>
        {photoPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Foto del problema"
              className="w-full h-48 object-cover rounded-xl border border-miski-sage/40"
            />
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <span className="text-sm text-gray-500">Subiendo…</span>
              </div>
            )}
            {!uploadingPhoto && photoUrl && (
              <div className="absolute bottom-2 right-2 bg-miski-forest text-white text-xs px-2 py-0.5 rounded-full">
                ✓ Guardada
              </div>
            )}
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); setPhotoUrl(null) }}
              className="absolute top-2 right-2 bg-white/80 text-gray-600 rounded-full w-7 h-7 text-xs flex items-center justify-center border border-miski-sage/40"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            <span className="text-3xl">📷</span>
            <span className="text-xs font-medium">Tomar o seleccionar foto</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* Product list */}
      <div>
        <p className="text-sm font-semibold text-miski-forest mb-3">
          ¿Con qué productos tuviste problemas? <span className="text-red-500">*</span>
        </p>
        <div className="space-y-3">
          {items.map(item => {
            const state = itemStates[item.productId]!

            return (
              <div
                key={item.productId}
                className={`rounded-xl border p-4 transition-colors ${
                  item.alreadyClaimed
                    ? 'border-miski-sage/20 bg-miski-sage/10 opacity-60'
                    : state.selected
                      ? 'border-red-200 bg-red-50'
                      : 'border-miski-sage/40 bg-white'
                }`}
              >
                <label className={`flex items-center gap-3 ${item.alreadyClaimed ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={state.selected}
                    disabled={item.alreadyClaimed}
                    onChange={() => toggleItem(item.productId)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-miski-forest">{item.productName}</p>
                    <p className="text-xs text-miski-olive">{item.orderedQuantity} {item.unit}</p>
                  </div>
                  {item.alreadyClaimed && (
                    <span className="text-xs text-miski-olive bg-miski-sage/20 px-2 py-0.5 rounded-full shrink-0">
                      Ya reclamado
                    </span>
                  )}
                </label>

                {state.selected && !item.alreadyClaimed && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-red-100">
                    <div>
                      <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
                        Cantidad con problema ({item.unit}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={item.orderedQuantity}
                        step={1}
                        value={state.claimedQuantity}
                        onChange={e => updateField(item.productId, 'claimedQuantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
                        Describe el problema <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={state.reason}
                        onChange={e => updateField(item.productId, 'reason', e.target.value)}
                        placeholder="Ej: llegó en mal estado, incompleto, diferente a lo pedido…"
                        className="w-full text-sm border border-miski-sage rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploadingPhoto || !photoUrl || selectedCount === 0}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-miski-forest hover:bg-miski-green disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        {submitting
          ? 'Enviando…'
          : selectedCount > 0
            ? `Enviar reclamo (${selectedCount} producto${selectedCount > 1 ? 's' : ''})`
            : 'Enviar reclamo'}
      </button>

      {!photoUrl && !uploadingPhoto && (
        <p className="text-center text-xs text-gray-400">Agrega la foto para continuar</p>
      )}
    </form>
  )
}

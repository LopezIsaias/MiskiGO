'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ReceptionSupplierData } from './reception-board'

interface ItemState {
  receivedQty: number  // total que llegó físicamente (bueno + malo)
  rejectedQty: number  // de lo que llegó, cuánto se rechazó por calidad
  rejectionReason: string
}

interface Props {
  supplier: ReceptionSupplierData
  cycleId: string
  deliveryPersonId: string
  onSuccess: () => void
}

export function SupplierReceptionForm({ supplier, cycleId, deliveryPersonId, onSuccess }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {}
    for (const item of supplier.items) {
      if (!item.alreadyRecorded) {
        init[item.productId] = {
          receivedQty: item.expectedQty,
          rejectedQty: 0,
          rejectionReason: '',
        }
      }
    }
    return init
  })

  const pendingItems = supplier.items.filter(i => !i.alreadyRecorded)

  function updateItem(productId: string, field: keyof ItemState, value: number | string) {
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

    // Preview
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${deliveryPersonId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('reception-photos')
        .upload(path, file, { upsert: false })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('reception-photos').getPublicUrl(path)
      setPhotoUrl(urlData.publicUrl)
    } catch {
      setError('Error al subir la foto. Intenta de nuevo.')
      setPhotoPreview(null)
    } finally {
      setUploadingPhoto(false)
    }
  }

  function validate(): string | null {
    if (!photoUrl) return 'La foto del lote es obligatoria.'

    for (const item of pendingItems) {
      const state = itemStates[item.productId]
      if (!state) continue

      if (state.receivedQty < 0) return `"${item.productName}": cantidad recibida no puede ser negativa.`
      if (state.rejectedQty < 0) return `"${item.productName}": cantidad rechazada no puede ser negativa.`
      if (state.rejectedQty > state.receivedQty + 0.001) {
        return `"${item.productName}": rechazado no puede superar lo recibido.`
      }
      if (state.receivedQty > item.expectedQty + 0.001) {
        return `"${item.productName}": recibido no puede superar lo esperado (${item.expectedQty} ${item.unit}).`
      }
      if (state.rejectedQty > 0.001 && !state.rejectionReason.trim()) {
        return `"${item.productName}": se requiere motivo de rechazo.`
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true)
    setError('')

    try {
      const items = pendingItems.map(item => ({
        productId: item.productId,
        expectedQty: item.expectedQty,
        receivedQty: itemStates[item.productId]?.receivedQty ?? item.expectedQty,
        rejectedQty: itemStates[item.productId]?.rejectedQty ?? 0,
        rejectionReason: itemStates[item.productId]?.rejectionReason ?? '',
      }))

      const res = await fetch('/api/delivery/reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId,
          supplierId: supplier.supplierId,
          photoUrl,
          items,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al registrar recepción.')
        return
      }

      onSuccess()
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Photo upload */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">
          Foto del lote <span className="text-red-500">*</span>
        </p>
        {photoPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Foto del lote"
              className="w-full h-40 object-cover rounded-xl border border-gray-200"
            />
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <span className="text-sm text-gray-500">Subiendo…</span>
              </div>
            )}
            {!uploadingPhoto && photoUrl && (
              <div className="absolute bottom-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                ✓ Guardada
              </div>
            )}
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); setPhotoUrl(null) }}
              className="absolute top-2 right-2 bg-white/80 text-gray-600 rounded-full w-7 h-7 text-xs flex items-center justify-center border border-gray-200"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors bg-white"
          >
            <span className="text-2xl">📷</span>
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

      {/* Items */}
      <div className="space-y-4">
        {pendingItems.map(item => {
          const state = itemStates[item.productId] ?? { receivedQty: item.expectedQty, rejectedQty: 0, rejectionReason: '' }
          const hasRejection = state.rejectedQty > 0
          const shortfall = Math.round((item.expectedQty - (state.receivedQty - state.rejectedQty)) * 1000) / 1000

          return (
            <div key={item.productId} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.productName}</p>
                  <p className="text-xs text-gray-400">
                    Esperado: <span className="font-medium text-gray-600">{item.expectedQty} {item.unit}</span>
                  </p>
                </div>
                {shortfall > 0.001 && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    Falta {shortfall} {item.unit}
                  </span>
                )}
              </div>

              {/* Received quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Recibido ({item.unit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={item.expectedQty}
                    step={item.unit === 'kg' || item.unit === 'liter' ? '0.1' : '1'}
                    value={state.receivedQty}
                    onChange={e => updateItem(item.productId, 'receivedQty', parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-base font-semibold border border-gray-300 rounded-xl py-3 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rechazado ({item.unit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={state.receivedQty}
                    step={item.unit === 'kg' || item.unit === 'liter' ? '0.1' : '1'}
                    value={state.rejectedQty}
                    onChange={e => updateItem(item.productId, 'rejectedQty', parseFloat(e.target.value) || 0)}
                    className={`w-full text-center text-base font-semibold border rounded-xl py-3 focus:outline-none ${
                      hasRejection
                        ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400'
                        : 'border-gray-300 focus:border-green-400'
                    }`}
                  />
                </div>
              </div>

              {/* Rejection reason — conditional */}
              {hasRejection && (
                <div>
                  <label className="block text-xs font-medium text-red-600 mb-1">
                    Motivo de rechazo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={state.rejectionReason}
                    onChange={e => updateItem(item.productId, 'rejectionReason', e.target.value)}
                    placeholder="Ej: producto en mal estado, color oscuro, presencia de hongos…"
                    className="w-full text-sm border border-red-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400 resize-none bg-red-50 placeholder:text-red-300"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploadingPhoto || !photoUrl}
        className="w-full py-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Guardando…' : 'Registrar recepción'}
      </button>

      {!photoUrl && !uploadingPhoto && (
        <p className="text-center text-xs text-gray-400">Agrega la foto para continuar</p>
      )}
    </form>
  )
}

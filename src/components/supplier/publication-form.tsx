'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { publicationSchema, type PublicationInput } from '@/lib/validations/supplier'
import type { CutoffOption } from '@/lib/utils/dispatch'
import type { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row'] & {
  category: { name: string } | null
}
type Region = Database['public']['Tables']['regions']['Row']
type Publication = Database['public']['Tables']['supplier_publications']['Row'] & {
  product: (Product & { category: { name: string } | null }) | null
  region: Region | null
}

interface PublicationFormProps {
  products: Product[]
  regions: Region[]
  cutoffs: CutoffOption[]
  publication?: Publication
}

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg',
  unit: 'und.',
  liter: 'lt',
  bunch: 'atado',
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export function PublicationForm({ products, regions, cutoffs, publication }: PublicationFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = !!publication

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PublicationInput>({
    resolver: zodResolver(publicationSchema),
    defaultValues: isEdit
      ? {
          product_id: publication.product_id,
          region_id: publication.region_id,
          available_quantity: publication.available_quantity,
          minimum_price: publication.minimum_price,
          expires_at: publication.expires_at,
        }
      : undefined,
  })

  async function onSubmit(data: PublicationInput) {
    setServerError(null)

    const url = isEdit
      ? `/api/supplier/publications/${publication!.id}`
      : '/api/supplier/publications'
    const method = isEdit ? 'PUT' : 'POST'

    const payload = isEdit
      ? { available_quantity: data.available_quantity, minimum_price: data.minimum_price }
      : data

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }

    router.push('/supplier/publications')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
        {isEdit ? (
          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
            {publication!.product?.name ?? '—'}{' '}
            <span className="text-gray-400">
              ({UNIT_LABEL[publication!.product?.unit ?? ''] ?? publication!.product?.unit})
            </span>
          </div>
        ) : (
          <>
            <select {...register('product_id')} className={inputCls}>
              <option value="">Selecciona un producto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({UNIT_LABEL[p.unit] ?? p.unit})
                  {p.category ? ` · ${p.category.name}` : ''}
                </option>
              ))}
            </select>
            {errors.product_id && (
              <p className="text-red-500 text-xs mt-1">{errors.product_id.message}</p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Región</label>
        {isEdit ? (
          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
            {publication!.region?.name} — {publication!.region?.city}
          </div>
        ) : (
          <>
            <select {...register('region_id')} className={inputCls}>
              <option value="">Selecciona una región</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.city}
                </option>
              ))}
            </select>
            {errors.region_id && (
              <p className="text-red-500 text-xs mt-1">{errors.region_id.message}</p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cantidad disponible
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            {...register('available_quantity', { valueAsNumber: true })}
            className={inputCls}
            placeholder="ej. 50"
          />
          {errors.available_quantity && (
            <p className="text-red-500 text-xs mt-1">{errors.available_quantity.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio mínimo (S/)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...register('minimum_price', { valueAsNumber: true })}
            className={inputCls}
            placeholder="ej. 3.50"
          />
          {errors.minimum_price && (
            <p className="text-red-500 text-xs mt-1">{errors.minimum_price.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo de despacho</label>
        {isEdit ? (
          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
            {cutoffs.find(c => c.isoString === publication!.expires_at)?.label ??
              new Date(publication!.expires_at).toLocaleDateString('es-PE')}
          </div>
        ) : (
          <>
            <select {...register('expires_at')} className={inputCls}>
              <option value="">Selecciona el ciclo</option>
              {cutoffs.map(c => (
                <option key={c.isoString} value={c.isoString}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.expires_at && (
              <p className="text-red-500 text-xs mt-1">{errors.expires_at.message}</p>
            )}
          </>
        )}
        <p className="text-xs text-gray-400 mt-1">
          La oferta se cerrará automáticamente al llegar el corte del ciclo seleccionado.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting
            ? isEdit
              ? 'Guardando...'
              : 'Publicando...'
            : isEdit
              ? 'Guardar cambios'
              : 'Publicar disponibilidad'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/supplier/publications')}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

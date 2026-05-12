'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { productSchema, type ProductInput } from '@/lib/validations/admin'
import type { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Category = Pick<Database['public']['Tables']['product_categories']['Row'], 'id' | 'name'>

interface ProductFormProps {
  categories: Category[]
  product?: Product
}

const UNIT_LABELS: Record<string, string> = {
  kg: 'Kilogramo (kg)',
  unit: 'Unidad',
  liter: 'Litro',
  bunch: 'Atado / Ramo',
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = !!product

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          category_id: product.category_id,
          name: product.name,
          description: product.description ?? '',
          unit: product.unit as ProductInput['unit'],
          image_url: product.image_url ?? '',
          is_active: product.is_active,
        }
      : { is_active: true },
  })

  async function onSubmit(data: ProductInput) {
    setServerError(null)
    const url = isEdit ? `/api/admin/products/${product.id}` : '/api/admin/products'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }

    router.push('/admin/products')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select {...register('category_id')} className={inputCls}>
          <option value="">Selecciona una categoría</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.category_id && (
          <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input {...register('name')} className={inputCls} placeholder="ej. Papaya maradol" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
        <select {...register('unit')} className={inputCls}>
          <option value="">Selecciona una unidad</option>
          {Object.entries(UNIT_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          {...register('description')}
          className={inputCls}
          rows={3}
          placeholder="Descripción breve del producto"
        />
        {errors.description && (
          <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL de imagen <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          {...register('image_url')}
          className={inputCls}
          placeholder="https://..."
          type="url"
        />
        {errors.image_url && (
          <p className="text-red-500 text-xs mt-1">{errors.image_url.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="prod_is_active"
          {...register('is_active')}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor="prod_is_active" className="text-sm text-gray-700">
          Activo
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

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
  'w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

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
        <label className={labelCls}>Categoría</label>
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
        <label className={labelCls}>Nombre</label>
        <input {...register('name')} className={inputCls} placeholder="ej. Papaya maradol" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className={labelCls}>Unidad de medida</label>
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
        <label className={labelCls}>
          Descripción <span className="text-gray-400 normal-case font-normal">(opcional)</span>
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
        <label className={labelCls}>
          URL de imagen <span className="text-gray-400 normal-case font-normal">(opcional)</span>
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
          className="rounded border-miski-sage text-miski-green focus:ring-miski-lime"
        />
        <label htmlFor="prod_is_active" className="text-sm text-gray-700">
          Activo
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="border border-miski-sage text-miski-forest hover:bg-miski-sage/30 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

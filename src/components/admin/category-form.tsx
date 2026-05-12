'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { categorySchema, type CategoryInput } from '@/lib/validations/admin'
import type { Database } from '@/types/database.types'

type Category = Database['public']['Tables']['product_categories']['Row']

interface CategoryFormProps {
  category?: Category
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export function CategoryForm({ category }: CategoryFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = !!category

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          // DB stores 0.0–1.0; form shows 0–100
          operational_cost_pct: Number(category.operational_cost_pct) * 100,
          suggested_margin_pct: Number(category.suggested_margin_pct) * 100,
          estimated_waste_pct: Number(category.estimated_waste_pct) * 100,
          is_active: category.is_active,
        }
      : { is_active: true, operational_cost_pct: 0, suggested_margin_pct: 0, estimated_waste_pct: 0 },
  })

  async function onSubmit(data: CategoryInput) {
    setServerError(null)
    const url = isEdit ? `/api/admin/categories/${category.id}` : '/api/admin/categories'
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

    router.push('/admin/categories')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input {...register('name')} className={inputCls} placeholder="ej. Frutas frescas" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Costo operativo %</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="99.99"
            {...register('operational_cost_pct', { valueAsNumber: true })}
            className={inputCls}
            placeholder="25"
          />
          {errors.operational_cost_pct && (
            <p className="text-red-500 text-xs mt-1">{errors.operational_cost_pct.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Margen sugerido %</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="99.99"
            {...register('suggested_margin_pct', { valueAsNumber: true })}
            className={inputCls}
            placeholder="20"
          />
          {errors.suggested_margin_pct && (
            <p className="text-red-500 text-xs mt-1">{errors.suggested_margin_pct.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Merma estimada %</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="99.99"
            {...register('estimated_waste_pct', { valueAsNumber: true })}
            className={inputCls}
            placeholder="8"
          />
          {errors.estimated_waste_pct && (
            <p className="text-red-500 text-xs mt-1">{errors.estimated_waste_pct.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="cat_is_active"
          {...register('is_active')}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor="cat_is_active" className="text-sm text-gray-700">
          Activa
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear categoría'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/categories')}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

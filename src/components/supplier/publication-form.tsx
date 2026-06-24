'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
  'w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta'

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface ProductSearchSelectProps {
  products: Product[]
  value: string
  onChange: (id: string) => void
}

// Searchable product picker: filters the master catalog by name/category as the
// supplier types, replacing the plain <select> which is unwieldy with many products.
function ProductSearchSelect({ products, value, onChange }: ProductSearchSelectProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = products.find(p => p.id === value) ?? null

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return products
    return products.filter(
      p => normalize(p.name).includes(q) || (p.category ? normalize(p.category.name).includes(q) : false),
    )
  }, [products, search])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? search : selected ? `${selected.name} (${UNIT_LABEL[selected.unit] ?? selected.unit})` : ''}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Busca un producto…"
        className={inputCls}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-miski-border rounded-lg shadow-lg py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-miski-muted">Sin resultados</li>
          ) : (
            filtered.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-miski-green-soft transition-colors ${
                    p.id === value ? 'bg-miski-lime/15 text-miski-forest font-medium' : 'text-miski-tinta'
                  }`}
                >
                  {p.name} <span className="text-miski-muted">({UNIT_LABEL[p.unit] ?? p.unit})</span>
                  {p.category ? <span className="text-miski-muted"> · {p.category.name}</span> : ''}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export function PublicationForm({ products, regions, cutoffs, publication }: PublicationFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = !!publication

  const {
    register,
    handleSubmit,
    control,
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
        <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">Producto</label>
        {isEdit ? (
          <div className="w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm bg-miski-green-soft text-gray-500">
            {publication!.product?.name ?? '—'}{' '}
            <span className="text-miski-muted">
              ({UNIT_LABEL[publication!.product?.unit ?? ''] ?? publication!.product?.unit})
            </span>
          </div>
        ) : (
          <>
            <Controller
              control={control}
              name="product_id"
              render={({ field }) => (
                <ProductSearchSelect
                  products={products}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.product_id && (
              <p className="text-red-500 text-xs mt-1">{errors.product_id.message}</p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">Región</label>
        {isEdit ? (
          <div className="w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm bg-miski-green-soft text-gray-500">
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
          <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
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
          <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
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
        <label className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">Ciclo de despacho</label>
        {isEdit ? (
          <div className="w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm bg-miski-green-soft text-gray-500">
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
        <p className="text-xs text-miski-muted mt-1">
          La oferta se cerrará automáticamente al llegar el corte del ciclo seleccionado.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

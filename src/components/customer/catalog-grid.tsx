'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'

export interface CatalogProduct {
  id: string
  name: string
  unit: string
  imageUrl: string | null
  description: string | null
  categoryName: string
  totalAvailable: number
  estimatedPrice: number
  nearestCutoff: string
  deliveryLabel: string
}

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg',
  unit: 'und.',
  liter: 'lt',
  bunch: 'atado',
}

interface ProductCardProps {
  product: CatalogProduct
}

function ProductCard({ product }: ProductCardProps) {
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCartStore(s => s.addItem)

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        imageUrl: product.imageUrl,
        maxQuantity: product.totalAvailable,
        nearestCutoff: product.nearestCutoff,
        deliveryLabel: product.deliveryLabel,
        estimatedPrice: product.estimatedPrice,
      },
      qty,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleQtyChange(value: string) {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    setQty(Math.min(Math.max(parsed, 1), Math.floor(product.totalAvailable)))
  }

  const unitLabel = UNIT_LABEL[product.unit] ?? product.unit
  const availableDisplay = Math.floor(product.totalAvailable).toLocaleString('es-PE')

  return (
    <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {product.imageUrl ? (
        <div className="relative w-full h-36 rounded-lg overflow-hidden">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
      ) : (
        <div className="w-full h-36 bg-miski-cream rounded-lg flex items-center justify-center">
          <span className="text-4xl font-light text-miski-olive">
            {product.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div>
        <span className="bg-miski-lime/15 text-miski-forest text-xs font-medium px-2 py-0.5 rounded-full">
          {product.categoryName}
        </span>
        <h3 className="text-base font-semibold text-miski-forest mt-1.5">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Disponible: {availableDisplay} {unitLabel}
        </span>
        <span className="font-bold text-miski-forest">
          {formatCurrency(product.estimatedPrice)}/{unitLabel}
        </span>
      </div>

      <p className="text-xs text-gray-400">{product.deliveryLabel}</p>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <input
          type="number"
          min={1}
          max={Math.floor(product.totalAvailable)}
          step={1}
          value={qty}
          onChange={e => handleQtyChange(e.target.value)}
          className="w-20 text-sm border border-miski-sage rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors text-gray-800"
        />
        <button
          onClick={handleAdd}
          className={`flex-1 text-sm font-semibold py-1.5 rounded-lg transition-all active:scale-[0.98] ${
            added
              ? 'bg-miski-lime/20 text-miski-forest cursor-default'
              : 'bg-miski-forest text-white hover:bg-miski-green'
          }`}
        >
          {added ? 'Agregado al carrito' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

interface CatalogGridProps {
  products: CatalogProduct[]
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const ALL_CATEGORIES = '__all__'

export function CatalogGrid({ products }: CatalogGridProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES)

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.categoryName))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [products])

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return products.filter(p => {
      if (activeCategory !== ALL_CATEGORIES && p.categoryName !== activeCategory) return false
      if (!q) return true
      return (
        normalize(p.name).includes(q) ||
        (p.description ? normalize(p.description).includes(q) : false) ||
        normalize(p.categoryName).includes(q)
      )
    })
  }, [products, search, activeCategory])

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg font-medium">No hay productos disponibles ahora.</p>
        <p className="text-gray-400 text-sm mt-1">
          Vuelve a consultar antes del próximo corte de pedidos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-miski-olive"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-4.65a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-miski-sage rounded-xl focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors text-gray-800 placeholder:text-gray-400"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory(ALL_CATEGORIES)}
          className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
            activeCategory === ALL_CATEGORIES
              ? 'bg-miski-forest text-white border-miski-forest'
              : 'bg-white text-miski-forest border-miski-sage hover:bg-miski-sage/20'
          }`}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
              activeCategory === cat
                ? 'bg-miski-forest text-white border-miski-forest'
                : 'bg-white text-miski-forest border-miski-sage hover:bg-miski-sage/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs text-miski-olive">
        {filtered.length === products.length
          ? `${products.length} producto${products.length !== 1 ? 's' : ''}`
          : `${filtered.length} de ${products.length} producto${products.length !== 1 ? 's' : ''}`}
      </p>

      {/* Unified product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm font-medium">Sin resultados para tu búsqueda.</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setActiveCategory(ALL_CATEGORIES) }}
            className="text-xs text-miski-green hover:text-miski-forest font-semibold mt-2"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

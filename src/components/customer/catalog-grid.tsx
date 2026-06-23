'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/stores/cart'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PriceTag } from '@/components/ui/price-tag'

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
  const [reserving, setReserving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addItem = useCartStore(s => s.addItem)
  const existingInCart = useCartStore(
    s => s.items.find(i => i.productId === product.id)?.quantity ?? 0
  )

  async function handleAdd() {
    setError(null)
    const desiredTotal = Math.min(existingInCart + qty, Math.floor(product.totalAvailable))
    setReserving(true)
    try {
      // Reserva temporal en servidor para evitar sobreventa entre clientes
      const res = await fetch('/api/customer/cart/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: desiredTotal }),
      })
      const data = await res.json()
      if (!res.ok) {
        const avail = typeof data.available === 'number' ? data.available : 0
        setError(avail > 0 ? `Solo quedan ${avail} disponibles` : 'Sin stock disponible')
        return
      }
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
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setReserving(false)
    }
  }

  function handleQtyChange(value: string) {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    setQty(Math.min(Math.max(parsed, 1), Math.floor(product.totalAvailable)))
  }

  const unitLabel = UNIT_LABEL[product.unit] ?? product.unit
  const availableDisplay = Math.floor(product.totalAvailable).toLocaleString('es-PE')
  const priceUnit = product.unit as 'kg' | 'unit' | 'liter' | 'bunch'

  return (
    <Card className="p-5 flex flex-col gap-3 transition-shadow hover:shadow-md">
      <div className="relative">
        {product.imageUrl ? (
          <div className="relative w-full h-36 rounded-xl overflow-hidden">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        ) : (
          <div className="w-full h-36 bg-miski-green-soft rounded-xl flex items-center justify-center">
            <span className="font-display text-4xl font-bold text-miski-green/70">
              {product.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <Badge tone="fresh" className="absolute top-2 left-2 shadow-sm">◣ fresco</Badge>
      </div>

      <div>
        <Badge tone="neutral">{product.categoryName}</Badge>
        <h3 className="font-display text-base font-bold text-miski-forest mt-1.5">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-miski-muted mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>

      <div className="flex items-end justify-between">
        <span className="text-xs text-miski-muted">
          Disponible: <span className="tabular text-miski-tinta">{availableDisplay}</span> {unitLabel}
        </span>
        <PriceTag amount={product.estimatedPrice} unit={priceUnit} size="md" />
      </div>

      <p className="text-xs text-miski-muted">{product.deliveryLabel}</p>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <input
          type="number"
          min={1}
          max={Math.floor(product.totalAvailable)}
          step={1}
          value={qty}
          onChange={e => handleQtyChange(e.target.value)}
          aria-label={`Cantidad de ${product.name}`}
          className="w-20 h-10 tabular text-sm border border-miski-border rounded-xl px-2 text-center text-miski-tinta focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors"
        />
        <Button
          onClick={handleAdd}
          disabled={reserving}
          variant={added ? 'secondary' : 'primary'}
          size="sm"
          fullWidth
          className="flex-1"
        >
          {reserving ? 'Reservando…' : added ? '✓ Agregado' : '+ Agregar'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
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
        <p className="font-display text-lg font-bold text-miski-forest">No hay productos disponibles ahora.</p>
        <p className="text-miski-muted text-sm mt-1">
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
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-miski-muted"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-4.65a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full h-11 pl-10 pr-4 text-sm bg-white border border-miski-border rounded-xl focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors text-miski-tinta placeholder:text-miski-muted/60"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory(ALL_CATEGORIES)}
          className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
            activeCategory === ALL_CATEGORIES
              ? 'bg-miski-forest text-white border-miski-forest'
              : 'bg-white text-miski-forest border-miski-border hover:bg-miski-green-soft'
          }`}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
              activeCategory === cat
                ? 'bg-miski-forest text-white border-miski-forest'
                : 'bg-white text-miski-forest border-miski-border hover:bg-miski-green-soft'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs text-miski-muted">
        {filtered.length === products.length
          ? `${products.length} producto${products.length !== 1 ? 's' : ''}`
          : `${filtered.length} de ${products.length} producto${products.length !== 1 ? 's' : ''}`}
      </p>

      {/* Unified product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-miski-muted text-sm font-medium">Sin resultados para tu búsqueda.</p>
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

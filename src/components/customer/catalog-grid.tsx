'use client'

import { useState } from 'react'
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

export function CatalogGrid({ products }: CatalogGridProps) {
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

  const byCategory = products.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
    if (!acc[p.categoryName]) acc[p.categoryName] = []
    acc[p.categoryName].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category}>
          <h2 className="text-base font-semibold text-miski-forest mb-4 pb-2 border-b border-miski-sage/30">
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useCartStore } from '@/stores/cart'
import { formatCurrency } from '@/lib/utils'
import { PriceTag } from '@/components/ui/price-tag'

const linkBtn =
  'inline-flex items-center justify-center font-display font-semibold rounded-xl bg-miski-green text-white ' +
  'hover:bg-miski-forest transition-colors px-6 py-3 text-sm'

export function CartPage() {
  const { items, updateQuantity, removeItem } = useCartStore()

  const subtotal = items.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-lg font-bold text-miski-forest">Tu carrito está vacío.</p>
        <p className="text-sm text-miski-muted mt-1 mb-5">Agrega productos frescos del catálogo.</p>
        <Link href="/customer/catalog" className={linkBtn}>Ver catálogo</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-5">Tu carrito</h1>
      <div className="overflow-hidden rounded-2xl border border-miski-border bg-white mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-miski-green-soft text-miski-forest/70 text-xs font-semibold uppercase tracking-wider">
              <th className="text-left px-4 py-3">Producto</th>
              <th className="text-center px-4 py-3">Cantidad</th>
              <th className="text-right px-4 py-3">Precio unit.</th>
              <th className="text-right px-4 py-3">Subtotal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const priceUnit = item.unit as 'kg' | 'unit' | 'liter' | 'bunch'
              return (
                <tr key={item.productId} className="hover:bg-miski-green-soft/40">
                  <td className="px-4 py-3 border-b border-miski-border/60">
                    <p className="font-display font-bold text-miski-forest">{item.name}</p>
                    <p className="text-xs text-miski-muted mt-0.5">{item.deliveryLabel}</p>
                  </td>
                  <td className="px-4 py-3 border-b border-miski-border/60 text-center">
                    <input
                      type="number"
                      min={1}
                      max={Math.floor(item.maxQuantity)}
                      step={1}
                      value={item.quantity}
                      onChange={e => updateQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                      aria-label={`Cantidad de ${item.name}`}
                      className="w-16 h-9 tabular text-sm border border-miski-border rounded-xl px-2 text-center text-miski-tinta focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3 border-b border-miski-border/60 text-right">
                    <PriceTag amount={item.estimatedPrice} unit={priceUnit} size="sm" />
                  </td>
                  <td className="px-4 py-3 border-b border-miski-border/60 text-right tabular font-semibold text-miski-forest">
                    {formatCurrency(item.estimatedPrice * item.quantity)}
                  </td>
                  <td className="px-4 py-3 border-b border-miski-border/60 text-right">
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-miski-green-soft rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-miski-muted">Total estimado</p>
          <p className="font-display text-2xl font-extrabold tabular text-miski-forest">{formatCurrency(subtotal)}</p>
          <p className="text-xs text-miski-muted mt-0.5">El precio final se confirma al procesar el pago.</p>
        </div>
        <Link href="/customer/checkout" className={linkBtn}>Ir al pago</Link>
      </div>
    </div>
  )
}

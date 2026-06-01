'use client'

import Link from 'next/link'
import { useCartStore } from '@/stores/cart'
import { formatCurrency } from '@/lib/utils'

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg', unit: 'und.', liter: 'lt', bunch: 'atado',
}

export function CartPage() {
  const { items, updateQuantity, removeItem } = useCartStore()

  const subtotal = items.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg font-medium">Tu carrito está vacío.</p>
        <Link
          href="/customer/catalog"
          className="mt-4 inline-block bg-miski-forest text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-miski-green transition-all active:scale-[0.98]"
        >
          Ver catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-miski-sage/40 bg-white mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 bg-miski-forest/5 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Producto</th>
              <th className="text-center px-4 py-3 bg-miski-forest/5 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Cantidad</th>
              <th className="text-right px-4 py-3 bg-miski-forest/5 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Precio unit.</th>
              <th className="text-right px-4 py-3 bg-miski-forest/5 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Subtotal</th>
              <th className="px-4 py-3 bg-miski-forest/5" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const unitLabel = UNIT_LABEL[item.unit] ?? item.unit
              return (
                <tr key={item.productId} className="hover:bg-miski-cream/20">
                  <td className="px-4 py-3 border-b border-miski-sage/20 text-gray-700">
                    <p className="font-medium text-miski-forest">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.deliveryLabel}</p>
                  </td>
                  <td className="px-4 py-3 border-b border-miski-sage/20 text-gray-700 text-center">
                    <input
                      type="number"
                      min={1}
                      max={Math.floor(item.maxQuantity)}
                      step={1}
                      value={item.quantity}
                      onChange={e => updateQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                      className="w-16 text-sm border border-miski-sage rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors hover:bg-miski-cream/50 text-gray-800"
                    />
                  </td>
                  <td className="px-4 py-3 border-b border-miski-sage/20 text-gray-700 text-right">
                    {formatCurrency(item.estimatedPrice)}/{unitLabel}
                  </td>
                  <td className="px-4 py-3 border-b border-miski-sage/20 text-gray-700 text-right font-medium text-miski-forest">
                    {formatCurrency(item.estimatedPrice * item.quantity)}
                  </td>
                  <td className="px-4 py-3 border-b border-miski-sage/20 text-gray-700 text-right">
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

      <div className="bg-miski-cream/30 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-miski-olive">Total estimado</p>
          <p className="text-2xl font-bold text-miski-forest">{formatCurrency(subtotal)}</p>
          <p className="text-xs text-gray-400 mt-0.5">El precio final se confirma al procesar el pago.</p>
        </div>
        <Link
          href="/customer/checkout"
          className="bg-miski-forest text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-miski-green transition-all active:scale-[0.98]"
        >
          Ir al pago
        </Link>
      </div>
    </div>
  )
}

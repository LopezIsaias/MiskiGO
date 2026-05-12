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
          className="mt-4 inline-block bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Ver catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Cantidad</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Precio unit.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Subtotal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => {
              const unitLabel = UNIT_LABEL[item.unit] ?? item.unit
              return (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.deliveryLabel}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      max={Math.floor(item.maxQuantity)}
                      step={1}
                      value={item.quantity}
                      onChange={e => updateQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                      className="w-16 text-sm border border-gray-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(item.estimatedPrice)}/{unitLabel}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(item.estimatedPrice * item.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right">
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

      <div className="flex items-center justify-between">
        <div className="text-right">
          <p className="text-sm text-gray-500">Total estimado</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(subtotal)}</p>
          <p className="text-xs text-gray-400 mt-0.5">El precio final se confirma al procesar el pago.</p>
        </div>
        <Link
          href="/customer/checkout"
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          Ir al pago
        </Link>
      </div>
    </div>
  )
}

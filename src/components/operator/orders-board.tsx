'use client'

import { OrderCard } from './order-card'
export type { Order, OrderItem, SupplierAssignment } from './order-card'

interface Props {
  orders: import('./order-card').Order[]
}

const STATUS_GROUPS = [
  { key: 'payment_submitted', label: 'Pendientes de aprobación',           badge: 'bg-amber-100 text-amber-700' },
  { key: 'confirmed',         label: 'Aprobados — pendientes de asignación', badge: 'bg-blue-100 text-blue-700' },
  { key: 'assigned',          label: 'Proveedores asignados',               badge: 'bg-green-100 text-green-700' },
  { key: 'in_transit',        label: 'En camino',                           badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'delivered',         label: 'Entregados',                          badge: 'bg-purple-100 text-purple-700' },
  { key: 'failed',            label: 'Fallidos',                            badge: 'bg-red-100 text-red-700' },
] as const

export function OrdersBoard({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-12 text-center bg-white rounded-xl border border-gray-200">
        No hay pedidos en el ciclo activo
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {STATUS_GROUPS.map(group => {
        const groupOrders = orders.filter(o => o.status === group.key)
        if (groupOrders.length === 0) return null
        const failedCount = groupOrders.filter(o => o.items.some(i => i.itemStatus === 'failed')).length
        return (
          <section key={group.key}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-700">{group.label}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${group.badge}`}>
                {groupOrders.length}
              </span>
              {failedCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {failedCount} con problema
                </span>
              )}
            </div>
            <div className="space-y-3">
              {groupOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

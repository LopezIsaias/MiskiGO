import { formatDateTime, formatCurrency } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  pending_payment:   'Pend. pago',
  payment_submitted: 'Comprobante',
  confirmed:         'Confirmado',
  assigned:          'Asignado',
  in_transit:        'En camino',
  delivered:         'Entregado',
  completed:         'Completado',
  cancelled:         'Cancelado',
  failed:            'Fallido',
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment:   'bg-gray-100 text-gray-600',
  payment_submitted: 'bg-yellow-100 text-yellow-700',
  confirmed:         'bg-blue-100 text-blue-700',
  assigned:          'bg-indigo-100 text-indigo-700',
  in_transit:        'bg-purple-100 text-purple-700',
  delivered:         'bg-green-100 text-green-700',
  completed:         'bg-green-100 text-green-700',
  cancelled:         'bg-red-100 text-red-600',
  failed:            'bg-red-100 text-red-600',
}

export interface RecentOrder {
  id:           string
  status:       string
  customerName: string
  total:        number
  createdAt:    string
}

interface Props { orders: RecentOrder[] }

export function RecentOrdersTable({ orders }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Pedidos recientes</h3>

      {orders.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">Sin pedidos en el período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">ID</th>
                <th className="text-left pb-2 font-medium">Cliente</th>
                <th className="text-left pb-2 font-medium">Estado</th>
                <th className="text-right pb-2 font-medium">Monto</th>
                <th className="text-right pb-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-400 font-mono">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="py-2 text-gray-700 max-w-[120px] truncate">{o.customerName}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(o.total)}</td>
                  <td className="py-2 text-right text-gray-400 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

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
  pending_payment:   'bg-miski-sage/30 text-miski-forest/60',
  payment_submitted: 'bg-miski-gold-light/40 text-amber-800',
  confirmed:         'bg-miski-lime/20 text-miski-forest',
  assigned:          'bg-miski-lime/20 text-miski-forest',
  in_transit:        'bg-blue-100 text-blue-700',
  delivered:         'bg-miski-lime/20 text-miski-forest',
  completed:         'bg-miski-lime/20 text-miski-forest',
  cancelled:         'bg-red-100 text-red-700',
  failed:            'bg-red-100 text-red-700',
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
    <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-miski-forest mb-4">Pedidos recientes</h3>

      {orders.length === 0 ? (
        <p className="text-xs text-miski-olive text-center py-10">Sin pedidos en el período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-miski-forest/60 border-b border-miski-sage/20 text-xs font-semibold uppercase tracking-wider">
                <th className="text-left pb-2">ID</th>
                <th className="text-left pb-2">Cliente</th>
                <th className="text-left pb-2">Estado</th>
                <th className="text-right pb-2">Monto</th>
                <th className="text-right pb-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-miski-sage/20">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-miski-cream/30 transition-colors">
                  <td className="py-2 text-miski-olive font-mono border-b border-miski-sage/20">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="py-2 text-gray-700 max-w-[120px] truncate border-b border-miski-sage/20">{o.customerName}</td>
                  <td className="py-2 border-b border-miski-sage/20">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      STATUS_COLOR[o.status] ?? 'bg-miski-sage/30 text-miski-forest/60'
                    }`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-miski-forest border-b border-miski-sage/20">{formatCurrency(o.total)}</td>
                  <td className="py-2 text-right text-miski-olive whitespace-nowrap border-b border-miski-sage/20">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

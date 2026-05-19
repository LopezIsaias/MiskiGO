import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatCurrency } from '@/lib/utils'
import { DeliveryClaimBanner } from '@/components/customer/delivery-claim-banner'

export const metadata: Metadata = { title: 'Mis pedidos' }

const STATUS_LABEL: Record<string, string> = {
  pending_payment:  'Pendiente de pago',
  payment_submitted: 'Pago enviado',
  confirmed:        'Confirmado',
  assigned:         'Asignado',
  in_transit:       'En camino',
  delivered:        'Entregado',
  completed:        'Completado',
  cancelled:        'Cancelado',
  failed:           'Fallido',
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment:   'bg-yellow-100 text-yellow-800',
  payment_submitted: 'bg-blue-100 text-blue-800',
  confirmed:         'bg-blue-100 text-blue-800',
  assigned:          'bg-indigo-100 text-indigo-800',
  in_transit:        'bg-orange-100 text-orange-800',
  delivered:         'bg-green-100 text-green-800',
  completed:         'bg-green-100 text-green-800',
  cancelled:         'bg-gray-100 text-gray-600',
  failed:            'bg-red-100 text-red-800',
}

type RawOrder = {
  id:                     string
  status:                 string
  total_amount:           number
  delivery_address:       string
  delivered_at:           string | null
  claim_window_expires_at: string | null
  created_at:             string
  items: {
    quantity:        number
    unit_price_frozen: number
    product: { name: string; unit: string } | null
  }[]
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: rawOrders } = await adminClient
    .from('orders')
    .select(`
      id, status, total_amount, delivery_address,
      delivered_at, claim_window_expires_at, created_at,
      items:order_items!order_id(
        quantity, unit_price_frozen,
        product:products!product_id(name, unit)
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  const orders = (rawOrders ?? []) as unknown as RawOrder[]

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Mis pedidos</h1>

      {orders.length === 0 ? (
        <p className="text-gray-400 text-sm">Aún no tienes pedidos.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">
                    {formatDate(order.created_at)} · #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{order.delivery_address}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.product?.name ?? '—'}</span>
                    <span className="font-medium">
                      {item.quantity} {item.product?.unit} · {formatCurrency(item.unit_price_frozen)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500">Total</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
              </div>

              {order.status === 'delivered' && order.claim_window_expires_at && (
                <DeliveryClaimBanner
                  orderId={order.id}
                  claimWindowExpiresAt={order.claim_window_expires_at}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

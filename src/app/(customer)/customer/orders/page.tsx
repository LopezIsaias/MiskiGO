import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'
import { DeliveryClaimBanner } from '@/components/customer/delivery-claim-banner'
import { OrderStatusBar } from '@/components/customer/order-status-bar'
import { CancelOrderButton } from '@/components/customer/cancel-order-button'

export const metadata: Metadata = { title: 'Mis pedidos' }

const STATUS_LABEL: Record<string, string> = {
  pending_payment:   'Pendiente de pago',
  payment_submitted: 'Pago enviado',
  confirmed:         'Confirmado',
  assigned:          'Asignado',
  in_transit:        'En camino',
  delivered:         'Entregado',
  in_storage:        'En almacén',
  completed:         'Completado',
  cancelled:         'Cancelado',
  failed:            'Fallido',
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment:   'bg-miski-gold-light/50 text-miski-forest',
  payment_submitted: 'bg-miski-gold-light/50 text-miski-forest',
  confirmed:         'bg-miski-green-soft text-miski-forest',
  assigned:          'bg-miski-green-soft text-miski-forest',
  in_transit:        'bg-miski-lime-pale text-miski-forest',
  delivered:         'bg-miski-green-soft text-miski-forest',
  in_storage:        'bg-miski-gold-light/50 text-miski-forest',
  completed:         'bg-miski-green-soft text-miski-forest',
  cancelled:         'bg-red-100 text-red-700',
  failed:            'bg-red-100 text-red-700',
}

type RawOrder = {
  id:                       string
  status:                   string
  total_amount:             number
  delivery_address:         string
  delivered_at:             string | null
  claim_window_expires_at:  string | null
  created_at:               string
  delivery_confirmation_code: string | null
  cancellation_requested_at: string | null
  dispatch_cycle: { dispatch_date: string } | { dispatch_date: string }[] | null
  receipt: { number: string; type: string } | { number: string; type: string }[] | null
  items: {
    quantity:          number
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
      delivery_confirmation_code, cancellation_requested_at,
      dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date),
      receipt:receipts!order_id(number, type),
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
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-6">Mis pedidos</h1>

      {orders.length === 0 ? (
        <p className="text-miski-muted text-sm">Aún no tienes pedidos.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const cycle = Array.isArray(order.dispatch_cycle) ? order.dispatch_cycle[0] : order.dispatch_cycle
            const today = new Date().toISOString().slice(0, 10)
            // Vencido: sigue 'confirmed' pero la fecha de despacho ya pasó (el cron
            // lo pasará a 'failed'; mientras tanto no mostramos código ni cancelación).
            const isOverdue = order.status === 'confirmed' && cycle != null && cycle.dispatch_date < today
            return (
            <div key={order.id} className="bg-white rounded-2xl border border-miski-border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-miski-muted tabular">
                    {formatDate(order.created_at)} · #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm text-miski-tinta mt-0.5">{order.delivery_address}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-miski-gold-light/50 text-miski-forest'}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-miski-muted">
                    <span>{item.product?.name ?? '—'}</span>
                    <span className="tabular text-miski-tinta">
                      {item.quantity} {item.product?.unit} · {formatCurrency(item.unit_price_frozen)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-miski-border pt-3">
                <span className="text-xs text-miski-muted">Total</span>
                <span className="tabular text-sm font-bold text-miski-forest">{formatCurrency(order.total_amount)}</span>
              </div>

              {/* Barra de estado del pedido */}
              <OrderStatusBar status={order.status} />

              {/* Aviso neutral para pedidos vencidos aún sin resolver */}
              {isOverdue && (
                <div className="mt-3 bg-miski-gold-light/20 border border-miski-gold/40 rounded-xl px-4 py-3">
                  <p className="text-sm text-miski-forest">
                    Tu pedido está en proceso. Nos pondremos en contacto contigo a la brevedad.
                  </p>
                </div>
              )}

              {/* Cancelación: solo mientras esté 'confirmed', no vencido y aún no 'assigned' (CLAUDE.md §4: aprobación manual) */}
              {order.status === 'confirmed' && !isOverdue && (
                <CancelOrderButton
                  orderId={order.id}
                  alreadyRequested={order.cancellation_requested_at !== null}
                />
              )}

              {/* Comprobante emitido */}
              {(() => {
                const receipt = Array.isArray(order.receipt) ? order.receipt[0] : order.receipt
                if (!receipt) return null
                return (
                  <div className="mt-3 flex items-center justify-between bg-miski-green-soft border border-miski-border rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-xs text-miski-muted capitalize">{receipt.type}</p>
                      <p className="text-sm font-semibold text-miski-forest tabular">{receipt.number}</p>
                    </div>
                    <Link
                      href={`/customer/orders/${order.id}/receipt`}
                      className="text-xs font-semibold text-miski-green hover:text-miski-forest"
                    >
                      Ver comprobante
                    </Link>
                  </div>
                )
              })()}

              {/* Confirmation code — visible desde que el pedido se confirma */}
              {['confirmed', 'assigned', 'in_transit'].includes(order.status) && !isOverdue && order.delivery_confirmation_code && (
                <div className="mt-3 bg-miski-forest rounded-xl px-4 py-3">
                  <p className="text-xs text-miski-lime font-semibold mb-1">Código de confirmación de entrega</p>
                  <p className="tabular text-3xl font-bold text-white tracking-[0.3em]">
                    {order.delivery_confirmation_code}
                  </p>
                  <p className="text-xs text-white/60 mt-1">Dáselo al repartidor cuando llegue</p>
                </div>
              )}

              {/* In-storage banner */}
              {order.status === 'in_storage' && (
                <div className="mt-3 bg-miski-gold-light/20 border border-miski-gold/40 rounded-xl px-4 py-3">
                  <p className="text-sm text-miski-forest">
                    Tu pedido está en nuestro almacén esperando ser recogido. Coordina con nosotros para la entrega.
                  </p>
                </div>
              )}

              {order.status === 'delivered' && order.claim_window_expires_at && (
                <DeliveryClaimBanner
                  orderId={order.id}
                  claimWindowExpiresAt={order.claim_window_expires_at}
                />
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

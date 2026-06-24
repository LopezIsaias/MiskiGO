import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MobileHeader } from '@/components/delivery/mobile-header'
import { DeliveryNav } from '@/components/delivery/delivery-nav'
import { formatDate, formatDateTime } from '@/lib/utils'

// ── Raw query types ──────────────────────────────────────────────────────────

type RawRoute = {
  dispatch_cycle_id: string
  dispatch_cycle: { dispatch_date: string } | null
  delivery_stops: { order_id: string; status: string; completed_at: string | null }[]
}

type RawOrder = {
  id: string
  status: string
  delivery_address: string
  delivered_at: string | null
  customer: { full_name: string } | null
  items: {
    quantity: number
    product: { name: string; unit: string } | null
  }[]
}

type HistoryEntry = {
  orderId: string
  customerName: string
  deliveryAddress: string
  deliveredAt: string | null
  cycleDate: string
  items: { productName: string; quantity: number; unit: string }[]
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DeliveryHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['delivery', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // Todas las rutas de este repartidor con sus paradas entregadas
  const { data: rawRoutes } = await adminClient
    .from('delivery_routes')
    .select(`
      dispatch_cycle_id,
      dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date),
      delivery_stops(order_id, status, completed_at)
    `)
    .eq('delivery_person_id', user.id)

  const routes = (rawRoutes ?? []) as unknown as RawRoute[]

  // order_id → { cycleDate, completedAt } solo para paradas entregadas
  const stopMeta = new Map<string, { cycleDate: string; completedAt: string | null }>()
  for (const r of routes) {
    const cycleDate = r.dispatch_cycle?.dispatch_date ?? ''
    for (const s of r.delivery_stops ?? []) {
      if (s.status === 'delivered') {
        stopMeta.set(s.order_id, { cycleDate, completedAt: s.completed_at })
      }
    }
  }

  const orderIds = [...stopMeta.keys()]

  if (orderIds.length === 0) {
    return (
      <div>
        <MobileHeader title="Historial" />
        <DeliveryNav />
        <div className="p-6 text-center">
          <p className="text-miski-muted text-sm mt-8">
            Aún no tienes pedidos entregados.
          </p>
        </div>
      </div>
    )
  }

  // Pedidos entregados (sin precios — el repartidor nunca ve montos)
  const { data: rawOrders } = await adminClient
    .from('orders')
    .select(`
      id, status, delivery_address, delivered_at,
      customer:users!customer_id(full_name),
      items:order_items!order_id(
        quantity,
        product:products!product_id(name, unit)
      )
    `)
    .in('id', orderIds)

  const orders = (rawOrders ?? []) as unknown as RawOrder[]

  const entries: HistoryEntry[] = orders.map(o => {
    const meta = stopMeta.get(o.id)
    return {
      orderId:         o.id,
      customerName:    o.customer?.full_name ?? 'Cliente',
      deliveryAddress: o.delivery_address,
      deliveredAt:     meta?.completedAt ?? o.delivered_at,
      cycleDate:       meta?.cycleDate ?? '',
      items: o.items
        .filter(it => it.product)
        .map(it => ({
          productName: it.product!.name,
          quantity:    it.quantity,
          unit:        it.product!.unit,
        })),
    }
  })

  // Más recientes primero
  entries.sort((a, b) => {
    const ta = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0
    const tb = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0
    return tb - ta
  })

  return (
    <div>
      <MobileHeader title="Historial" />
      <DeliveryNav />
      <div className="px-4 py-2 bg-white border-b border-miski-border">
        <p className="text-xs text-miski-muted">
          {entries.length} pedido{entries.length > 1 ? 's' : ''} entregado{entries.length > 1 ? 's' : ''}
        </p>
      </div>
      <div className="p-4 space-y-3">
        {entries.map(e => (
          <div
            key={e.orderId}
            className="bg-white rounded-xl border border-miski-border p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-miski-forest text-sm">{e.customerName}</p>
              {e.cycleDate && (
                <span className="text-[11px] text-miski-muted whitespace-nowrap">
                  {formatDate(e.cycleDate + 'T12:00:00')}
                </span>
              )}
            </div>
            <p className="text-xs text-miski-muted mt-0.5">{e.deliveryAddress}</p>
            {e.deliveredAt && (
              <p className="text-[11px] text-miski-lime mt-1">
                Entregado: {formatDateTime(e.deliveredAt)}
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {e.items.map((it, i) => (
                <li key={i} className="text-xs text-miski-tinta">
                  {it.quantity} {it.unit} · {it.productName}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

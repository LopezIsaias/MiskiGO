import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MobileHeader } from '@/components/delivery/mobile-header'
import { DeliveryNav } from '@/components/delivery/delivery-nav'
import { DeliveryRouteBoard } from '@/components/delivery/delivery-route-board'
import { formatDate } from '@/lib/utils'
import type { StopData } from '@/components/delivery/delivery-route-board'

// ── Raw query types ──────────────────────────────────────────────────────────

type RawOrder = {
  id: string
  status: string
  delivery_address: string
  customer_note: string | null
  delivery_notes: string | null
  delivered_at: string | null
  claim_window_expires_at: string | null
  delivery_confirmation_code: string | null
  delivery_attempts: number
  customer: { full_name: string } | null
  items: {
    quantity: number
    product: { name: string; unit: string } | null
  }[]
}

type DirectionsJson = {
  status: string
  routes: { waypoint_order: number[] }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function optimizeWaypointOrder(
  addresses: string[],
  apiKey: string,
): Promise<number[]> {
  const n = addresses.length
  const identity = Array.from({ length: n }, (_, i) => i)
  if (n <= 2) return identity

  const suffix = ', San Martín, Perú'
  const params = new URLSearchParams({
    origin:     addresses[0] + suffix,
    destination: addresses[n - 1] + suffix,
    waypoints:  `optimize:true|${addresses.slice(1, n - 1).map(a => a + suffix).join('|')}`,
    key:        apiKey,
  })

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return identity
    const data = await res.json() as DirectionsJson
    if (data.status !== 'OK' || !data.routes[0]?.waypoint_order) return identity
    // waypoint_order indexes into the middle array (indices 1..n-2 in full array)
    return [0, ...data.routes[0].waypoint_order.map(i => i + 1), n - 1]
  } catch {
    return identity
  }
}

function buildStaticMapUrl(addresses: string[], apiKey: string): string {
  const params = new URLSearchParams({ size: '600x240', scale: '2', key: apiKey })
  addresses.forEach((addr, i) => {
    params.append('markers', `color:0x16a34a|label:${i + 1}|${addr}, San Martín, Perú`)
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

function buildGoogleMapsUrl(addresses: string[]): string {
  if (addresses.length === 0) return 'https://maps.google.com'
  const suffix = ', San Martín, Perú'
  const enc = (a: string) => encodeURIComponent(a + suffix)
  if (addresses.length === 1) return `https://maps.google.com/?q=${enc(addresses[0])}`
  const origin = enc(addresses[0])
  const dest   = enc(addresses[addresses.length - 1])
  const wps    = addresses.slice(1, -1).map(enc).join('|')
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps ? `&waypoints=${wps}` : ''}&travelmode=driving`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DeliveryRoutePage() {
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

  // Active cycle must be in_progress for deliveries
  const { data: cycles } = await adminClient
    .from('dispatch_cycles')
    .select('id, dispatch_date, status')
    .eq('status', 'in_progress')
    .order('dispatch_date', { ascending: false })
    .limit(1)

  const cycle = cycles?.[0] ?? null

  if (!cycle) {
    return (
      <div>
        <MobileHeader title="Ruta" />
        <DeliveryNav />
        <div className="p-6 text-center">
          <p className="text-miski-olive text-sm mt-8">
            No hay ciclo activo en progreso. El operador debe iniciar el despacho primero.
          </p>
        </div>
      </div>
    )
  }

  const cycleId    = cycle.id
  const cycleLabel = `Despacho ${formatDate(cycle.dispatch_date + 'T12:00:00')}`

  // Existing route for this delivery person
  const { data: route } = await adminClient
    .from('delivery_routes')
    .select('id, delivery_stops(order_id, status, failure_reason)')
    .eq('delivery_person_id', user.id)
    .eq('dispatch_cycle_id', cycleId)
    .maybeSingle()

  const routeId = route?.id ?? null

  // Stop statuses indexed by orderId (only if route exists)
  type StopRow = { order_id: string; status: string; failure_reason: string | null }
  const stopStatusMap = new Map<string, { status: string; failureReason: string | null }>(
    ((route?.delivery_stops ?? []) as unknown as StopRow[]).map(s => [
      s.order_id,
      { status: s.status, failureReason: s.failure_reason },
    ])
  )

  // Orders to show: if route exists show its orders; otherwise all assigned for cycle
  let orderIds: string[] | null = null
  if (routeId) {
    orderIds = [...stopStatusMap.keys()]
  }

  const ordersQuery = adminClient
    .from('orders')
    .select(`
      id, status, delivery_address, customer_note, delivery_notes,
      delivered_at, claim_window_expires_at,
      delivery_confirmation_code, delivery_attempts,
      customer:users!customer_id(full_name),
      items:order_items!order_id(
        quantity,
        product:products!product_id(name, unit)
      )
    `)
    .eq('dispatch_cycle_id', cycleId)
    .in('status', ['assigned', 'in_transit', 'delivered', 'in_storage'])
    .order('created_at', { ascending: true })

  const { data: rawOrders } = orderIds
    ? await ordersQuery.in('id', orderIds)
    : await ordersQuery

  const orders = (rawOrders ?? []) as unknown as RawOrder[]

  if (orders.length === 0) {
    return (
      <div>
        <MobileHeader title="Ruta" subtitle={cycleLabel} />
        <DeliveryNav />
        <div className="p-6 text-center">
          <p className="text-miski-olive text-sm mt-4">
            No hay pedidos asignados para entregar en este ciclo.
          </p>
        </div>
      </div>
    )
  }

  // Optimize route with Directions API (server-side)
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''
  const addresses = orders.map(o => o.delivery_address)
  const optimizedIdx = mapsKey
    ? await optimizeWaypointOrder(addresses, mapsKey)
    : addresses.map((_, i) => i)

  const orderedOrders = optimizedIdx.map(i => orders[i])

  // Build map URLs
  const orderedAddresses = orderedOrders.map(o => o.delivery_address)
  const staticMapUrl  = mapsKey ? buildStaticMapUrl(orderedAddresses, mapsKey) : null
  const googleMapsUrl = buildGoogleMapsUrl(orderedAddresses)

  // Build typed stops
  const stops: StopData[] = orderedOrders.map((o, idx) => {
    const stopInfo = stopStatusMap.get(o.id)
    return {
      orderId:                    o.id,
      stopOrder:                  idx + 1,
      customerName:               o.customer?.full_name ?? 'Cliente',
      deliveryAddress:            o.delivery_address,
      customerNote:               o.customer_note,
      deliveryNotes:              o.delivery_notes,
      orderStatus:                o.status,
      stopStatus:                 stopInfo?.status ?? null,
      failureReason:              stopInfo?.failureReason ?? null,
      deliveredAt:                o.delivered_at,
      claimWindowExpiresAt:       o.claim_window_expires_at,
      deliveryConfirmationCode:   o.delivery_confirmation_code,
      deliveryAttempts:           o.delivery_attempts ?? 0,
      items: o.items
        .filter(it => it.product)
        .map(it => ({
          productName: it.product!.name,
          quantity:    it.quantity,
          unit:        it.product!.unit,
        })),
    }
  })

  const pendingCount   = stops.filter(s => s.orderStatus !== 'delivered' && s.stopStatus !== 'failed').length
  const deliveredCount = stops.filter(s => s.orderStatus === 'delivered').length

  return (
    <div>
      <MobileHeader title="Ruta" subtitle={cycleLabel} />
      <DeliveryNav />
      <div className="px-4 py-2 bg-white border-b border-miski-sage/20">
        <p className="text-xs text-miski-olive">
          {stops.length} paradas · {pendingCount} pendientes · {deliveredCount} entregadas
        </p>
      </div>
      <DeliveryRouteBoard
        cycleId={cycleId}
        routeId={routeId}
        staticMapUrl={staticMapUrl}
        googleMapsUrl={googleMapsUrl}
        initialStops={stops}
      />
    </div>
  )
}

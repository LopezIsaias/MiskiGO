import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DeliveriesBoard } from '@/components/operator/deliveries-board'
import type { DeliveryPersonRow, DeliveryStop } from '@/components/operator/deliveries-board'

export const metadata: Metadata = { title: 'Repartidores activos' }

type RawRoute = {
  id:     string
  status: string
  delivery_person: { id: string; full_name: string } | null
}

type RawStop = {
  id:         string
  route_id:   string
  order_id:   string
  stop_order: number
  status:     string
}

export default async function DeliveriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // Active cycle
  const { data: cycles } = await adminClient
    .from('dispatch_cycles')
    .select('id, dispatch_date')
    .in('status', ['in_progress', 'closed'])
    .order('dispatch_date', { ascending: false })
    .limit(1)

  const cycle = cycles?.[0] ?? null

  let deliveryPeople: DeliveryPersonRow[] = []

  if (cycle) {
    const { data: rawRoutes } = await adminClient
      .from('delivery_routes')
      .select(`
        id, status,
        delivery_person:users!delivery_person_id(id, full_name)
      `)
      .eq('dispatch_cycle_id', cycle.id)
      .in('status', ['pending', 'in_progress', 'completed'])

    const routes = (rawRoutes ?? []) as unknown as RawRoute[]
    const routeIds = routes.map(r => r.id)

    const { data: rawStops } = routeIds.length > 0
      ? await adminClient
          .from('delivery_stops')
          .select('id, route_id, order_id, stop_order, status')
          .in('route_id', routeIds)
          .order('stop_order', { ascending: true })
      : { data: [] }

    const stops = (rawStops ?? []) as unknown as RawStop[]

    deliveryPeople = routes.map((route): DeliveryPersonRow => ({
      personId:    route.delivery_person?.id ?? route.id,
      personName:  route.delivery_person?.full_name ?? 'Repartidor desconocido',
      routeId:     route.id,
      routeStatus: route.status,
      stops: stops
        .filter(s => s.route_id === route.id)
        .map((s): DeliveryStop => ({
          stopId:    s.id,
          orderId:   s.order_id,
          stopOrder: s.stop_order,
          status:    s.status,
        })),
    }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-miski-forest">Repartidores activos</h1>
        <p className="text-sm text-miski-olive mt-1">
          {cycle
            ? `Ciclo del ${cycle.dispatch_date} — ${deliveryPeople.length} repartidor${deliveryPeople.length !== 1 ? 'es' : ''}`
            : 'No hay ciclo activo en este momento'}
        </p>
      </div>

      <DeliveriesBoard initialData={deliveryPeople} />
    </div>
  )
}

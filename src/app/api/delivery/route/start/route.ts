import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  stops: z.array(z.object({
    orderId:   z.string().uuid(),
    stopOrder: z.number().int().min(1),
  })).min(1),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['delivery', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const { cycleId, stops } = parsed.data
  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  const { data: cycle } = await adminClient
    .from('dispatch_cycles')
    .select('id, region_id, status')
    .eq('id', cycleId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (!cycle) return NextResponse.json({ error: 'Ciclo no encontrado o no activo' }, { status: 404 })

  // Return existing route if already started
  const { data: existing } = await adminClient
    .from('delivery_routes')
    .select('id')
    .eq('delivery_person_id', user.id)
    .eq('dispatch_cycle_id', cycleId)
    .maybeSingle()

  if (existing) return NextResponse.json({ routeId: existing.id })

  const { data: newRoute, error: routeErr } = await adminClient
    .from('delivery_routes')
    .insert({
      delivery_person_id: user.id,
      dispatch_cycle_id:  cycleId,
      region_id:          cycle.region_id,
      status:             'in_progress',
      started_at:         now,
    })
    .select('id')
    .maybeSingle()

  if (routeErr || !newRoute) {
    return NextResponse.json({ error: 'Error al crear ruta' }, { status: 500 })
  }

  await adminClient.from('delivery_stops').insert(
    stops.map(s => ({
      route_id:   newRoute.id,
      order_id:   s.orderId,
      stop_order: s.stopOrder,
      status:     'pending',
    }))
  )

  // Transition all assigned orders → in_transit
  await adminClient
    .from('orders')
    .update({ status: 'in_transit' })
    .in('id', stops.map(s => s.orderId))
    .eq('status', 'assigned')

  return NextResponse.json({ routeId: newRoute.id })
}

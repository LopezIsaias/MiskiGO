import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { autoSourceOrderConfirmed } from '@/lib/utils/supplier-assignment'

// POST: tras capturar la oferta del proveedor (publicaciones on-behalf), asigna
// todos los pedidos 'confirmed' del ciclo a las publicaciones disponibles
// (cheapest-first §4), confirmando las asignaciones (proveedor offline).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cycleId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status, region_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: cycle } = await admin
    .from('dispatch_cycles')
    .select('id, region_id')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 })
  if (profile!.role === 'operator' && cycle.region_id !== profile!.region_id) {
    return NextResponse.json({ error: 'Ciclo fuera de tu región' }, { status: 403 })
  }

  const { data: orders } = await admin
    .from('orders')
    .select('id')
    .eq('dispatch_cycle_id', cycleId)
    .eq('status', 'confirmed')

  let assigned = 0, failed = 0, pending = 0
  for (const o of orders ?? []) {
    const r = await autoSourceOrderConfirmed(admin, o.id)
    assigned += r.assigned; failed += r.failed; pending += r.pending
  }

  await admin.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.SUPPLIER_ASSIGNED,
    module: AUDIT_MODULES.ORDERS,
    region_id: cycle.region_id,
    entity_type: 'dispatch_cycle',
    entity_id: cycleId,
    new_value: { orders: (orders ?? []).length, items_assigned: assigned, items_failed: failed, items_pending: pending },
  })

  return NextResponse.json({ orders: (orders ?? []).length, assigned, failed, pending })
}

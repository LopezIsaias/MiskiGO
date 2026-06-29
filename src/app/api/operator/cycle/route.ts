import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveRegionId } from '@/lib/supabase/region'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.object({
  dispatch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  region_id:     z.string().uuid().optional(),
})

// POST: abre un ciclo de despacho (status 'open') para una región y fecha.
// En demanda-primero el operador abre el ciclo proactivamente; el checkout ya
// no lo crea de forma lazy. cutoff_at = día anterior 12:00 Lima (17:00 UTC).
export async function POST(request: Request) {
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

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const adminClient = createAdminClient()

  // Operador: su región. Superadmin: region_id del body o, en MVP de región única,
  // la única región activa.
  const regionId =
    profile!.role === 'operator'
      ? profile!.region_id
      : (parsed.data.region_id ?? (await getActiveRegionId(adminClient)))
  if (!regionId) {
    return NextResponse.json({ error: 'Región no especificada' }, { status: 400 })
  }

  // cutoff_at = (dispatch_date - 1 día) 12:00 Lima = 17:00 UTC
  const cutoff = new Date(parsed.data.dispatch_date + 'T00:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  cutoff.setUTCHours(17, 0, 0, 0)

  // Idempotencia: si ya existe el ciclo (UNIQUE region+date), devolverlo.
  const { data: existing } = await adminClient
    .from('dispatch_cycles')
    .select('id, status')
    .eq('region_id', regionId)
    .eq('dispatch_date', parsed.data.dispatch_date)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, status: existing.status, existed: true })
  }

  const { data: cycle, error } = await adminClient
    .from('dispatch_cycles')
    .insert({
      region_id: regionId,
      dispatch_date: parsed.data.dispatch_date,
      cutoff_at: cutoff.toISOString(),
      status: 'open',
    })
    .select('id, status')
    .single()

  if (error || !cycle) {
    return NextResponse.json({ error: 'Error al crear el ciclo' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.DISPATCH_CYCLE_CREATED,
    module: AUDIT_MODULES.SYSTEM,
    region_id: regionId,
    entity_type: 'dispatch_cycle',
    entity_id: cycle.id,
    new_value: { dispatch_date: parsed.data.dispatch_date, cutoff_at: cutoff.toISOString() },
  })

  return NextResponse.json({ id: cycle.id, status: cycle.status }, { status: 201 })
}

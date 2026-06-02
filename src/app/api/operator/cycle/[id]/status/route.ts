import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES, nextCycleStatus } from '@/lib/constants'

const bodySchema = z.object({
  newStatus: z.enum(['closed', 'in_progress', 'completed']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
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
    return NextResponse.json({ error: 'Estado inválido' }, { status: 422 })
  }

  const { newStatus } = parsed.data
  const adminClient = createAdminClient()

  const { data: cycle } = await adminClient
    .from('dispatch_cycles')
    .select('id, status, dispatch_date')
    .eq('id', id)
    .maybeSingle()

  if (!cycle) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 })

  const expectedNew = nextCycleStatus(cycle.status)
  if (expectedNew !== newStatus) {
    return NextResponse.json({
      error: `Transición no permitida: ${cycle.status} → ${newStatus}`,
    }, { status: 422 })
  }

  const { error: updateError } = await adminClient
    .from('dispatch_cycles')
    .update({ status: newStatus })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Error al actualizar el ciclo' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.DISPATCH_CYCLE_STATUS_CHANGED,
    module: AUDIT_MODULES.SYSTEM,
    entity_type: 'dispatch_cycle',
    entity_id: id,
    previous_value: { status: cycle.status },
    new_value: { status: newStatus, dispatch_date: cycle.dispatch_date },
  })

  return NextResponse.json({ success: true, status: newStatus })
}

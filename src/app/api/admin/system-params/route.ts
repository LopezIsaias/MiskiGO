import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { systemParamsSchema } from '@/lib/validations/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.role !== 'superadmin') return null
  return { supabase, userId: user.id }
}

export async function GET() {
  const auth = await requireSuperadmin()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [paramsRes, catsRes] = await Promise.all([
    auth.supabase.from('system_params').select('*').order('key'),
    auth.supabase
      .from('product_categories')
      .select('id, name, slug, operational_cost_pct, suggested_margin_pct, estimated_waste_pct, is_active')
      .order('name'),
  ])

  if (paramsRes.error) return NextResponse.json({ error: paramsRes.error.message }, { status: 500 })
  if (catsRes.error) return NextResponse.json({ error: catsRes.error.message }, { status: 500 })

  return NextResponse.json({ params: paramsRes.data, categories: catsRes.data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = systemParamsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { cutoff_hour, claim_window_hours, categories } = parsed.data
  const adminClient = createAdminClient()

  // Load previous values for audit
  const { data: prevParams } = await auth.supabase
    .from('system_params')
    .select('key, value')
    .in('key', ['cutoff_hour', 'claim_window_hours'])

  const prevMap: Record<string, string> = {}
  for (const p of prevParams ?? []) prevMap[p.key] = p.value

  // Update global params
  const paramUpdates = [
    { key: 'cutoff_hour', value: String(cutoff_hour) },
    { key: 'claim_window_hours', value: String(claim_window_hours) },
  ]

  for (const p of paramUpdates) {
    const { error } = await adminClient
      .from('system_params')
      .update({ value: p.value, updated_by: auth.userId, updated_at: new Date().toISOString() })
      .eq('key', p.key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update category parameters
  for (const cat of categories) {
    const { error } = await adminClient
      .from('product_categories')
      .update({
        operational_cost_pct: cat.operational_cost_pct / 100,
        suggested_margin_pct: cat.suggested_margin_pct / 100,
        estimated_waste_pct: cat.estimated_waste_pct / 100,
      })
      .eq('id', cat.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local'
  await adminClient.from('audit_log').insert({
    user_id: auth.userId,
    role_at_time: 'superadmin',
    action: AUDIT_ACTIONS.SYSTEM_PARAMS_UPDATED,
    module: AUDIT_MODULES.SYSTEM,
    entity_type: 'system_params',
    ip_address: ip,
    previous_value: {
      cutoff_hour: prevMap['cutoff_hour'],
      claim_window_hours: prevMap['claim_window_hours'],
    },
    new_value: {
      cutoff_hour,
      claim_window_hours,
      categories_updated: categories.length,
    },
  })

  return NextResponse.json({ ok: true })
}

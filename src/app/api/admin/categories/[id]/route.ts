import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { categorySchema } from '@/lib/validations/admin'
import { toSlug } from '@/lib/utils'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

async function requireSuperadmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.role !== 'superadmin') return null
  return { supabase, userId: user.id }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body: unknown = await request.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { name, operational_cost_pct, suggested_margin_pct, estimated_waste_pct, is_active } =
    parsed.data

  const { data: previous } = await ctx.supabase
    .from('product_categories')
    .select('name, operational_cost_pct, suggested_margin_pct, estimated_waste_pct, is_active')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await ctx.supabase
    .from('product_categories')
    .update({
      name,
      slug: toSlug(name),
      operational_cost_pct: operational_cost_pct / 100,
      suggested_margin_pct: suggested_margin_pct / 100,
      estimated_waste_pct: estimated_waste_pct / 100,
      is_active,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const adminClient = createAdminClient()
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local'
  await adminClient.from('audit_log').insert({
    user_id:        ctx.userId,
    role_at_time:   'superadmin',
    action:         AUDIT_ACTIONS.CATEGORY_UPDATED,
    module:         AUDIT_MODULES.PRODUCTS,
    entity_type:    'product_category',
    entity_id:      id,
    ip_address:     ip,
    previous_value: previous ?? null,
    new_value: {
      name,
      operational_cost_pct: operational_cost_pct / 100,
      suggested_margin_pct: suggested_margin_pct / 100,
      estimated_waste_pct:  estimated_waste_pct / 100,
      is_active,
    },
  })

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { is_active } = (await request.json()) as { is_active: boolean }

  const { data, error } = await ctx.supabase
    .from('product_categories')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorySchema } from '@/lib/validations/admin'
import { toSlug } from '@/lib/utils'

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
  return supabase
}

export async function GET() {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { name, operational_cost_pct, suggested_margin_pct, estimated_waste_pct, is_active } =
    parsed.data

  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      name,
      slug: toSlug(name),
      // Form sends 0–100; DB stores 0.0–1.0
      operational_cost_pct: operational_cost_pct / 100,
      suggested_margin_pct: suggested_margin_pct / 100,
      estimated_waste_pct: estimated_waste_pct / 100,
      is_active,
    })
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

  return NextResponse.json(data, { status: 201 })
}

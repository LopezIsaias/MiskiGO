import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productSchema } from '@/lib/validations/admin'
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
  return { supabase, userId: user.id }
}

export async function GET() {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await ctx.supabase
    .from('products')
    .select('*, category:product_categories!category_id(name)')
    .is('deleted_at', null)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { category_id, name, description, unit, image_url, is_active } = parsed.data

  const { data, error } = await ctx.supabase
    .from('products')
    .insert({
      category_id,
      name,
      slug: toSlug(name),
      description: description ?? null,
      unit,
      image_url: image_url || null,
      is_active,
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese nombre' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

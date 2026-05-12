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
  return supabase
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body: unknown = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { category_id, name, description, unit, image_url, is_active } = parsed.data

  const { data, error } = await supabase
    .from('products')
    .update({
      category_id,
      name,
      slug: toSlug(name),
      description: description ?? null,
      unit,
      image_url: image_url || null,
      is_active,
    })
    .eq('id', id)
    .is('deleted_at', null)
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

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { is_active } = (await request.json()) as { is_active: boolean }

  const { data, error } = await supabase
    .from('products')
    .update({ is_active })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

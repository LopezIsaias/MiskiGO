import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publicationSchema } from '@/lib/validations/supplier'

async function requireSupplier() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, status').eq('id', user.id).maybeSingle()
  if (data?.role !== 'supplier' || data?.status !== 'active') return null
  return { supabase, userId: user.id }
}

export async function GET() {
  const ctx = await requireSupplier()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { supabase, userId } = ctx
  const { data, error } = await supabase
    .from('supplier_publications')
    .select(`
      *,
      product:products!product_id(id, name, unit, image_url, category:product_categories!category_id(name)),
      region:regions!region_id(id, name, city)
    `)
    .eq('supplier_id', userId)
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const ctx = await requireSupplier()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = publicationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { supabase, userId } = ctx
  const { product_id, region_id, available_quantity, minimum_price, expires_at } = parsed.data

  // Verify product exists and is active
  const { data: product } = await supabase
    .from('products')
    .select('id, is_active, deleted_at')
    .eq('id', product_id)
    .maybeSingle()

  if (!product || !product.is_active || product.deleted_at) {
    return NextResponse.json({ error: 'Producto no disponible' }, { status: 400 })
  }

  // Verify region is active
  const { data: region } = await supabase
    .from('regions')
    .select('id, is_active')
    .eq('id', region_id)
    .maybeSingle()

  if (!region || !region.is_active) {
    return NextResponse.json({ error: 'Región no disponible' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('supplier_publications')
    .insert({
      supplier_id: userId,
      product_id,
      region_id,
      available_quantity,
      minimum_price,
      expires_at,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

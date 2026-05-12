import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

async function requireSupplier() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, status').eq('id', user.id).maybeSingle()
  if (data?.role !== 'supplier' || data?.status !== 'active') return null
  return { supabase, userId: user.id }
}

const updateSchema = z.object({
  available_quantity: z
    .number()
    .min(0.001, 'La cantidad debe ser mayor a 0'),
  minimum_price: z
    .number()
    .min(0.01, 'El precio mínimo debe ser mayor a 0'),
})

// PUT: update quantity and price (only if active and owned by supplier)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSupplier()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { supabase, userId } = ctx

  const { data: pub } = await supabase
    .from('supplier_publications')
    .select('status, supplier_id')
    .eq('id', id)
    .maybeSingle()

  if (!pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  if (pub.supplier_id !== userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (pub.status !== 'active') {
    return NextResponse.json({ error: 'Solo se pueden editar publicaciones activas' }, { status: 400 })
  }

  const { error } = await supabase
    .from('supplier_publications')
    .update({
      available_quantity: parsed.data.available_quantity,
      minimum_price: parsed.data.minimum_price,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: cancel publication (set status to expired, only if active and owned)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSupplier()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { supabase, userId } = ctx

  const { data: pub } = await supabase
    .from('supplier_publications')
    .select('status, supplier_id')
    .eq('id', id)
    .maybeSingle()

  if (!pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  if (pub.supplier_id !== userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (pub.status !== 'active') {
    return NextResponse.json({ error: 'Solo se pueden cancelar publicaciones activas' }, { status: 400 })
  }

  const { error } = await supabase
    .from('supplier_publications')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

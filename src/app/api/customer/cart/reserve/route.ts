import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getReservedByOthers } from '@/lib/utils/stock-reservations'
import { RESERVATION_TTL_MINUTES } from '@/lib/constants'

const bodySchema = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().positive(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'customer' || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  const { productId, quantity } = parsed.data

  const admin = createAdminClient()

  // Stock activo disponible del producto (suma de publicaciones vigentes)
  const { data: pubs } = await admin
    .from('supplier_publications')
    .select('available_quantity')
    .eq('product_id', productId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())

  const pubTotal = (pubs ?? []).reduce((s, p) => s + (p.available_quantity ?? 0), 0)

  // Reservas activas de OTROS clientes
  const othersMap = await getReservedByOthers(admin, [productId], user.id)
  const reservedByOthers = othersMap.get(productId) ?? 0
  const available = Math.round((pubTotal - reservedByOthers) * 1000) / 1000

  if (quantity > available) {
    return NextResponse.json(
      { error: 'Stock insuficiente', available: Math.max(0, Math.floor(available)) },
      { status: 409 }
    )
  }

  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Upsert: una reserva activa por (cliente, producto)
  const { data: existing } = await admin
    .from('stock_reservations')
    .select('id')
    .eq('customer_id', user.id)
    .eq('product_id', productId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('stock_reservations')
      .update({ quantity, expires_at: expiresAt, updated_at: now })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: 'No se pudo reservar' }, { status: 500 })
  } else {
    const { error } = await admin
      .from('stock_reservations')
      .insert({ customer_id: user.id, product_id: productId, quantity, expires_at: expiresAt })
    if (error) return NextResponse.json({ error: 'No se pudo reservar' }, { status: 500 })
  }

  return NextResponse.json({ success: true, available: Math.floor(available), expiresAt })
}

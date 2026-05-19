import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  photoUrl: z.string().url('URL de foto inválida'),
  items: z.array(z.object({
    productId:       z.string().uuid(),
    claimedQuantity: z.number().positive('La cantidad debe ser mayor a 0'),
    reason:          z.string().min(1, 'El motivo es obligatorio'),
  })).min(1, 'Selecciona al menos un producto'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['customer', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
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

  const { data: order } = await adminClient
    .from('orders')
    .select('id, customer_id, status, claim_window_expires_at')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .eq('status', 'delivered')
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado o no disponible para reclamos' }, { status: 404 })
  }

  if (!order.claim_window_expires_at || new Date() > new Date(order.claim_window_expires_at)) {
    return NextResponse.json({ error: 'El plazo de reclamo ha vencido' }, { status: 410 })
  }

  const { photoUrl, items } = parsed.data

  const { error: insertError } = await adminClient
    .from('claims')
    .insert(
      items.map(item => ({
        order_id:         orderId,
        customer_id:      user.id,
        product_id:       item.productId,
        claimed_quantity: item.claimedQuantity,
        reason:           item.reason,
        photo_url:        photoUrl,
        status:           'pending' as const,
      }))
    )

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar el reclamo' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

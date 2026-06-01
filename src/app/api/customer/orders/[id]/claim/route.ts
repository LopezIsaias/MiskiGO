import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  photoUrl:      z.string().url('URL de foto inválida'),
  photoMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  items: z.array(z.object({
    productId:       z.string().uuid(),
    claimedQuantity: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad debe ser al menos 1'),
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

  const { photoUrl, photoMetadata, items } = parsed.data
  const now = new Date().toISOString()

  const insertRows = items.map(item => ({
    order_id:         orderId,
    customer_id:      user.id,
    product_id:       item.productId,
    claimed_quantity: item.claimedQuantity,
    reason:           item.reason,
    photo_url:        photoUrl,
    photo_metadata:   (photoMetadata ?? null) as never,
    status:           'pending' as const,
  }))
  const { error: insertError } = await adminClient
    .from('claims')
    .insert(insertRows)

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar el reclamo' }, { status: 500 })
  }

  // Notify operators if photo appears to be old (DateTimeOriginal > 2h ago)
  const dateStr = photoMetadata?.DateTimeOriginal as string | undefined
  if (dateStr) {
    const taken = new Date(dateStr)
    const diffHours = (Date.now() - taken.getTime()) / (1000 * 60 * 60)
    if (diffHours > 2) {
      const { data: operators } = await adminClient
        .from('users')
        .select('id')
        .in('role', ['operator', 'superadmin'])
        .eq('status', 'active')
        .limit(5)
      if (operators && operators.length > 0) {
        await adminClient.from('notifications').insert(
          operators.map((op: { id: string }) => ({
            recipient_id:   op.id,
            type:           'stale_photo_warning',
            channel:        'in_app',
            title:          'Foto posiblemente no tomada en el momento del evento',
            body:           `Un reclamo del pedido #${orderId.slice(0,8).toUpperCase()} incluye una foto tomada el ${taken.toLocaleString('es-PE')}. Verificar autenticidad.`,
            reference_type: 'order',
            reference_id:   orderId,
            status:         'sent',
            sent_at:        now,
          }))
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}

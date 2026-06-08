import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractExifFromUrl } from '@/lib/utils/exif-server'
import { checkPhotoCaptureWindow, blocksClaim, photoVerificationMessage } from '@/lib/utils/exif-validation'

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
    .select('id, customer_id, status, claim_window_expires_at, delivered_at')
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
  const now = new Date().toISOString()

  // Fuente de verdad: extraer EXIF del archivo subido en el servidor (no se
  // confía en la metadata que envía el cliente) y validar contra la entrega.
  const serverExif = await extractExifFromUrl(photoUrl)
  const check = checkPhotoCaptureWindow(serverExif.takenAt, order.delivered_at)

  // Fuera de ventana (anterior a la entrega o fecha futura): se rechaza.
  if (blocksClaim(check.verification)) {
    return NextResponse.json({ error: photoVerificationMessage(check.verification) }, { status: 422 })
  }

  const insertRows = items.map(item => ({
    order_id:          orderId,
    customer_id:       user.id,
    product_id:        item.productId,
    claimed_quantity:  item.claimedQuantity,
    reason:            item.reason,
    photo_url:         photoUrl,
    photo_metadata:    (serverExif.raw ?? null) as never,
    photo_taken_at:    (check.takenAt ?? null) as never,
    photo_verification: check.verification as never,
    status:            'pending' as const,
  }))
  const { error: insertError } = await adminClient
    .from('claims')
    .insert(insertRows)

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar el reclamo' }, { status: 500 })
  }

  // Si no se pudo verificar la fecha (sin EXIF), avisar a operadores para revisión manual.
  if (check.verification === 'unknown') {
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
          type:           'claim_photo_unverified',
          channel:        'in_app',
          title:          'Reclamo con foto sin fecha verificable',
          body:           `Un reclamo del pedido #${orderId.slice(0,8).toUpperCase()} incluye una foto sin fecha de captura (EXIF). Verificar autenticidad manualmente.`,
          reference_type: 'order',
          reference_id:   orderId,
          status:         'sent',
          sent_at:        now,
        }))
      )
    }
  }

  return NextResponse.json({ success: true })
}

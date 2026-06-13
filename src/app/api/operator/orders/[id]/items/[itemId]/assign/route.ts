import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { decrementPublicationStock } from '@/lib/utils/stock'

const assignSchema = z.object({
  publicationId: z.string().uuid(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: orderId, itemId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'publicationId requerido' }, { status: 422 })
  const { publicationId } = parsed.data

  const adminClient = createAdminClient()

  const { data: orderItem } = await adminClient
    .from('order_items')
    .select('id, order_id, product_id, quantity, unit_price_frozen, status')
    .eq('id', itemId)
    .maybeSingle()

  if (!orderItem) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (orderItem.order_id !== orderId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: pub } = await adminClient
    .from('supplier_publications')
    .select('id, available_quantity, supplier_id, minimum_price, status')
    .eq('id', publicationId)
    .maybeSingle()

  if (!pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  if (pub.status !== 'active') return NextResponse.json({ error: 'Publicación no disponible' }, { status: 400 })
  if (pub.available_quantity <= 0) return NextResponse.json({ error: 'Sin stock disponible' }, { status: 400 })

  // Compute remaining quantity needed for this item
  const { data: existingAsgs } = await adminClient
    .from('order_item_assignments')
    .select('assigned_quantity')
    .eq('order_item_id', itemId)
    .eq('status', 'confirmed')

  const alreadyCovered = (existingAsgs ?? []).reduce(
    (s, a) => Math.round((s + a.assigned_quantity) * 1000) / 1000, 0,
  )
  const remaining = Math.round((orderItem.quantity - alreadyCovered) * 1000) / 1000

  if (remaining <= 0.001) {
    return NextResponse.json({ error: 'El ítem ya está completamente asignado' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Descuento atómico (RPC con FOR UPDATE) — evita sobreventa si el stock cambió.
  const deducted = await decrementPublicationStock(adminClient, pub.id, remaining)
  if (deducted <= 0) return NextResponse.json({ error: 'Sin stock disponible' }, { status: 400 })

  await adminClient.from('order_item_assignments').insert({
    order_item_id: itemId,
    publication_id: pub.id,
    supplier_id: pub.supplier_id,
    assigned_quantity: deducted,
    supplier_price_frozen: pub.minimum_price,
    platform_margin_frozen: Math.round((orderItem.unit_price_frozen - pub.minimum_price) * 100) / 100,
    status: 'confirmed',
    confirmed_at: now,
  })

  // If now fully covered, advance item status and check if order is fully assigned
  const newCovered = Math.round((alreadyCovered + deducted) * 1000) / 1000
  const itemFullyCovered = newCovered >= orderItem.quantity - 0.001

  if (itemFullyCovered) {
    await adminClient.from('order_items').update({ status: 'assigned' }).eq('id', itemId)

    const { data: allItems } = await adminClient
      .from('order_items')
      .select('id, status')
      .eq('order_id', orderId)

    const allAssigned = (allItems ?? []).every(i => i.id === itemId ? true : i.status === 'assigned')
    if (allAssigned) {
      await adminClient.from('orders').update({ status: 'assigned' }).eq('id', orderId)
    }
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.SUPPLIER_MANUALLY_ASSIGNED,
    module: AUDIT_MODULES.ORDERS,
    entity_type: 'order_item',
    entity_id: itemId,
    new_value: {
      publication_id: pub.id,
      supplier_id: pub.supplier_id,
      assigned_quantity: deducted,
      item_fully_covered: itemFullyCovered,
    },
  })

  return NextResponse.json({ success: true, assignedQty: deducted, itemFullyCovered })
}

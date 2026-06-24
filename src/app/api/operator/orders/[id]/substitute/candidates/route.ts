import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: publicaciones activas con stock en la región del pedido, candidatas a
// sustituir un ítem fallido (cualquier producto). El operador elige una y propone.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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
  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select('region_id').eq('id', orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  let query = admin
    .from('supplier_publications')
    .select('id, available_quantity, minimum_price, product:products!product_id(id, name, unit), supplier:users!supplier_id(full_name)')
    .eq('status', 'active')
    .gt('available_quantity', 0)
    .order('minimum_price', { ascending: true })
  if (order.region_id) query = query.eq('region_id', order.region_id)

  const { data } = await query

  type Row = {
    id: string
    available_quantity: number
    minimum_price: number
    product: { id: string; name: string; unit: string } | null
    supplier: { full_name: string } | null
  }

  const candidates = ((data ?? []) as unknown as Row[]).map(p => ({
    publicationId: p.id,
    productId:     p.product?.id ?? '',
    productName:   p.product?.name ?? '—',
    unit:          p.product?.unit ?? '',
    supplierName:  p.supplier?.full_name ?? '—',
    availableQty:  Number(p.available_quantity),
    minimumPrice:  Number(p.minimum_price),
  }))

  return NextResponse.json({ candidates })
}

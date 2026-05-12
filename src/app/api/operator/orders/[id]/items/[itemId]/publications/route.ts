import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PubRow = {
  id: string
  available_quantity: number
  minimum_price: number
  supplier: { id: string; full_name: string; reputation_score: number } | null
}

export async function GET(
  _request: Request,
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

  const adminClient = createAdminClient()

  const { data: orderItem } = await adminClient
    .from('order_items')
    .select('id, product_id, order_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!orderItem) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (orderItem.order_id !== orderId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: rawPubs } = await adminClient
    .from('supplier_publications')
    .select(`
      id, available_quantity, minimum_price,
      supplier:users!supplier_id(id, full_name, reputation_score)
    `)
    .eq('product_id', orderItem.product_id)
    .eq('status', 'active')
    .gt('available_quantity', 0)
    .order('minimum_price', { ascending: true })
    .order('published_at', { ascending: true })

  const pubs = ((rawPubs ?? []) as unknown as PubRow[])
    .sort((a, b) => {
      if (a.minimum_price !== b.minimum_price) return a.minimum_price - b.minimum_price
      return (b.supplier?.reputation_score ?? 0) - (a.supplier?.reputation_score ?? 0)
    })
    .map(p => ({
      id: p.id,
      supplierName: p.supplier?.full_name ?? '—',
      availableQty: p.available_quantity,
      minimumPrice: p.minimum_price,
    }))

  return NextResponse.json({ publications: pubs })
}

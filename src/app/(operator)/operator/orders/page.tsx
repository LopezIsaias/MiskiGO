import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OrdersBoard } from '@/components/operator/orders-board'
import type { Order, OrderItem, SupplierAssignment } from '@/components/operator/orders-board'
import { formatDate } from '@/lib/utils'

type RawAssignment = {
  id: string
  assigned_quantity: number
  supplier_price_frozen: number
  status: string
  failure_reason: string | null
  supplier: { full_name: string; reliability_score: number | null } | null
}

type RawItem = {
  id: string
  quantity: number
  unit_price_frozen: number
  subtotal_frozen: number
  status: string
  product_id: string
  product: { name: string; unit: string } | null
  order_item_assignments: RawAssignment[]
}

type RawOrder = {
  id: string
  status: string
  total_amount: number
  payment_method: string | null
  created_at: string
  delivery_address: string
  customer: { full_name: string; phone: string | null } | null
  dispatch_cycle: { dispatch_date: string } | null
  order_items: RawItem[]
}

export default async function OperatorOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  const { data: activeCycles } = await adminClient
    .from('dispatch_cycles')
    .select('id')
    .in('status', ['open', 'closed', 'in_progress'])

  const cycleIds = activeCycles?.map(c => c.id) ?? []
  let orders: Order[] = []

  if (cycleIds.length > 0) {
    const { data: rawOrders } = await adminClient
      .from('orders')
      .select(`
        id, status, total_amount, payment_method, created_at, delivery_address,
        customer:users!customer_id(full_name, phone),
        dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date),
        order_items(
          id, quantity, unit_price_frozen, subtotal_frozen, status, product_id,
          product:products!product_id(name, unit),
          order_item_assignments(
            id, assigned_quantity, supplier_price_frozen, status, failure_reason,
            supplier:users!supplier_id(full_name, reliability_score)
          )
        )
      `)
      .in('dispatch_cycle_id', cycleIds)
      .in('status', ['payment_submitted', 'confirmed', 'assigned', 'in_transit', 'delivered', 'failed'])
      .order('created_at', { ascending: false })

    orders = ((rawOrders ?? []) as unknown as RawOrder[]).map((raw): Order => ({
      id: raw.id,
      status: raw.status,
      totalAmount: raw.total_amount,
      paymentMethod: raw.payment_method,
      createdAt: raw.created_at,
      deliveryAddress: raw.delivery_address,
      deliveryDate: raw.dispatch_cycle?.dispatch_date
        ? formatDate(raw.dispatch_cycle.dispatch_date + 'T12:00:00')
        : '',
      customerName: raw.customer?.full_name ?? '—',
      customerPhone: raw.customer?.phone ?? null,
      items: raw.order_items.map((item): OrderItem => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product?.name ?? '—',
        unit: item.product?.unit ?? '',
        quantity: item.quantity,
        unitPrice: item.unit_price_frozen,
        subtotal: item.subtotal_frozen,
        itemStatus: item.status,
        assignments: item.order_item_assignments.map((a): SupplierAssignment => ({
          id: a.id,
          supplierName: a.supplier?.full_name ?? '—',
          supplierScore: Number(a.supplier?.reliability_score ?? 100),
          assignedQty: a.assigned_quantity,
          supplierPrice: a.supplier_price_frozen,
          status: a.status,
          failureReason: a.failure_reason,
        })),
      })),
    }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestión de pedidos</h1>
      <OrdersBoard orders={orders} />
    </div>
  )
}

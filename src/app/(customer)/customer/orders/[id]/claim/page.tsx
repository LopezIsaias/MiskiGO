import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'
import { ClaimForm } from '@/components/customer/claim-form'
import type { ClaimableItem } from '@/components/customer/claim-form'

export const metadata: Metadata = { title: 'Reportar problema' }

type RawItem = {
  product_id:        string
  quantity:          number
  product: { name: string; unit: string } | null
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, delivery_address, claim_window_expires_at, created_at')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .maybeSingle()

  if (!order) notFound()
  if (order.status !== 'delivered') redirect('/customer/orders')

  const windowOpen = order.claim_window_expires_at
    ? new Date() < new Date(order.claim_window_expires_at)
    : false

  const { data: rawItems } = await adminClient
    .from('order_items')
    .select('product_id, quantity, product:products!product_id(name, unit)')
    .eq('order_id', orderId)

  const items = (rawItems ?? []) as unknown as RawItem[]

  const { data: existingClaims } = await adminClient
    .from('claims')
    .select('product_id, status')
    .eq('order_id', orderId)

  const claimedSet = new Set(
    (existingClaims ?? [])
      .filter(c => ['pending', 'approved', 'partially_approved'].includes(c.status))
      .map(c => c.product_id)
  )

  const claimableItems: ClaimableItem[] = items.map(item => ({
    productId:       item.product_id,
    productName:     item.product?.name ?? '—',
    unit:            item.product?.unit ?? '',
    orderedQuantity: item.quantity,
    alreadyClaimed:  claimedSet.has(item.product_id),
  }))

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/customer/orders" className="text-sm text-green-600 hover:underline">
          ← Mis pedidos
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Reportar problema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pedido del {formatDate(order.created_at)} · {order.delivery_address}
        </p>
      </div>

      {!windowOpen ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center space-y-2">
          <p className="text-gray-500 text-sm font-medium">Plazo de reclamo vencido</p>
          <p className="text-xs text-gray-400">
            El período de 2 horas para reportar problemas en este pedido ha finalizado.
          </p>
          <Link href="/customer/orders" className="inline-block mt-2 text-sm text-green-600 underline">
            Volver a mis pedidos
          </Link>
        </div>
      ) : (
        <ClaimForm
          orderId={orderId}
          items={claimableItems}
          claimWindowExpiresAt={order.claim_window_expires_at!}
          customerId={user.id}
        />
      )}
    </div>
  )
}

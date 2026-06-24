import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentActions } from '@/components/operator/payment-actions'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'

interface OrderItem {
  id: string
  quantity: number
  unit_price_frozen: number
  subtotal_frozen: number
  product: { name: string; unit: string } | null
}

interface PaymentVerification {
  id: string
  amount: number
  method: string
  submitted_at: string
  status: string
}

interface OrderDetail {
  id: string
  status: string
  total_amount: number
  subtotal: number
  delivery_fee: number
  payment_method: string | null
  payment_proof_url: string | null
  delivery_address: string
  delivery_notes: string | null
  customer_note: string | null
  created_at: string
  dispatch_cycle: { dispatch_date: string } | null
  customer: { id: string; full_name: string; phone: string | null; email: string } | null
  order_items: OrderItem[]
  payment_verifications: PaymentVerification[]
}

const METHOD_LABEL: Record<string, string> = {
  yape: 'Yape',
  transfer: 'Transferencia',
  wallet: 'Solo billetera',
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orderId } = await params

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

  const { data: rawOrder } = await adminClient
    .from('orders')
    .select(`
      id, status, total_amount, subtotal, delivery_fee,
      payment_method, payment_proof_url,
      delivery_address, delivery_notes, customer_note, created_at,
      dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date),
      customer:users!customer_id(id, full_name, phone, email),
      order_items(
        id, quantity, unit_price_frozen, subtotal_frozen,
        product:products!product_id(name, unit)
      ),
      payment_verifications(id, amount, method, submitted_at, status)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (!rawOrder) notFound()

  const order = rawOrder as unknown as OrderDetail

  const { data: walletTx } = await adminClient
    .from('wallet_transactions')
    .select('amount')
    .eq('reference_order_id', orderId)
    .eq('type', 'payment')
    .eq('status', 'approved')
    .maybeSingle()

  const walletUsed = walletTx?.amount ?? 0
  const pv = order.payment_verifications?.[0]
  const proofAmount = pv?.amount ?? 0

  const dispatchDate = order.dispatch_cycle?.dispatch_date
  const deliveryDate = dispatchDate
    ? formatDate(dispatchDate + 'T12:00:00')
    : ''

  const isPending = order.status === 'payment_submitted'
  const isProofImage = order.payment_proof_url &&
    !order.payment_proof_url.toLowerCase().endsWith('.pdf')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/operator/payments"
          className="text-sm text-miski-muted hover:text-miski-forest flex items-center gap-1"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-miski-forest">
            Pedido <span className="font-mono text-miski-muted">#{order.id.slice(0, 8).toUpperCase()}</span>
          </h1>
          <p className="text-xs text-miski-muted">{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Customer info */}
          <section className="bg-white rounded-xl border border-miski-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5">
              <h2 className="text-sm font-semibold text-miski-forest">Cliente</h2>
            </div>
            <div className="p-4 space-y-1">
              <p className="font-medium text-miski-forest">{order.customer?.full_name ?? '—'}</p>
              {order.customer?.phone && (
                <p className="text-sm text-gray-700">{order.customer.phone}</p>
              )}
              {order.customer?.email && (
                <p className="text-sm text-miski-muted">{order.customer.email}</p>
              )}
            </div>
          </section>

          {/* Order items */}
          <section className="overflow-hidden rounded-xl border border-miski-border bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5">
              <h2 className="text-sm font-semibold text-miski-forest">Productos</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-miski-border bg-miski-forest/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Producto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Cant.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">P. unit.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-miski-border">
                {order.order_items.map(item => (
                  <tr key={item.id} className="hover:bg-miski-cream/30">
                    <td className="px-4 py-3 border-b border-miski-border text-gray-700">
                      {item.product?.name ?? '—'}
                      <span className="text-miski-muted text-xs ml-1">/{item.product?.unit}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right text-gray-700">
                      {formatCurrency(item.unit_price_frozen)}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right font-bold text-miski-forest">
                      {formatCurrency(item.subtotal_frozen)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-miski-border bg-miski-forest/5">
                {order.delivery_fee > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-xs text-miski-muted text-right">Delivery</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700">{formatCurrency(order.delivery_fee)}</td>
                  </tr>
                )}
                {walletUsed > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-xs text-miski-muted text-right">Billetera aplicada</td>
                    <td className="px-4 py-2 text-right text-sm text-miski-green">−{formatCurrency(walletUsed)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold text-miski-forest text-right">Total</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-miski-forest">{formatCurrency(order.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Delivery info */}
          <section className="bg-white rounded-xl border border-miski-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5">
              <h2 className="text-sm font-semibold text-miski-forest">Entrega</h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div>
                <span className="text-xs text-miski-muted block">Dirección</span>
                <span className="text-gray-700">{order.delivery_address}</span>
              </div>
              {deliveryDate && (
                <div>
                  <span className="text-xs text-miski-muted block">Fecha estimada</span>
                  <span className="text-gray-700">{deliveryDate}</span>
                </div>
              )}
              {order.delivery_notes && (
                <div>
                  <span className="text-xs text-miski-muted block">Notas de entrega</span>
                  <span className="text-gray-700">{order.delivery_notes}</span>
                </div>
              )}
              {order.customer_note && (
                <div>
                  <span className="text-xs text-miski-muted block">Nota del cliente</span>
                  <span className="text-gray-700 italic">{order.customer_note}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Payment info + proof */}
          <section className="bg-white rounded-xl border border-miski-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-miski-border bg-miski-forest/5">
              <h2 className="text-sm font-semibold text-miski-forest">Comprobante de pago</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Payment summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-miski-cream/30 rounded-lg p-3">
                  <p className="text-xs text-miski-muted mb-1">Método</p>
                  <p className="font-medium text-miski-forest">
                    {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                  </p>
                </div>
                <div className="bg-miski-cream/30 rounded-lg p-3">
                  <p className="text-xs text-miski-muted mb-1">Monto del comprobante</p>
                  <p className="font-bold text-miski-forest">
                    {pv ? formatCurrency(pv.amount) : walletUsed >= order.total_amount ? 'Solo billetera' : '—'}
                  </p>
                </div>
                {walletUsed > 0 && (
                  <div className="bg-miski-lime/10 rounded-lg p-3">
                    <p className="text-xs text-miski-green mb-1">Billetera aplicada</p>
                    <p className="font-medium text-miski-forest">{formatCurrency(walletUsed)}</p>
                  </div>
                )}
                {pv && (
                  <div className="bg-miski-cream/30 rounded-lg p-3">
                    <p className="text-xs text-miski-muted mb-1">Enviado</p>
                    <p className="font-medium text-miski-forest text-xs">{formatDateTime(pv.submitted_at)}</p>
                  </div>
                )}
              </div>

              {/* Proof image or wallet-only notice */}
              {order.payment_method === 'wallet' || (!order.payment_proof_url && walletUsed >= order.total_amount) ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  Pedido pagado completamente con saldo de billetera. No hay comprobante de pago externo.
                </div>
              ) : order.payment_proof_url ? (
                <div>
                  {isProofImage ? (
                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-miski-border bg-miski-cream/20">
                      <Image
                        src={order.payment_proof_url}
                        alt="Comprobante de pago"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <a
                      href={order.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 border border-miski-border rounded-lg px-4 py-3 text-sm text-miski-forest hover:bg-miski-cream/30 transition-colors"
                    >
                      <span>📄</span>
                      <span>Ver comprobante (PDF)</span>
                    </a>
                  )}
                  <a
                    href={order.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-miski-muted hover:text-miski-forest mt-1 text-center"
                  >
                    Abrir en nueva pestaña
                  </a>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-miski-forest">
                  No se encontró comprobante de pago para este pedido.
                </div>
              )}
            </div>
          </section>

          {/* Actions + WhatsApp */}
          <PaymentActions
            orderId={order.id}
            isPending={isPending}
            customerName={order.customer?.full_name ?? 'Cliente'}
            customerPhone={order.customer?.phone ?? null}
            proofAmount={proofAmount}
            walletUsed={walletUsed}
            deliveryDate={deliveryDate}
          />
        </div>
      </div>
    </div>
  )
}

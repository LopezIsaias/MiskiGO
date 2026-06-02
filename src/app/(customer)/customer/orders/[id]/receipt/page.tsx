import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PrintButton } from '@/components/customer/print-button'

export const metadata: Metadata = { title: 'Comprobante' }

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg', unit: 'und.', liter: 'lt', bunch: 'atado',
}

type ReceiptRow = {
  number: string
  type: string
  document: string
  customer_name: string
  subtotal: number
  total: number
  issued_at: string
}

type ItemRow = {
  quantity: number
  unit_price_frozen: number
  subtotal_frozen: number
  product: { name: string; unit: string } | null
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, customer_id, delivery_address')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.customer_id !== user.id) notFound()

  const { data: rawReceipt } = await adminClient
    .from('receipts')
    .select('number, type, document, customer_name, subtotal, total, issued_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!rawReceipt) notFound()
  const receipt = rawReceipt as unknown as ReceiptRow

  const { data: rawItems } = await adminClient
    .from('order_items')
    .select('quantity, unit_price_frozen, subtotal_frozen, product:products!product_id(name, unit)')
    .eq('order_id', orderId)

  const items = (rawItems ?? []) as unknown as ItemRow[]
  const docLabel = receipt.type === 'factura' ? 'RUC' : 'DNI'

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/customer/orders" className="text-sm text-miski-olive hover:text-miski-forest">
          ← Volver a mis pedidos
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm p-6 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-miski-sage/30 pb-4 mb-4">
          <div>
            <p className="text-lg font-bold text-miski-forest">Miski GO</p>
            <p className="text-xs text-miski-olive">Del campo a tu mesa, sin escalas.</p>
            <p className="text-xs text-gray-400 mt-1">San Martín, Perú</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-miski-forest uppercase">{receipt.type}</p>
            <p className="text-sm font-bold text-miski-forest">{receipt.number}</p>
            <p className="text-xs text-gray-400 mt-1">{formatDateTime(receipt.issued_at)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-4 text-sm">
          <p className="text-gray-700"><span className="text-miski-olive">Cliente:</span> {receipt.customer_name}</p>
          <p className="text-gray-700"><span className="text-miski-olive">{docLabel}:</span> {receipt.document}</p>
          <p className="text-gray-700"><span className="text-miski-olive">Dirección de entrega:</span> {order.delivery_address}</p>
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-miski-sage/30 text-left text-xs text-miski-olive uppercase">
              <th className="py-2 font-medium">Producto</th>
              <th className="py-2 font-medium text-center">Cant.</th>
              <th className="py-2 font-medium text-right">P. unit.</th>
              <th className="py-2 font-medium text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-miski-sage/20">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="py-2 text-gray-700">{item.product?.name ?? '—'}</td>
                <td className="py-2 text-center text-gray-600">
                  {item.quantity} {UNIT_LABEL[item.product?.unit ?? ''] ?? item.product?.unit}
                </td>
                <td className="py-2 text-right text-gray-600">{formatCurrency(item.unit_price_frozen)}</td>
                <td className="py-2 text-right font-medium text-miski-forest">{formatCurrency(item.subtotal_frozen)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-miski-sage/30 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-miski-forest text-base">
            <span>Total</span>
            <span>{formatCurrency(receipt.total)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Comprobante interno. Documento sin valor tributario ante SUNAT en esta etapa.
        </p>
      </div>
    </div>
  )
}

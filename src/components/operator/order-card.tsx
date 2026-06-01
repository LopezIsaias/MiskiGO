'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, timeAgo, toWANumber } from '@/lib/utils'
import { StarRating } from '@/components/ui/star-rating'

export interface SupplierAssignment {
  id: string
  supplierName: string
  supplierScore: number
  assignedQty: number
  supplierPrice: number
  status: string
  failureReason: string | null
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  unit: string
  quantity: number
  unitPrice: number
  subtotal: number
  itemStatus: string
  assignments: SupplierAssignment[]
}

export interface Order {
  id: string
  status: string
  totalAmount: number
  paymentMethod: string | null
  createdAt: string
  deliveryAddress: string
  deliveryDate: string
  customerName: string
  customerPhone: string | null
  items: OrderItem[]
}

interface PubOption {
  id: string
  supplierName: string
  availableQty: number
  minimumPrice: number
}

const METHOD_LABEL: Record<string, string> = { yape: 'Yape', transfer: 'Transferencia', wallet: 'Billetera' }
const ITEM_STATUS_BADGE: Record<string, string> = {
  pending:  'bg-gray-100 text-gray-600',
  assigned: 'bg-green-100 text-green-700',
  failed:   'bg-red-100 text-red-700',
  delivered:'bg-purple-100 text-purple-700',
  rejected: 'bg-orange-100 text-orange-700',
}
const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', assigned: 'Asignado', failed: 'Sin stock',
  delivered: 'Entregado', rejected: 'Rechazado',
}

// ── Manual assignment panel ───────────────────────────────────────────────────

function ManualAssignPanel({ orderId, item }: { orderId: string; item: OrderItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pubs, setPubs] = useState<PubOption[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const confirmedQty = item.assignments
    .filter(a => a.status === 'confirmed')
    .reduce((s, a) => Math.round((s + a.assignedQty) * 1000) / 1000, 0)
  const neededQty = Math.round((item.quantity - confirmedQty) * 1000) / 1000

  async function fetchPubs() {
    setLoading(true)
    setOpen(true)
    setError('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/items/${item.id}/publications`)
      const data = await res.json()
      setPubs(data.publications ?? [])
    } catch {
      setError('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }

  async function doAssign(pubId: string) {
    setAssigningId(pubId)
    setError('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/items/${item.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationId: pubId }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al asignar')
      } else {
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-red-600 font-medium">
        Faltan {neededQty} {item.unit} sin proveedor
      </p>
      <button
        onClick={fetchPubs}
        disabled={loading}
        className="text-xs font-medium text-amber-700 border border-amber-300 rounded px-2 py-1 hover:bg-amber-50 disabled:opacity-50"
      >
        {loading ? 'Buscando…' : 'Buscar proveedor alternativo'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {open && !loading && (
        <div className="mt-1 space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
          {pubs.length === 0 ? (
            <p className="text-xs text-red-600">Sin stock disponible actualmente</p>
          ) : (
            pubs.map(pub => {
              const deduct = Math.min(pub.availableQty, neededQty)
              return (
                <div key={pub.id} className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-medium text-gray-800">{pub.supplierName}</span>
                  <span className="text-gray-500">{pub.availableQty} {item.unit} disp.</span>
                  <span className="text-gray-500">{formatCurrency(pub.minimumPrice)}/{item.unit}</span>
                  <button
                    onClick={() => doAssign(pub.id)}
                    disabled={!!assigningId}
                    className="ml-auto text-green-700 border border-green-300 rounded px-2 py-0.5 hover:bg-green-50 disabled:opacity-50"
                  >
                    {assigningId === pub.id ? 'Asignando…' : `Asignar ${deduct} ${item.unit}`}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────

export function OrderCard({ order }: { order: Order }) {
  const hasFailed = order.items.some(i => i.itemStatus === 'failed')
  const [expanded, setExpanded] = useState(
    order.status === 'payment_submitted' || hasFailed,
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const idShort = order.id.slice(0, 8).toUpperCase()
  const waNumber = toWANumber(order.customerPhone)

  const confirmMsg =
    `✅ ¡Hola ${order.customerName}! Tu pedido Miski GO #${idShort} ` +
    `por ${formatCurrency(order.totalAmount)} está confirmado y en preparación. ` +
    (order.deliveryDate ? `Entrega estimada: ${order.deliveryDate}. ` : '') +
    `¡Gracias por confiar en Miski GO! 🌱`

  const dispatchMsg =
    `🚚 ¡Hola ${order.customerName}! Tu pedido Miski GO #${idShort} ya está en camino. ` +
    `Pronto recibirás tus productos frescos del campo. ¡Que los disfrutes! 🌱`

  const problemMsg =
    `⚠️ Hola ${order.customerName}, tenemos una novedad con tu pedido Miski GO #${idShort}. ` +
    `Uno o más productos no tienen stock disponible en este momento. ` +
    `Te contactamos para coordinar la solución. Disculpa el inconveniente. 🙏`

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* ignore */ }
  }

  const WA_MESSAGES = [
    { key: 'confirm', label: 'Confirmación', msg: confirmMsg, highlight: order.status === 'assigned' },
    { key: 'dispatch', label: 'Despacho',    msg: dispatchMsg, highlight: order.status === 'in_transit' },
    { key: 'problem',  label: 'Problema',    msg: problemMsg,  highlight: hasFailed },
  ]

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${hasFailed ? 'border-amber-300' : 'border-gray-200'}`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{order.customerName}</span>
            {order.customerPhone && (
              <span className="text-xs text-gray-400 font-mono">{order.customerPhone}</span>
            )}
            {hasFailed && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">⚠ Stock</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="font-medium text-gray-800">{formatCurrency(order.totalAmount)}</span>
            {order.paymentMethod && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
              </span>
            )}
            <span className="font-mono text-gray-400">#{idShort}</span>
            <span>{timeAgo(order.createdAt)}</span>
          </div>
        </div>
        <span className="text-gray-400 text-xs select-none">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {/* Items table */}
          <div className="p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left pb-2 font-medium">Producto</th>
                  <th className="text-right pb-2 font-medium">Cant.</th>
                  <th className="text-right pb-2 font-medium">P. unit.</th>
                  <th className="text-left pb-2 font-medium pl-4">Proveedor(es)</th>
                  <th className="text-right pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map(item => (
                  <tr key={item.id} className="align-top">
                    <td className="py-2 pr-2 text-gray-800">
                      {item.productName}
                      <span className="text-gray-400 ml-1">/{item.unit}</span>
                    </td>
                    <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 pl-4 text-gray-700">
                      {item.assignments.filter(a => a.status === 'confirmed').map(a => (
                        <div key={a.id} className="flex items-center gap-1.5">
                          {a.supplierName} · {a.assignedQty} {item.unit}
                          <StarRating score={a.supplierScore} showPercent={false} />
                        </div>
                      ))}
                      {item.itemStatus === 'failed' && (
                        <ManualAssignPanel orderId={order.id} item={item} />
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ITEM_STATUS_BADGE[item.itemStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ITEM_STATUS_LABEL[item.itemStatus] ?? item.itemStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WhatsApp messages */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">Notificar por WhatsApp</p>
              {order.customerPhone && (
                <button
                  onClick={() => copyText(order.customerPhone!, 'phone')}
                  className="text-xs text-gray-500 hover:text-gray-800 font-mono border border-gray-200 rounded px-2 py-0.5"
                >
                  {copiedKey === 'phone' ? '¡Copiado!' : order.customerPhone}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {WA_MESSAGES.map(({ key, label, msg, highlight }) => (
                <div key={key} className={`rounded-lg border p-3 space-y-2 ${highlight ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(msg, key)}
                      className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1"
                    >
                      {copiedKey === key ? '¡Copiado!' : 'Copiar'}
                    </button>
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1"
                      >
                        Abrir WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

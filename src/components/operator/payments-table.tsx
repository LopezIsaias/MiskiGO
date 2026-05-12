'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

export interface PendingOrder {
  id: string
  total_amount: number
  payment_method: string | null
  created_at: string
  customer: { full_name: string; phone: string | null } | null
  payment_verifications: { amount: number; submitted_at: string }[] | null
}

export interface ConfirmedOrder {
  id: string
  status: string
  total_amount: number
  payment_method: string | null
  created_at: string
  customer: { full_name: string; phone: string | null } | null
}

interface Props {
  pending: PendingOrder[]
  confirmed: ConfirmedOrder[]
}

const METHOD_LABEL: Record<string, string> = {
  yape: 'Yape', transfer: 'Transferencia', wallet: 'Billetera',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado', assigned: 'Asignado',
  in_transit: 'En camino', delivered: 'Entregado',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-purple-100 text-purple-700',
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'hace un momento'
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)} h`
  return `hace ${Math.floor(secs / 86400)} días`
}

export function PaymentsTable({ pending, confirmed }: Props) {
  return (
    <div className="space-y-8">
      {/* Pending validation */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Pendientes de validación</h2>
          {pending.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center bg-white rounded-xl border border-gray-200">
            Sin comprobantes pendientes
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Monto pedido</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Comprobante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Enviado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map(order => {
                  const pv = order.payment_verifications?.[0]
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{order.customer?.full_name ?? '—'}</p>
                        {order.customer?.phone && (
                          <p className="text-xs text-gray-400">{order.customer.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {pv ? formatCurrency(pv.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {pv ? timeAgo(pv.submitted_at) : timeAgo(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/operator/payments/${order.id}`}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirmed orders of current cycle */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pedidos confirmados — ciclo actual</h2>

        {confirmed.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center bg-white rounded-xl border border-gray-200">
            Sin pedidos confirmados en el ciclo actual
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {confirmed.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{order.customer?.full_name ?? '—'}</p>
                      {order.customer?.phone && (
                        <p className="text-xs text-gray-400">{order.customer.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/operator/payments/${order.id}`}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

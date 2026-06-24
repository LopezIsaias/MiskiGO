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
  confirmed: 'bg-miski-lime/20 text-miski-forest',
  assigned: 'bg-miski-green/15 text-miski-forest',
  in_transit: 'bg-miski-green/15 text-miski-forest',
  delivered: 'bg-miski-forest/10 text-miski-forest',
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
          <h2 className="text-sm font-semibold text-miski-forest">Pendientes de validación</h2>
          {pending.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-miski-muted py-6 text-center bg-white rounded-xl border border-miski-border shadow-sm">
            Sin comprobantes pendientes
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-miski-border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-miski-border bg-miski-forest/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Monto pedido</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Comprobante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Enviado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-miski-border">
                {pending.map(order => {
                  const pv = order.payment_verifications?.[0]
                  return (
                    <tr key={order.id} className="hover:bg-miski-cream/30 transition-colors">
                      <td className="px-4 py-3 border-b border-miski-border">
                        <p className="font-medium text-gray-700">{order.customer?.full_name ?? '—'}</p>
                        {order.customer?.phone && (
                          <p className="text-xs text-miski-muted">{order.customer.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-miski-forest border-b border-miski-border">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm border-b border-miski-border">
                        {pv ? formatCurrency(pv.amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm border-b border-miski-border">
                        {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm border-b border-miski-border">
                        {pv ? timeAgo(pv.submitted_at) : timeAgo(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-miski-border">
                        <Link
                          href={`/operator/payments/${order.id}`}
                          className="bg-miski-forest text-white hover:bg-miski-green text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
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
        <h2 className="text-sm font-semibold text-miski-forest mb-3">Pedidos confirmados — ciclo actual</h2>

        {confirmed.length === 0 ? (
          <p className="text-sm text-miski-muted py-6 text-center bg-white rounded-xl border border-miski-border shadow-sm">
            Sin pedidos confirmados en el ciclo actual
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-miski-border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-miski-border bg-miski-forest/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-miski-forest/60">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-miski-border">
                {confirmed.map(order => (
                  <tr key={order.id} className="hover:bg-miski-cream/30 transition-colors">
                    <td className="px-4 py-3 border-b border-miski-border">
                      <p className="font-medium text-gray-700">{order.customer?.full_name ?? '—'}</p>
                      {order.customer?.phone && (
                        <p className="text-xs text-miski-muted">{order.customer.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-miski-forest border-b border-miski-border">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm border-b border-miski-border">
                      {METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-miski-gold-light/40 text-miski-forest'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right border-b border-miski-border">
                      <Link
                        href={`/operator/payments/${order.id}`}
                        className="text-xs text-miski-green hover:text-miski-forest font-semibold"
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

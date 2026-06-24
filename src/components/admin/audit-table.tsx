'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { describeAuditAction } from '@/lib/utils/audit-descriptions'

export interface AuditRow {
  id:             string
  timestamp:      string
  role_at_time:   string
  action:         string
  module:         string
  entity_type:    string | null
  entity_id:      string | null
  previous_value: Record<string, unknown> | null
  new_value:      Record<string, unknown> | null
  notes:          string | null
  ip_address:     string | null
  actor:          { id: string; full_name: string } | null
}

const MODULE_COLOR: Record<string, string> = {
  payments:   'bg-blue-100 text-blue-700',
  wallet:     'bg-miski-lime/20 text-miski-forest',
  orders:     'bg-orange-100 text-orange-700',
  users:      'bg-purple-100 text-purple-700',
  products:   'bg-miski-gold-light/40 text-miski-forest',
  deliveries: 'bg-indigo-100 text-indigo-700',
  claims:     'bg-red-100 text-red-700',
  system:     'bg-miski-green-soft text-miski-forest/70',
}

interface Props {
  rows: AuditRow[]
}

export function AuditTable({ rows }: Props) {
  const [selected, setSelected] = useState<AuditRow | null>(null)

  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-miski-muted bg-white rounded-xl border border-miski-border p-8 text-center">
          No hay registros con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-miski-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-miski-border bg-miski-forest/5 text-xs text-miski-forest/60 font-semibold uppercase tracking-wider">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Fecha y hora</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Usuario</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Descripción</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Acción</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Módulo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-miski-border">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-miski-cream/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-miski-muted whitespace-nowrap border-b border-miski-border">
                      {formatDateTime(row.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-miski-tinta whitespace-nowrap border-b border-miski-border">
                      {row.actor?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-miski-tinta max-w-xs border-b border-miski-border">
                      {describeAuditAction(row)}
                    </td>
                    <td className="px-4 py-3 text-xs text-miski-muted/70 font-mono whitespace-nowrap border-b border-miski-border">
                      {row.action}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap border-b border-miski-border">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODULE_COLOR[row.module] ?? 'bg-miski-green-soft text-miski-forest/70'}`}>
                        {row.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right border-b border-miski-border">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="text-xs text-miski-green hover:underline font-medium whitespace-nowrap"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-miski-border flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-miski-forest font-mono">{selected.action}</p>
                <p className="text-xs text-miski-muted mt-0.5">{formatDateTime(selected.timestamp)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 text-miski-muted hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {/* Meta */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-miski-muted">Usuario</dt>
                  <dd className="font-medium text-miski-tinta">{selected.actor?.full_name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-miski-muted">Rol</dt>
                  <dd className="font-medium text-miski-tinta">{selected.role_at_time}</dd>
                </div>
                <div>
                  <dt className="text-miski-muted">Módulo</dt>
                  <dd className="font-medium text-miski-tinta">{selected.module}</dd>
                </div>
                {selected.entity_type && (
                  <div>
                    <dt className="text-miski-muted">Entidad</dt>
                    <dd className="font-medium text-miski-tinta">
                      {selected.entity_type}
                      {selected.entity_id && (
                        <span className="ml-1 text-miski-muted font-mono">{selected.entity_id.slice(0, 8)}…</span>
                      )}
                    </dd>
                  </div>
                )}
                {selected.ip_address && (
                  <div>
                    <dt className="text-miski-muted">IP</dt>
                    <dd className="font-mono text-miski-tinta">{selected.ip_address}</dd>
                  </div>
                )}
                {selected.notes && (
                  <div className="col-span-2">
                    <dt className="text-miski-muted">Notas</dt>
                    <dd className="text-gray-700">{selected.notes}</dd>
                  </div>
                )}
              </dl>

              {/* Previous value */}
              {selected.previous_value !== null && (
                <div>
                  <p className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider mb-1.5">
                    Valor anterior
                  </p>
                  <pre className="bg-miski-green-soft border border-miski-border rounded-lg p-3 text-xs overflow-x-auto text-gray-700 leading-relaxed">
                    {JSON.stringify(selected.previous_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* New value */}
              {selected.new_value !== null && (
                <div>
                  <p className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider mb-1.5">
                    Valor nuevo
                  </p>
                  <pre className="bg-miski-lime/10 border border-miski-lime/30 rounded-lg p-3 text-xs overflow-x-auto text-gray-700 leading-relaxed">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selected.previous_value === null && selected.new_value === null && (
                <p className="text-xs text-miski-muted italic">Sin valores de cambio registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

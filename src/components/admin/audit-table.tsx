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
  wallet:     'bg-green-100 text-green-700',
  orders:     'bg-orange-100 text-orange-700',
  users:      'bg-purple-100 text-purple-700',
  products:   'bg-yellow-100 text-yellow-700',
  deliveries: 'bg-indigo-100 text-indigo-700',
  claims:     'bg-red-100 text-red-700',
  system:     'bg-gray-100 text-gray-700',
}

interface Props {
  rows: AuditRow[]
}

export function AuditTable({ rows }: Props) {
  const [selected, setSelected] = useState<AuditRow | null>(null)

  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-200 p-8 text-center">
          No hay registros con los filtros seleccionados.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Fecha y hora</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Usuario</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Descripción</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Acción</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Módulo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(row.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                      {row.actor?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                      {describeAuditAction(row)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                      {row.action}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODULE_COLOR[row.module] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="text-xs text-green-600 hover:underline font-medium whitespace-nowrap"
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
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 font-mono">{selected.action}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(selected.timestamp)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {/* Meta */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-gray-400">Usuario</dt>
                  <dd className="font-medium text-gray-800">{selected.actor?.full_name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Rol</dt>
                  <dd className="font-medium text-gray-800">{selected.role_at_time}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Módulo</dt>
                  <dd className="font-medium text-gray-800">{selected.module}</dd>
                </div>
                {selected.entity_type && (
                  <div>
                    <dt className="text-gray-400">Entidad</dt>
                    <dd className="font-medium text-gray-800">
                      {selected.entity_type}
                      {selected.entity_id && (
                        <span className="ml-1 text-gray-400 font-mono">{selected.entity_id.slice(0, 8)}…</span>
                      )}
                    </dd>
                  </div>
                )}
                {selected.ip_address && (
                  <div>
                    <dt className="text-gray-400">IP</dt>
                    <dd className="font-mono text-gray-800">{selected.ip_address}</dd>
                  </div>
                )}
                {selected.notes && (
                  <div className="col-span-2">
                    <dt className="text-gray-400">Notas</dt>
                    <dd className="text-gray-700">{selected.notes}</dd>
                  </div>
                )}
              </dl>

              {/* Previous value */}
              {selected.previous_value !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Valor anterior
                  </p>
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700 leading-relaxed">
                    {JSON.stringify(selected.previous_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* New value */}
              {selected.new_value !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Valor nuevo
                  </p>
                  <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-700 leading-relaxed">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selected.previous_value === null && selected.new_value === null && (
                <p className="text-xs text-gray-400 italic">Sin valores de cambio registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

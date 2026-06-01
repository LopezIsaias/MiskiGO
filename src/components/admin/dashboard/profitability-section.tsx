'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface ProfitabilityCycle {
  label:        string
  grossMargin:  number
  opCost:       number
  netProfit:    number
}

interface Props {
  grossMargin: number
  opCost:      number
  netProfit:   number
  cycles:      ProfitabilityCycle[]
}

function Card({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'amber' }) {
  const cls = accent === 'green' ? 'text-green-700' : accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' : 'text-gray-900'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function ProfitabilitySection({ grossMargin, opCost, netProfit, cycles }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rentabilidad</h2>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Margen bruto"           value={formatCurrency(grossMargin)} accent="green" />
        <Card label="Costos operativos (est.)" value={formatCurrency(opCost)}   accent="amber" />
        <Card label="Ganancia neta estimada"  value={formatCurrency(netProfit)}  accent={netProfit >= 0 ? 'green' : 'red'} />
      </div>

      {/* Bar chart by cycle */}
      {cycles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Por ciclo de despacho</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cycles} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `S/${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="grossMargin" name="Margen bruto" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opCost" name="Costos op." fill="#f59e0b" radius={[4, 4, 0, 0]}>
                {cycles.map((_, i) => <Cell key={i} fill="#f59e0b" />)}
              </Bar>
              <Bar dataKey="netProfit" name="Ganancia neta" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {cycles.map((c, i) => <Cell key={i} fill={c.netProfit >= 0 ? '#3b82f6' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            {[['#22c55e', 'Margen bruto'], ['#f59e0b', 'Costos op.'], ['#3b82f6', 'Ganancia neta']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

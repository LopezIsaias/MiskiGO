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
  const cls =
    accent === 'green' ? 'text-miski-forest font-bold' :
    accent === 'red'   ? 'text-red-600 font-bold'      :
    accent === 'amber' ? 'text-miski-gold font-bold'   :
    'text-miski-forest font-bold'
  return (
    <div className="bg-white rounded-xl border border-miski-border shadow-sm p-5">
      <p className="text-miski-muted text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl mt-1 ${cls}`}>{value}</p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-miski-border rounded-xl shadow-lg px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-miski-forest mb-1">{label}</p>
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
      <h2 className="text-lg font-semibold text-miski-forest">Rentabilidad</h2>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Margen bruto"           value={formatCurrency(grossMargin)} accent="green" />
        <Card label="Costos operativos (est.)" value={formatCurrency(opCost)}   accent="amber" />
        <Card label="Ganancia neta estimada"  value={formatCurrency(netProfit)}  accent={netProfit >= 0 ? 'green' : 'red'} />
      </div>

      {/* Bar chart by cycle */}
      {cycles.length > 0 && (
        <div className="bg-white rounded-xl border border-miski-border shadow-sm p-5">
          <p className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider mb-4">Por ciclo de despacho</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cycles} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `S/${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="grossMargin" name="Margen bruto" fill="#BED348" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opCost" name="Costos op." fill="#C9B151" radius={[4, 4, 0, 0]}>
                {cycles.map((_, i) => <Cell key={i} fill="#C9B151" />)}
              </Bar>
              <Bar dataKey="netProfit" name="Ganancia neta" fill="#469C53" radius={[4, 4, 0, 0]}>
                {cycles.map((c, i) => <Cell key={i} fill={c.netProfit >= 0 ? '#469C53' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            {[['#BED348', 'Margen bruto'], ['#C9B151', 'Costos op.'], ['#469C53', 'Ganancia neta']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-miski-muted">
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

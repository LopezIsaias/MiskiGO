'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export interface SalePoint {
  date:      string
  current:   number
  previous?: number
}

interface Props {
  data:              SalePoint[]
  isWeekComparison?: boolean
}

const tickFmt = (v: number) => `S/${v.toFixed(0)}`

function fmtDate(d: string): string {
  // "2026-05-15" → "15/5"
  const parts = d.split('-')
  return `${parseInt(parts[2] ?? '0')}/${parseInt(parts[1] ?? '0')}`
}

export function SalesChart({ data, isWeekComparison }: Props) {
  const formatted = data.map(d => ({
    ...d,
    label: isWeekComparison ? d.date : fmtDate(d.date),
  }))

  const interval = data.length > 14 ? Math.floor(data.length / 7) : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Ventas diarias (S/)
        {isWeekComparison && (
          <span className="ml-2 text-xs font-normal text-gray-400">— semana actual vs anterior</span>
        )}
      </h3>

      {data.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-12">Sin ventas en el período</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={interval}
            />
            <YAxis tickFormatter={tickFmt} tick={{ fontSize: 11 }} width={60} />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [tickFmt(Number(v)), String(name)]}
              labelStyle={{ fontSize: 12 }}
            />
            {isWeekComparison && <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />}

            <Line
              type="monotone"
              dataKey="current"
              name="Esta semana"
              stroke="#16a34a"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />

            {isWeekComparison && (
              <Line
                type="monotone"
                dataKey="previous"
                name="Sem. anterior"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

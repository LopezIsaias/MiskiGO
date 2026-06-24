'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface TopSupplier {
  name:     string
  totalQty: number
}

interface Props { data: TopSupplier[] }

function truncate(s: string, n = 15): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function TopSuppliersChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-miski-border shadow-sm p-5">
      <h3 className="text-lg font-semibold text-miski-forest mb-4">Top 5 proveedores por volumen</h3>

      {data.length === 0 ? (
        <p className="text-xs text-miski-muted text-center py-12">Sin datos en el período</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data.map(s => ({
              name:     truncate(s.name),
              cantidad: parseFloat(s.totalQty.toFixed(2)),
            }))}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => [Number(v), 'Cantidad despachada']} />
            <Bar dataKey="cantidad" fill="#469C53" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

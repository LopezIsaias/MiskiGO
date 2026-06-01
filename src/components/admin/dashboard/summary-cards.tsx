import { formatCurrency } from '@/lib/utils'

interface CardProps {
  label: string
  value: string
  accent?: 'green' | 'red' | 'yellow'
}

function Card({ label, value, accent }: CardProps) {
  const valueClass =
    accent === 'green'  ? 'text-green-700' :
    accent === 'red'    ? 'text-red-600'   :
    accent === 'yellow' ? 'text-yellow-600' :
    'text-gray-900'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

interface Props {
  totalRevenue:   number
  orderCount:     number
  avgTicket:      number
  platformMargin: number
  failedOrders:   number
  claimsCount:    number
}

export function SummaryCards({
  totalRevenue, orderCount, avgTicket, platformMargin, failedOrders, claimsCount,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <Card label="Total vendido"      value={formatCurrency(totalRevenue)} />
      <Card label="Pedidos"            value={String(orderCount)} />
      <Card label="Ticket promedio"    value={orderCount > 0 ? formatCurrency(avgTicket) : '—'} />
      <Card label="Margen capturado"   value={formatCurrency(platformMargin)} accent="green" />
      <Card
        label="Pedidos fallidos"
        value={String(failedOrders)}
        accent={failedOrders > 0 ? 'red' : undefined}
      />
      <Card
        label="Reclamos recibidos"
        value={String(claimsCount)}
        accent={claimsCount > 0 ? 'yellow' : undefined}
      />
    </div>
  )
}

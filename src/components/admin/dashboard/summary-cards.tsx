import { formatCurrency } from '@/lib/utils'

interface CardProps {
  label: string
  value: string
  accent?: 'green' | 'red' | 'yellow'
}

function Card({ label, value, accent }: CardProps) {
  const valueClass =
    accent === 'green'  ? 'text-miski-forest font-bold' :
    accent === 'red'    ? 'text-red-600 font-bold'      :
    accent === 'yellow' ? 'text-miski-gold font-bold'   :
    'text-miski-forest font-bold'

  return (
    <div className="bg-white rounded-xl border border-miski-border shadow-sm p-5">
      <p className="text-miski-muted text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl mt-1 ${valueClass}`}>{value}</p>
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

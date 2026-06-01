interface BarProps {
  label:       string
  value:       number
  description: string
  goodWhen:    'high' | 'low'
}

function Bar({ label, value, description, goodWhen }: BarProps) {
  const isGood = goodWhen === 'high' ? value >= 90 : value < 5
  const isMid  = goodWhen === 'high' ? value >= 70 : value < 15

  const barColor = isGood ? 'bg-miski-lime' : isMid ? 'bg-miski-gold' : 'bg-red-400'
  const numColor = isGood ? 'text-miski-forest' : isMid ? 'text-miski-gold' : 'text-red-600'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <span className={`text-sm font-bold ${numColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-miski-sage/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-miski-olive mt-1">{description}</p>
    </div>
  )
}

interface Props {
  claimRate:                number
  supplierFulfillmentRate:  number
  onTimeDeliveryRate:       number
}

export function QualityIndicators({ claimRate, supplierFulfillmentRate, onTimeDeliveryRate }: Props) {
  return (
    <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-miski-forest mb-5">Indicadores de calidad</h3>
      <div className="space-y-5">
        <Bar
          label="Tasa de reclamos"
          value={claimRate}
          description="Reclamos sobre pedidos entregados"
          goodWhen="low"
        />
        <Bar
          label="Cumplimiento de proveedores"
          value={supplierFulfillmentRate}
          description="Asignaciones confirmadas o despachadas"
          goodWhen="high"
        />
        <Bar
          label="Entregas a tiempo"
          value={onTimeDeliveryRate}
          description="Entregados en la fecha del ciclo de despacho"
          goodWhen="high"
        />
      </div>
    </div>
  )
}

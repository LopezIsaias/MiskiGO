interface BarProps {
  label:       string
  value:       number
  description: string
  goodWhen:    'high' | 'low'
}

function Bar({ label, value, description, goodWhen }: BarProps) {
  const isGood = goodWhen === 'high' ? value >= 90 : value < 5
  const isMid  = goodWhen === 'high' ? value >= 70 : value < 15

  const barColor = isGood ? 'bg-green-500' : isMid ? 'bg-yellow-400' : 'bg-red-400'
  const numColor = isGood ? 'text-green-700' : isMid ? 'text-yellow-700' : 'text-red-600'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <span className={`text-sm font-bold ${numColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">{description}</p>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-5">Indicadores de calidad</h3>
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

interface Props {
  status: string
}

// Camino feliz del pedido (CLAUDE.md §4). in_storage/cancelled/failed se tratan aparte.
const STEPS: { key: string; label: string }[] = [
  { key: 'pending_payment',   label: 'Pago pendiente' },
  { key: 'payment_submitted', label: 'Pago enviado' },
  { key: 'confirmed',         label: 'Confirmado' },
  { key: 'assigned',          label: 'Asignado' },
  { key: 'in_transit',        label: 'En camino' },
  { key: 'delivered',         label: 'Entregado' },
  { key: 'completed',         label: 'Completado' },
]

const STEP_INDEX: Record<string, number> = Object.fromEntries(
  STEPS.map((s, i) => [s.key, i])
)

export function OrderStatusBar({ status }: Props) {
  // Estados terminales fuera del camino feliz
  if (status === 'cancelled' || status === 'failed') {
    const label = status === 'cancelled' ? 'Pedido cancelado' : 'Pedido fallido'
    return (
      <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
        <p className="text-xs font-semibold text-red-700">{label}</p>
      </div>
    )
  }

  if (status === 'in_storage') {
    return (
      <div className="mt-4 rounded-xl bg-miski-gold-light/25 border border-miski-gold/40 px-4 py-2.5">
        <p className="text-xs font-semibold text-miski-forest">En almacén — esperando coordinación de entrega</p>
      </div>
    )
  }

  const current = STEP_INDEX[status] ?? 0

  return (
    <div className="mt-4">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done    = i < current
          const active  = i === current
          const isLast  = i === STEPS.length - 1
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Nodo */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-colors ${
                    done
                      ? 'bg-miski-green border-miski-green'
                      : active
                        ? 'bg-white border-miski-green ring-2 ring-miski-lime/40'
                        : 'bg-white border-miski-border'
                  }`}
                />
                <span
                  className={`mt-1 text-[9px] leading-tight text-center w-14 ${
                    active ? 'text-miski-forest font-semibold' : done ? 'text-miski-green' : 'text-miski-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {/* Conector */}
              {!isLast && (
                <div className={`h-0.5 flex-1 -mt-4 ${i < current ? 'bg-miski-green' : 'bg-miski-border'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

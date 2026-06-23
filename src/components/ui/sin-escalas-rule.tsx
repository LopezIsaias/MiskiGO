import { cn } from './cn'

// Signature de Miski GO: la línea continua "sin escalas" (campo ● ── ● mesa).
// Sirve como divisor de secciones. Etiquetas opcionales en los extremos.
interface SinEscalasRuleProps {
  from?: string
  to?: string
  className?: string
}

export function SinEscalasRule({ from, to, className }: SinEscalasRuleProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {from && <span className="text-xs font-medium text-miski-muted shrink-0">{from}</span>}
      <span className="rule-sin-escalas flex-1"><span /></span>
      {to && <span className="text-xs font-medium text-miski-muted shrink-0">{to}</span>}
    </div>
  )
}

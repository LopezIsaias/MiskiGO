import { cn } from './cn'

type Unit = 'kg' | 'unit' | 'liter' | 'bunch'

interface PriceTagProps {
  amount: number
  unit?: Unit
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const unitLabel: Record<Unit, string> = {
  kg: '/kg', unit: 'c/u', liter: '/L', bunch: '/atado',
}

const sizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
}

// Precio en mono tabular y color maíz (valor / precio justo). Las cifras cuadran
// en columnas porque usamos tabular-nums (ver .tabular en globals.css).
export function PriceTag({ amount, unit, size = 'md', className }: PriceTagProps) {
  return (
    <span className={cn('tabular font-semibold text-miski-gold', sizes[size], className)}>
      <span className="text-miski-muted">S/</span>{' '}
      {amount.toFixed(2)}
      {unit && <span className="text-miski-muted text-[0.7em] ml-1">{unitLabel[unit]}</span>}
    </span>
  )
}

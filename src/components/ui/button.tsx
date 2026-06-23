import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-display font-semibold rounded-xl ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miski-green ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-miski-hueso disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:   'bg-miski-green text-white hover:bg-miski-forest',
  secondary: 'bg-miski-green-soft text-miski-forest hover:bg-miski-sage',
  ghost:     'bg-transparent text-miski-forest hover:bg-miski-green-soft',
  danger:    'bg-red-600 text-white hover:bg-red-700',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    />
  )
}

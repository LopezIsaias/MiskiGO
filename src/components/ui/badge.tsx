import type { HTMLAttributes } from 'react'
import { cn } from './cn'

// fresh = lo nuevo/fresco (lima) · value = precio justo (maíz) · neutral · status.
type Tone = 'fresh' | 'value' | 'neutral' | 'success' | 'warning' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const tones: Record<Tone, string> = {
  fresh:   'bg-miski-lime-pale text-miski-forest',
  value:   'bg-miski-gold-light text-miski-forest',
  neutral: 'bg-miski-green-soft text-miski-forest',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger:  'bg-red-100 text-red-700',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

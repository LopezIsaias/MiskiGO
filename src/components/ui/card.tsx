import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section'
}

export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'bg-white rounded-2xl border border-miski-border shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

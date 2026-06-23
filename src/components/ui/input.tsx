import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
}

const fieldBase =
  'w-full h-11 px-3 rounded-xl bg-white border text-miski-tinta placeholder:text-miski-muted/60 ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green'

// forwardRef: react-hook-form pasa una ref vía {...register(name)}.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, name, ...props },
  ref,
) {
  const inputId = id ?? name
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-miski-forest">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={!!error || undefined}
        className={cn(fieldBase, error ? 'border-red-400' : 'border-miski-border', className)}
        {...props}
      />
      {error
        ? <p className="text-xs text-red-600">{error}</p>
        : hint && <p className="text-xs text-miski-muted">{hint}</p>}
    </div>
  )
})

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/admin'

interface ResetPasswordFormProps {
  userId: string
}

const inputCls =
  'w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

export function ResetPasswordForm({ userId }: ResetPasswordFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null)
    setSuccess(false)

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', password: data.password }),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al resetear contraseña')
      return
    }

    setSuccess(true)
    reset()
  }

  return (
    <div className="border-t border-miski-border pt-6">
      <h3 className="text-lg font-semibold text-miski-forest mb-1">Resetear contraseña</h3>
      <p className="text-sm text-miski-muted mb-4">
        El usuario deberá cambiar la contraseña en su próximo inicio de sesión.
      </p>

      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{serverError}</div>
      )}
      {success && (
        <div className="bg-miski-lime/20 text-miski-forest text-sm px-4 py-3 rounded-lg mb-4">
          Contraseña reseteada correctamente.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <div>
          <label className={labelCls}>Nueva contraseña</label>
          <input type="password" {...register('password')} className={inputCls} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Confirmar contraseña</label>
          <input type="password" {...register('confirm_password')} className={inputCls} />
          {errors.confirm_password && (
            <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Reseteando...' : 'Resetear contraseña'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/admin'

const inputCls =
  'w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white text-miski-tinta focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors'

export function ChangePasswordForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null)

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: data.password }),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al cambiar contraseña')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-miski-forest mb-1">Nueva contraseña</label>
        <input type="password" {...register('password')} className={inputCls} autoFocus />
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-miski-forest mb-1">Confirmar contraseña</label>
        <input type="password" {...register('confirm_password')} className={inputCls} />
        {errors.confirm_password && (
          <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-miski-green text-white py-2.5 rounded-xl font-display text-sm font-semibold hover:bg-miski-forest disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}

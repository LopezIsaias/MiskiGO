'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/admin'

interface ResetPasswordFormProps {
  userId: string
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

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
    <div className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-medium text-gray-900 mb-1">Resetear contraseña</h3>
      <p className="text-xs text-gray-500 mb-4">
        El usuario deberá cambiar la contraseña en su próximo inicio de sesión.
      </p>

      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{serverError}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">
          Contraseña reseteada correctamente.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input type="password" {...register('password')} className={inputCls} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input type="password" {...register('confirm_password')} className={inputCls} />
          {errors.confirm_password && (
            <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Reseteando...' : 'Resetear contraseña'}
        </button>
      </form>
    </div>
  )
}

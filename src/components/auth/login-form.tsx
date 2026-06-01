'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { ROLE_DASHBOARD } from '@/lib/constants'

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setServerError(null)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error || !authData.user) {
      setServerError('Email o contraseña incorrectos')
      return
    }

    // Primero intenta el rol desde public.users (fuente de verdad).
    // Si falla (perfil aún no creado, RLS, etc.) usa user_metadata como fallback.
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()

    const role = profile?.role ?? (authData.user.user_metadata?.role as string | undefined)

    window.location.assign(ROLE_DASHBOARD[role ?? ''] ?? '/login')
  }

  const inputCls =
    'w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800'

  const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}
      <div>
        <label className={labelCls}>Email</label>
        <input type="email" {...register('email')} placeholder="tu@email.com" className={inputCls} />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label className={labelCls}>Contraseña</label>
        <input type="password" {...register('password')} placeholder="••••••••" className={inputCls} />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-miski-forest text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-miski-green active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 mt-2"
      >
        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>
    </form>
  )
}

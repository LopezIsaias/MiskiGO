'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { ROLE_DASHBOARD } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
          {serverError}
        </div>
      )}
      <Input
        label="Correo"
        type="email"
        placeholder="tu@correo.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Contraseña"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" fullWidth size="lg" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </Button>
    </form>
  )
}

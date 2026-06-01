'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { ROLE_DASHBOARD } from '@/lib/constants'

interface RegionOption {
  id: string
  name: string
  city: string
}

interface Props {
  regions: RegionOption[]
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function RegisterForm({ regions }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const role = useWatch({ control, name: 'role' })

  function selectRole(r: 'supplier' | 'customer') {
    setValue('role', r, { shouldValidate: true })
  }

  async function onSubmit(data: RegisterInput) {
    setServerError(null)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirm_password: _cp, ...apiData } = data

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiData),
    })

    if (!res.ok) {
      const body = (await res.json()) as { error?: string }
      setServerError(
        body.error === 'DNI ya registrado'
          ? 'Este DNI ya está registrado. Si es tu cuenta, inicia sesión.'
          : (body.error ?? 'Error al crear cuenta'),
      )
      return
    }

    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    router.push(ROLE_DASHBOARD[data.role] ?? '/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Soy...</p>
        <div className="grid grid-cols-2 gap-3">
          {(['customer', 'supplier'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => selectRole(r)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                role === r
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {r === 'customer' ? 'Cliente' : 'Proveedor'}
            </button>
          ))}
        </div>
        {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
      </div>

      {role && (
        <>
          <Field label="Nombre completo" error={errors.full_name?.message}>
            <input
              {...register('full_name')}
              placeholder="Juan Pérez"
              className={inputCls}
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[0-9]/g, '') }}
            />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register('email')} placeholder="tu@email.com" className={inputCls} />
          </Field>

          <Field label="Teléfono" error={errors.phone?.message}>
            <input
              {...register('phone')}
              placeholder="987654321"
              className={inputCls}
              inputMode="numeric"
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI" error={errors.dni?.message}>
              <input {...register('dni')} placeholder="12345678" maxLength={8} className={inputCls} />
            </Field>
            {role === 'supplier' && (
              <Field label="RUC (opcional)" error={errors.ruc?.message}>
                <input
                  {...register('ruc')}
                  placeholder="20123456789"
                  maxLength={11}
                  className={inputCls}
                  inputMode="numeric"
                  onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
                />
              </Field>
            )}
          </div>

          <Field label="Región" error={errors.region_id?.message}>
            <select {...register('region_id')} className={inputCls}>
              <option value="">Selecciona tu región</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.city}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Contraseña" error={errors.password?.message}>
            <input
              type="password"
              {...register('password')}
              placeholder="Mínimo 8 caracteres"
              className={inputCls}
            />
          </Field>

          <Field label="Confirmar contraseña" error={errors.confirm_password?.message}>
            <input
              type="password"
              {...register('confirm_password')}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </>
      )}
    </form>
  )
}

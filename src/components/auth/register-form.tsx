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
  'w-full border border-miski-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
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
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      <div>
        <p className={labelCls}>Soy...</p>
        <div className="grid grid-cols-2 gap-3">
          {(['customer', 'supplier'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => selectRole(r)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                role === r
                  ? 'border-miski-green bg-miski-green-soft text-miski-forest'
                  : 'border-miski-border text-miski-muted hover:border-miski-green/60'
              }`}
            >
              {r === 'customer' ? 'Cliente' : 'Proveedor'}
            </button>
          ))}
        </div>
        {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role.message}</p>}
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
            className="w-full bg-miski-green text-white py-2.5 rounded-xl font-display font-semibold text-sm hover:bg-miski-forest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </>
      )}
    </form>
  )
}

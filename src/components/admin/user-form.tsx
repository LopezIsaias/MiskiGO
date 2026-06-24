'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/lib/validations/admin'
import type { Database } from '@/types/database.types'

type User = Database['public']['Tables']['users']['Row']

interface UserFormProps {
  user?: User
}

const ROLE_LABELS: Record<string, string> = {
  operator: 'Operador',
  delivery: 'Repartidor',
}

const inputCls =
  'w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta'
const readonlyCls =
  'w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm bg-miski-green-soft text-gray-500'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

// ——— Create form ———

interface ConflictUser {
  id: string
  full_name: string
  email: string
  phone: string | null
}

function CreateUserForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflictUser, setConflictUser] = useState<ConflictUser | null>(null)
  const [dniChecking, setDniChecking] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  })

  const selectedRole = useWatch({ control, name: 'role' })
  const isConflict = !!conflictUser

  async function checkDni(dni: string) {
    // Clear any previous conflict and error on each check
    setConflictUser(null)
    setServerError(null)

    if (!/^\d{8}$/.test(dni)) return

    setDniChecking(true)
    try {
      const res = await fetch(`/api/admin/check-dni?dni=${encodeURIComponent(dni)}`)
      if (!res.ok) return
      const data = await res.json()

      if (data.exists && data.role === 'customer') {
        setConflictUser({ id: data.id, full_name: data.full_name, email: data.email, phone: data.phone })
        setValue('full_name', data.full_name, { shouldDirty: true })
        setValue('email', data.email, { shouldDirty: true })
        setValue('phone', data.phone ?? '', { shouldDirty: true })
      }
      // If exists as non-customer: handled at submit time with a clear error
    } finally {
      setDniChecking(false)
    }
  }

  // Normal creation submit (no conflict)
  async function onSubmit(data: CreateUserInput) {
    setServerError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }
    router.push('/admin/users')
    router.refresh()
  }

  // Conversion submit (conflict mode) — uses current form values
  async function handleConvertSubmit(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!conflictUser) return

    const fieldsOk = await trigger(['full_name', 'email', 'phone', 'role'])
    if (!fieldsOk) return

    setIsConverting(true)
    setServerError(null)
    const { full_name, email, phone, role } = getValues()

    const res = await fetch(`/api/admin/users/${conflictUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert_role', role, full_name, email, phone }),
    })

    setIsConverting(false)
    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al convertir cuenta')
      return
    }
    router.push('/admin/users')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      {isConflict && (
        <div className="bg-miski-gold-light/20 border border-miski-gold/30 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-miski-forest">
            Este DNI ya está registrado como cliente
          </p>
          <p className="text-xs text-miski-forest/80 mt-0.5">
            Los datos han sido autocompletados. Edítalos si es necesario y confirma la conversión.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Nombre completo</label>
          <input
            {...register('full_name')}
            className={inputCls}
            placeholder="ej. Juan Pérez Torres"
            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[0-9]/g, '') }}
          />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        <div>
          <label className={labelCls}>DNI</label>
          <input
            {...register('dni', {
              onBlur: (e) => checkDni(e.target.value),
            })}
            className={inputCls}
            placeholder="12345678"
            maxLength={8}
          />
          {dniChecking && <p className="text-miski-muted text-xs mt-1">Verificando...</p>}
          {!dniChecking && errors.dni && (
            <p className="text-red-500 text-xs mt-1">{errors.dni.message}</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Teléfono</label>
          <input
            {...register('phone')}
            className={inputCls}
            placeholder="987654321"
            inputMode="numeric"
            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Email</label>
          <input type="email" {...register('email')} className={inputCls} placeholder="usuario@miski.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Rol</label>
          <select {...register('role')} className={inputCls}>
            <option value="">Selecciona un rol</option>
            <option value="operator">Operador</option>
            <option value="delivery">Repartidor</option>
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
        </div>

        {!isConflict && (
          <div>
            <label className={labelCls}>Contraseña temporal</label>
            <input type="password" {...register('password')} className={inputCls} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
        )}
      </div>

      {!isConflict && (
        <p className="text-xs text-miski-muted">
          El usuario deberá cambiar la contraseña en su primer inicio de sesión.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        {isConflict ? (
          <button
            type="button"
            onClick={handleConvertSubmit}
            disabled={isConverting || dniChecking}
            className="bg-miski-gold text-white hover:bg-miski-gold-light hover:text-amber-900 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting ? 'Convirtiendo...' : `Convertir cuenta${selectedRole ? ` a ${ROLE_LABELS[selectedRole]}` : ''}`}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting || dniChecking}
            className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creando...' : 'Crear usuario'}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push('/admin/users')}
          className="border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ——— Edit form ———

function EditUserForm({ user }: { user: User }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(user.status)

  const editableEmail = user.role === 'customer' || user.role === 'supplier'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      full_name: user.full_name,
      phone: user.phone ?? '',
      ...(editableEmail ? { email: user.email } : {}),
    },
  })

  async function onSubmit(data: UpdateUserInput) {
    setServerError(null)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }

    router.push('/admin/users')
    router.refresh()
  }

  async function handleToggleStatus() {
    setTogglingStatus(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_status' }),
    })
    setTogglingStatus(false)

    if (res.ok) {
      const { status } = await res.json()
      setCurrentStatus(status)
    }
  }

  const isActive = currentStatus === 'active'

  return (
    <div className="space-y-8 max-w-lg">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}

      {/* Basic info */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className={labelCls}>Nombre completo</label>
          <input
            {...register('full_name')}
            className={inputCls}
            onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[0-9]/g, '') }}
          />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>DNI</label>
            <input value={user.dni ?? ''} readOnly className={readonlyCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input
              {...register('phone')}
              className={inputCls}
              inputMode="numeric"
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            {editableEmail ? (
              <>
                <input type="email" {...register('email')} className={inputCls} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </>
            ) : (
              <input value={user.email} readOnly className={readonlyCls} />
            )}
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <input value={ROLE_LABELS[user.role] ?? user.role} readOnly className={readonlyCls} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/users')}
            className="border border-miski-border text-miski-forest hover:bg-miski-green-soft rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>

      {/* Status */}
      <div className="border-t border-miski-border pt-6">
        <h3 className="text-sm font-medium text-miski-forest mb-3">Estado de la cuenta</h3>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isActive
                ? 'bg-miski-lime/20 text-miski-forest'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {isActive ? 'Activo' : 'Suspendido'}
          </span>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-miski-lime/20 text-miski-forest hover:bg-miski-lime/30'
            }`}
          >
            {togglingStatus ? '...' : isActive ? 'Suspender' : 'Reactivar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ——— Public export ———

export function UserForm({ user }: UserFormProps) {
  if (user) return <EditUserForm user={user} />
  return <CreateUserForm />
}

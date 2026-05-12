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
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const readonlyCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500'

// ——— Create form ———

function CreateUserForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    userId: string
    email: string
    name: string
  } | null>(null)
  const [converting, setConverting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  })

  const selectedRole = useWatch({ control, name: 'role' })

  async function onSubmit(data: CreateUserInput) {
    setServerError(null)
    setConflict(null)

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.status === 409) {
      const err = await res.json()
      if (err.conflict === 'dni_customer') {
        setConflict({
          userId: err.existing_user_id,
          email: err.existing_email,
          name: err.existing_name,
        })
        return
      }
      setServerError(typeof err.error === 'string' ? err.error : 'Conflicto al guardar')
      return
    }

    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }

    router.push('/admin/users')
    router.refresh()
  }

  async function handleConvert() {
    if (!conflict || !selectedRole) return
    setConverting(true)
    setServerError(null)

    const res = await fetch(`/api/admin/users/${conflict.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert_role', role: selectedRole }),
    })

    setConverting(false)
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

      {conflict && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg space-y-2">
          <p>
            El DNI ya pertenece a <strong>{conflict.name}</strong> ({conflict.email}), registrado
            como cliente. ¿Desea convertir esta cuenta a{' '}
            <strong>{ROLE_LABELS[selectedRole] ?? selectedRole}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              className="bg-yellow-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-yellow-700 disabled:opacity-50"
            >
              {converting ? 'Convirtiendo...' : 'Convertir cuenta'}
            </button>
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-xs font-medium hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
          <input {...register('full_name')} className={inputCls} placeholder="ej. Juan Pérez Torres" />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
          <input {...register('dni')} className={inputCls} placeholder="12345678" maxLength={8} />
          {errors.dni && <p className="text-red-500 text-xs mt-1">{errors.dni.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input {...register('phone')} className={inputCls} placeholder="987654321" />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" {...register('email')} className={inputCls} placeholder="usuario@miski.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select {...register('role')} className={inputCls}>
            <option value="">Selecciona un rol</option>
            <option value="operator">Operador</option>
            <option value="delivery">Repartidor</option>
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal</label>
          <input type="password" {...register('password')} className={inputCls} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        El usuario deberá cambiar la contraseña en su primer inicio de sesión.
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Creando...' : 'Crear usuario'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/users')}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      full_name: user.full_name,
      phone: user.phone ?? '',
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
          <input {...register('full_name')} className={inputCls} />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
            <input value={user.dni ?? ''} readOnly className={readonlyCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input {...register('phone')} className={inputCls} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input value={user.email} readOnly className={readonlyCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <input value={ROLE_LABELS[user.role] ?? user.role} readOnly className={readonlyCls} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/users')}
            className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>

      {/* Status */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Estado de la cuenta</h3>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                : 'bg-green-50 text-green-600 hover:bg-green-100'
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

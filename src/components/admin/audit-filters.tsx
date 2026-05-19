'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

interface Props {
  fromDate: string
  toDate:   string
  action:   string
  module:   string
  userName: string
}

export function AuditFilters({ fromDate, toDate, action, module: mod, userName }: Props) {
  const router  = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd     = new FormData(e.currentTarget)
    const params = new URLSearchParams()
    params.set('page', '1')
    const vals: Record<string, string> = {
      from_date: String(fd.get('from_date') ?? '').trim(),
      to_date:   String(fd.get('to_date')   ?? '').trim(),
      action:    String(fd.get('action')    ?? '').trim(),
      module:    String(fd.get('module')    ?? '').trim(),
      user_name: String(fd.get('user_name') ?? '').trim(),
    }
    for (const [k, v] of Object.entries(vals)) {
      if (v) params.set(k, v)
    }
    router.push(`/admin/audit?${params.toString()}`)
  }

  function handleClear() {
    formRef.current?.reset()
    router.push('/admin/audit')
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            name="from_date"
            defaultValue={fromDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            name="to_date"
            defaultValue={toDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Acción</label>
          <select
            name="action"
            defaultValue={action}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          >
            <option value="">Todas</option>
            {Object.values(AUDIT_ACTIONS).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Módulo</label>
          <select
            name="module"
            defaultValue={mod}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          >
            <option value="">Todos</option>
            {Object.values(AUDIT_MODULES).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Usuario</label>
          <input
            type="text"
            name="user_name"
            defaultValue={userName}
            placeholder="Nombre…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
        >
          Filtrar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

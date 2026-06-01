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

const inputCls =
  'w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors placeholder:text-gray-300 text-gray-800'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

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
      className="bg-white rounded-xl border border-miski-sage/40 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-miski-forest/70 uppercase tracking-wider">Filtros</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div>
          <label className={labelCls}>Desde</label>
          <input
            type="date"
            name="from_date"
            defaultValue={fromDate}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Hasta</label>
          <input
            type="date"
            name="to_date"
            defaultValue={toDate}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Acción</label>
          <select
            name="action"
            defaultValue={action}
            className={inputCls}
          >
            <option value="">Todas</option>
            {Object.values(AUDIT_ACTIONS).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Módulo</label>
          <select
            name="module"
            defaultValue={mod}
            className={inputCls}
          >
            <option value="">Todos</option>
            {Object.values(AUDIT_MODULES).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Usuario</label>
          <input
            type="text"
            name="user_name"
            defaultValue={userName}
            placeholder="Nombre…"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
        >
          Filtrar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="border border-miski-sage text-miski-forest hover:bg-miski-sage/30 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

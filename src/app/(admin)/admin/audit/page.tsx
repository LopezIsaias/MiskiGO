import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuditFilters } from '@/components/admin/audit-filters'
import { AuditTable } from '@/components/admin/audit-table'
import type { AuditRow } from '@/components/admin/audit-table'

export const metadata: Metadata = { title: 'Log de auditoría' }

const PAGE_SIZE = 50

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'superadmin' || profile?.status !== 'active') {
    redirect('/login')
  }

  const page     = Math.max(1, parseInt(str(sp.page) || '1', 10))
  const fromDate = str(sp.from_date)
  const toDate   = str(sp.to_date)
  const action   = str(sp.action)
  const mod      = str(sp.module)
  const userName = str(sp.user_name).trim()

  const adminClient = createAdminClient()

  // Resolve user name → IDs (case-insensitive partial match)
  let filterUserIds: string[] | null = null
  if (userName) {
    const { data: matched } = await adminClient
      .from('users')
      .select('id')
      .ilike('full_name', `%${userName}%`)
      .limit(100)
    filterUserIds = (matched ?? []).map((u: { id: string }) => u.id)
  }

  let rows: AuditRow[] = []
  let total = 0

  // Skip DB query if user filter matched nothing
  const shouldQuery = !userName || (filterUserIds && filterUserIds.length > 0)

  if (shouldQuery) {
    let query = adminClient
      .from('audit_log')
      .select(
        `id, timestamp, role_at_time, action, module,
         entity_type, entity_id, previous_value, new_value, notes, ip_address,
         actor:users!user_id(id, full_name)`,
        { count: 'exact' },
      )
      .order('timestamp', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (fromDate) query = query.gte('timestamp', fromDate)
    if (toDate)   query = query.lte('timestamp', `${toDate}T23:59:59`)
    if (action)   query = query.eq('action', action)
    if (mod)      query = query.eq('module', mod)
    if (filterUserIds && filterUserIds.length > 0) {
      query = query.in('user_id', filterUserIds)
    }

    const { data, count } = await query
    rows  = (data ?? []) as unknown as AuditRow[]
    total = count ?? 0
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Build a URL preserving all current filters but changing only `page`
  function pageUrl(p: number): string {
    const params = new URLSearchParams()
    if (fromDate) params.set('from_date', fromDate)
    if (toDate)   params.set('to_date', toDate)
    if (action)   params.set('action', action)
    if (mod)      params.set('module', mod)
    if (userName) params.set('user_name', userName)
    params.set('page', String(p))
    return `/admin/audit?${params.toString()}`
  }

  // Export URL — same filters, no pagination
  const exportParams = new URLSearchParams()
  if (fromDate) exportParams.set('from_date', fromDate)
  if (toDate)   exportParams.set('to_date', toDate)
  if (action)   exportParams.set('action', action)
  if (mod)      exportParams.set('module', mod)
  if (userName) exportParams.set('user_name', userName)
  const exportUrl = `/api/admin/audit/export?${exportParams.toString()}`

  // Pagination: show up to 7 buttons centered around current page
  function pageNumbers(): number[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4)           return [1, 2, 3, 4, 5, 6, 7]
    if (page >= totalPages - 3) {
      return Array.from({ length: 7 }, (_, i) => totalPages - 6 + i)
    }
    return [page - 3, page - 2, page - 1, page, page + 1, page + 2, page + 3]
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Log de auditoría</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0
              ? `${total.toLocaleString('es-PE')} registro${total !== 1 ? 's' : ''}${totalPages > 1 ? ` · Página ${page} de ${totalPages}` : ''}`
              : 'Sin registros para los filtros seleccionados'}
          </p>
        </div>
        <a
          href={exportUrl}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-green-700 border border-green-300 hover:bg-green-50 transition-colors"
        >
          Exportar CSV
        </a>
      </div>

      {/* Filters */}
      <AuditFilters
        fromDate={fromDate}
        toDate={toDate}
        action={action}
        module={mod}
        userName={userName}
      />

      {/* Table */}
      <AuditTable rows={rows} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ← Anterior
            </Link>
          )}
          {pageNumbers().map(p => (
            <Link
              key={p}
              href={pageUrl(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-green-600 text-white'
                  : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {p}
            </Link>
          ))}
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

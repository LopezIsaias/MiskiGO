import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateTime } from '@/lib/utils'

type ExportRow = {
  timestamp:    string
  role_at_time: string
  action:       string
  module:       string
  entity_type:  string | null
  entity_id:    string | null
  notes:        string | null
  ip_address:   string | null
  actor:        { full_name: string } | null
}

function esc(v: string | null | undefined): string {
  const s = v ?? ''
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'superadmin' || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get('from_date') ?? ''
  const toDate   = searchParams.get('to_date')   ?? ''
  const action   = searchParams.get('action')    ?? ''
  const mod      = searchParams.get('module')    ?? ''
  const userName = searchParams.get('user_name')?.trim() ?? ''

  const adminClient = createAdminClient()

  let filterUserIds: string[] | null = null
  if (userName) {
    const { data: matched } = await adminClient
      .from('users')
      .select('id')
      .ilike('full_name', `%${userName}%`)
      .limit(100)
    filterUserIds = (matched ?? []).map((u: { id: string }) => u.id)
    if (filterUserIds.length === 0) {
      return buildCsv([])
    }
  }

  let query = adminClient
    .from('audit_log')
    .select(`
      timestamp, role_at_time, action, module,
      entity_type, entity_id, notes, ip_address,
      actor:users!user_id(full_name)
    `)
    .order('timestamp', { ascending: false })
    .limit(5000)

  if (fromDate) query = query.gte('timestamp', fromDate)
  if (toDate)   query = query.lte('timestamp', `${toDate}T23:59:59`)
  if (action)   query = query.eq('action', action)
  if (mod)      query = query.eq('module', mod)
  if (filterUserIds && filterUserIds.length > 0) {
    query = query.in('user_id', filterUserIds)
  }

  const { data } = await query
  return buildCsv((data ?? []) as unknown as ExportRow[])
}

function buildCsv(rows: ExportRow[]): NextResponse {
  const header = [
    esc('Fecha y hora'),
    esc('Usuario'),
    esc('Rol'),
    esc('Acción'),
    esc('Módulo'),
    esc('Tipo de entidad'),
    esc('ID de entidad'),
    esc('IP'),
    esc('Notas'),
  ].join(',')

  const lines = [
    header,
    ...rows.map(r => [
      esc(formatDateTime(r.timestamp)),
      esc(r.actor?.full_name ?? '—'),
      esc(r.role_at_time),
      esc(r.action),
      esc(r.module),
      esc(r.entity_type),
      esc(r.entity_id),
      esc(r.ip_address),
      esc(r.notes),
    ].join(',')),
  ]

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit_${date}.csv"`,
    },
  })
}

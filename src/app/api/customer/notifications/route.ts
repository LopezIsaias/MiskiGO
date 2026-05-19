import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['customer', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: notifications } = await adminClient
    .from('notifications')
    .select('id, type, title, body, reference_type, reference_id, created_at, read_at')
    .eq('recipient_id', user.id)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(20)

  const list = notifications ?? []
  const unreadCount = list.filter(n => !n.read_at).length

  return NextResponse.json({ notifications: list, unreadCount })
}

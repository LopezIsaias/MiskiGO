import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLE_DASHBOARD } from '@/lib/constants'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  redirect(ROLE_DASHBOARD[data?.role ?? ''] ?? '/login')
}

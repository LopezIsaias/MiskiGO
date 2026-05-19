import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WalletCreditsBoard } from '@/components/admin/wallet-credits-board'
import type { CreditRow } from '@/components/admin/wallet-credits-board'

export const metadata: Metadata = { title: 'Aprobación de créditos' }

export default async function AdminWalletPage() {
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

  const adminClient = createAdminClient()
  const { data: rawPending } = await adminClient
    .from('wallet_transactions')
    .select(`
      id, type, amount, notes, created_at,
      customer:users!user_id(full_name, phone),
      reference_order:orders!reference_order_id(id)
    `)
    .neq('type', 'recharge')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const pending = (rawPending ?? []) as unknown as CreditRow[]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Aprobación de créditos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length > 0
            ? `${pending.length} crédito${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} de aprobación`
            : 'No hay créditos pendientes'}
        </p>
      </div>
      <WalletCreditsBoard pending={pending} />
    </div>
  )
}

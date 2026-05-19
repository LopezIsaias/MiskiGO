import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WalletBoard } from '@/components/operator/wallet-board'
import type { RechargeRow } from '@/components/operator/wallet-board'

export const metadata: Metadata = { title: 'Recargas de billetera' }

export default async function OperatorWalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()
  const { data: rawPending } = await adminClient
    .from('wallet_transactions')
    .select(`
      id, amount, notes, proof_url, created_at,
      customer:users!user_id(full_name, phone)
    `)
    .eq('type', 'recharge')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const pending = (rawPending ?? []) as unknown as RechargeRow[]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Recargas de billetera</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length > 0
            ? `${pending.length} recarga${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} de revisión`
            : 'No hay recargas pendientes'}
        </p>
      </div>
      <WalletBoard pending={pending} />
    </div>
  )
}

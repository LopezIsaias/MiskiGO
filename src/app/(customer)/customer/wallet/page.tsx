import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { WalletRechargeForm } from '@/components/customer/wallet-recharge-form'

export const metadata: Metadata = { title: 'Mi billetera' }

const TX_TYPE_LABEL: Record<string, string> = {
  recharge:   'Recarga',
  payment:    'Pago de pedido',
  refund:     'Crédito por reclamo',
  bonus:      'Bono',
  adjustment: 'Ajuste',
}

const TX_STATUS_LABEL: Record<string, string> = {
  pending:  'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

const TX_STATUS_COLOR: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

type TxRow = {
  id:              string
  type:            string
  amount:          number
  status:          string
  notes:           string | null
  created_at:      string
  reference_order: { id: string } | null
}

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  const { data: profile } = await adminClient
    .from('users')
    .select('role, status, wallet_balance')
    .eq('id', user.id)
    .maybeSingle()

  if (!['customer', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const { data: rawTxs } = await adminClient
    .from('wallet_transactions')
    .select(`
      id, type, amount, status, notes, created_at,
      reference_order:orders!reference_order_id(id)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const transactions = (rawTxs ?? []) as unknown as TxRow[]
  const walletBalance = Number(profile?.wallet_balance ?? 0)

  const pendingRecharges = transactions.filter(t => t.type === 'recharge' && t.status === 'pending').length

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-miski-forest">Mi billetera</h1>

      {/* Balance card */}
      <div className="bg-miski-forest rounded-2xl shadow-sm p-6">
        <p className="block text-xs font-semibold text-miski-lime uppercase tracking-wider mb-1.5">Saldo disponible</p>
        <p className="font-display text-4xl font-extrabold tabular text-white">{formatCurrency(walletBalance)}</p>
        {pendingRecharges > 0 && (
          <p className="text-xs text-miski-lime-light mt-2">
            Tienes {pendingRecharges} recarga{pendingRecharges > 1 ? 's' : ''} en revisión que no están incluidas en este monto.
          </p>
        )}
        {pendingRecharges === 0 && (
          <p className="text-xs text-white/60 mt-2">
            Solo se acredita saldo aprobado.
          </p>
        )}
      </div>

      <WalletRechargeForm />

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-3">
            Historial de movimientos
          </h2>
          <div className="bg-white rounded-2xl border border-miski-border divide-y divide-miski-border">
            {transactions.map(tx => {
              const isCredit = ['recharge', 'refund', 'bonus', 'adjustment'].includes(tx.type)
              const orderId  = tx.reference_order?.id.slice(0, 8).toUpperCase()

              return (
                <div key={tx.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-miski-forest">
                        {TX_TYPE_LABEL[tx.type] ?? tx.type}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TX_STATUS_COLOR[tx.status] ?? 'bg-amber-100 text-amber-800'}`}>
                        {TX_STATUS_LABEL[tx.status] ?? tx.status}
                      </span>
                    </div>
                    <p className="text-xs text-miski-muted">{formatDateTime(tx.created_at)}</p>
                    {orderId && (
                      <p className="text-xs text-miski-muted mt-0.5">Pedido #{orderId}</p>
                    )}
                    {tx.status === 'rejected' && tx.notes && (
                      <p className="text-xs text-red-500 mt-0.5 italic">{tx.notes}</p>
                    )}
                    {tx.status === 'pending' && tx.type === 'recharge' && (
                      <p className="text-xs text-miski-gold mt-0.5">
                        Tiempo estimado: 1 a 3 horas en horario laboral
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 tabular text-base font-bold ${isCredit ? 'text-miski-forest' : 'text-red-500'}`}>
                    {isCredit ? '+' : '−'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <p className="text-sm text-miski-muted">No hay movimientos en tu billetera aún.</p>
      )}
    </div>
  )
}

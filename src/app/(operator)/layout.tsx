import type { ReactNode } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { OperatorSidebar } from '@/components/operator/sidebar'

// Los badges deben reflejar el estado actual, no una versión cacheada.
export const dynamic = 'force-dynamic'

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  // Conteos de pendientes para los badges del sidebar. Se recalculan en cada
  // navegación (el layout corre por request), así el operador ve lo pendiente
  // apenas entra. Misma definición que cada página de destino.
  const admin = createAdminClient()
  const [paymentsRes, rechargesRes] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'payment_submitted'),
    admin.from('wallet_transactions').select('id', { count: 'exact', head: true }).eq('type', 'recharge').eq('status', 'pending'),
  ])

  return (
    <div className="min-h-screen md:h-screen md:flex md:overflow-hidden bg-miski-hueso">
      <OperatorSidebar
        pendingPayments={paymentsRes.count ?? 0}
        pendingRecharges={rechargesRes.count ?? 0}
      />
      <main className="flex-1 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-20 md:p-8">
        {children}
      </main>
    </div>
  )
}

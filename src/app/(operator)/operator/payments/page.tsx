import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentsTable } from '@/components/operator/payments-table'
import type { PendingOrder, ConfirmedOrder } from '@/components/operator/payments-table'

export default async function OperatorPaymentsPage() {
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
    .from('orders')
    .select(`
      id, total_amount, payment_method, created_at,
      customer:users!customer_id(full_name, phone),
      payment_verifications(amount, submitted_at)
    `)
    .eq('status', 'payment_submitted')
    .order('created_at', { ascending: true })

  const { data: activeCycles } = await adminClient
    .from('dispatch_cycles')
    .select('id')
    .in('status', ['open', 'closed', 'in_progress'])

  const cycleIds = activeCycles?.map(c => c.id) ?? []

  let rawConfirmed: unknown[] = []
  if (cycleIds.length > 0) {
    const { data } = await adminClient
      .from('orders')
      .select(`
        id, status, total_amount, payment_method, created_at,
        customer:users!customer_id(full_name, phone)
      `)
      .in('status', ['confirmed', 'assigned', 'in_transit', 'delivered'])
      .in('dispatch_cycle_id', cycleIds)
      .order('created_at', { ascending: false })
      .limit(100)
    rawConfirmed = data ?? []
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-miski-forest mb-6">Aprobación de pagos</h1>
      <PaymentsTable
        pending={(rawPending ?? []) as unknown as PendingOrder[]}
        confirmed={rawConfirmed as unknown as ConfirmedOrder[]}
      />
    </div>
  )
}

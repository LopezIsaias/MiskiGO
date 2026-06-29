import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPaymentAccounts } from '@/lib/supabase/payment-accounts'
import { CheckoutForm } from '@/components/customer/checkout-form'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('wallet_balance, full_name, dni, ruc')
    .eq('id', user.id)
    .maybeSingle()

  const walletBalance = profile?.wallet_balance ?? 0
  const paymentAccounts = await getPaymentAccounts(createAdminClient())

  return (
    <div>
      <h1 className="text-2xl font-bold text-miski-forest mb-6">Checkout</h1>
      <CheckoutForm
        walletBalance={walletBalance}
        userId={user.id}
        fullName={profile?.full_name ?? ''}
        dni={profile?.dni ?? ''}
        ruc={profile?.ruc ?? ''}
        paymentAccounts={paymentAccounts}
      />
    </div>
  )
}

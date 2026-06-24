import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SourcingPanel, type SourcingCycle, type SourcingSupplier, type SourcingProduct } from '@/components/operator/sourcing-panel'

export default async function OperatorSourcingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status, region_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const admin = createAdminClient()
  const isSuperadmin = profile!.role === 'superadmin'

  let cyclesQuery = admin
    .from('dispatch_cycles')
    .select('id, dispatch_date, region_id')
    .eq('status', 'open')
    .order('dispatch_date', { ascending: true })
  if (!isSuperadmin && profile!.region_id) cyclesQuery = cyclesQuery.eq('region_id', profile!.region_id)
  const { data: cycles } = await cyclesQuery

  const { data: suppliers } = await admin
    .from('users')
    .select('id, full_name')
    .eq('role', 'supplier')
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  const { data: products } = await admin
    .from('products')
    .select('id, name, unit')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-2">Captura de oferta (sourcing)</h1>
      <p className="text-sm text-miski-muted mb-6">
        Registra la oferta real de cada proveedor (por teléfono o en campo) en su nombre.
        Luego asigna los pedidos del ciclo a esa oferta.
      </p>
      <SourcingPanel
        cycles={(cycles ?? []) as SourcingCycle[]}
        suppliers={(suppliers ?? []) as SourcingSupplier[]}
        products={(products ?? []) as SourcingProduct[]}
      />
    </div>
  )
}

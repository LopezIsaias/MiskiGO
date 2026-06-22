import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OfferingsManager, type OfferingCycle, type OfferingProduct, type ExistingOffering } from '@/components/operator/offerings-manager'

export default async function OperatorOfferingsPage() {
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

  // Ciclos abiertos en alcance (operador: su región; superadmin: todos).
  let cyclesQuery = admin
    .from('dispatch_cycles')
    .select('id, dispatch_date, region_id')
    .eq('status', 'open')
    .order('dispatch_date', { ascending: true })
  if (!isSuperadmin && profile!.region_id) cyclesQuery = cyclesQuery.eq('region_id', profile!.region_id)
  const { data: cycles } = await cyclesQuery

  const { data: products } = await admin
    .from('products')
    .select('id, name, unit')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Ofertas activas del primer ciclo abierto (si hay).
  const firstCycleId = cycles?.[0]?.id
  const { data: offerings } = firstCycleId
    ? await admin
        .from('cycle_offerings')
        .select('product_id, expected_quantity, sale_price')
        .eq('dispatch_cycle_id', firstCycleId)
        .eq('status', 'active')
    : { data: [] }

  return (
    <div>
      <h1 className="text-2xl font-bold text-miski-forest mb-2">Ofertas del ciclo</h1>
      <p className="text-sm text-miski-olive mb-6">
        Define qué productos se ofrecen este ciclo, la cantidad esperada y el precio de venta.
        El catálogo del cliente se arma desde aquí.
      </p>
      <OfferingsManager
        cycles={(cycles ?? []) as OfferingCycle[]}
        products={(products ?? []) as OfferingProduct[]}
        initialOfferings={(offerings ?? []) as ExistingOffering[]}
        canCreateCycle={!isSuperadmin}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClaimsBoard } from '@/components/operator/claims-board'
import type { ClaimRow } from '@/components/operator/claims-board'

export const metadata: Metadata = { title: 'Reclamos' }

type RawClaim = {
  id:               string
  status:           string
  claimed_quantity: number
  reason:           string
  photo_url:        string
  created_at:       string
  resolution_type:  string | null
  resolution_amount: number | null
  is_justified:     boolean | null
  resolved_at:      string | null
  customer:  { full_name: string; phone: string | null } | null
  order:     { id: string; delivery_address: string } | null
  product:   { name: string; unit: string } | null
  resolver:  { full_name: string } | null
}

export default async function ClaimsPage() {
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

  const { data: rawClaims } = await adminClient
    .from('claims')
    .select(`
      id, status, claimed_quantity, reason, photo_url, created_at,
      resolution_type, resolution_amount, is_justified, resolved_at,
      customer:users!customer_id(full_name, phone),
      order:orders!order_id(id, delivery_address),
      product:products!product_id(name, unit),
      resolver:users!resolved_by(full_name)
    `)
    .order('created_at', { ascending: false })

  const claims = (rawClaims ?? []) as unknown as RawClaim[]

  const pending  = claims.filter(c => c.status === 'pending') as ClaimRow[]
  const resolved = claims.filter(c => c.status !== 'pending') as ClaimRow[]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reclamos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length > 0
            ? `${pending.length} reclamo${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} de resolución`
            : 'Todos los reclamos están resueltos'}
        </p>
      </div>
      <ClaimsBoard pending={pending} resolved={resolved} />
    </div>
  )
}

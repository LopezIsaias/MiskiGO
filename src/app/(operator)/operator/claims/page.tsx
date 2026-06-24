import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClaimsBoard } from '@/components/operator/claims-board'
import type { ClaimRow } from '@/components/operator/claims-board'

export const metadata: Metadata = { title: 'Reclamos' }

type RawClaim = {
  id:                   string
  status:               string
  claimed_quantity:     number
  reason:               string
  photo_url:            string
  photo_taken_at:       string | null
  photo_verification:   string | null
  created_at:           string
  product_id:           string
  resolution_type:      string | null
  resolution_amount:    number | null
  resolution_proof_url: string | null
  is_justified:         boolean | null
  resolved_at:          string | null
  customer:  { full_name: string; phone: string | null } | null
  order:     { id: string; delivery_address: string; dispatch_cycle_id: string; total_amount: number } | null
  product:   { name: string; unit: string } | null
  resolver:  { full_name: string } | null
}

type RawReception = {
  dispatch_cycle_id: string
  product_id:        string
  photo_url:         string
  rejected_quantity: number
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
      id, status, claimed_quantity, reason, photo_url, photo_taken_at, photo_verification, created_at,
      product_id,
      resolution_type, resolution_amount, resolution_proof_url, is_justified, resolved_at,
      customer:users!customer_id(full_name, phone),
      order:orders!order_id(id, delivery_address, dispatch_cycle_id, total_amount),
      product:products!product_id(name, unit),
      resolver:users!resolved_by(full_name)
    `)
    .order('created_at', { ascending: false })

  const claims = (rawClaims ?? []) as unknown as RawClaim[]

  // Fetch reception photos for each (dispatch_cycle_id, product_id) pair
  const cycleIds  = [...new Set(claims.map(c => c.order?.dispatch_cycle_id).filter(Boolean))] as string[]
  const productIds = [...new Set(claims.map(c => c.product_id).filter(Boolean))] as string[]

  const receptionMap: Record<string, string | null> = {}
  if (cycleIds.length > 0 && productIds.length > 0) {
    const { data: rawReceptions } = await adminClient
      .from('reception_records')
      .select('dispatch_cycle_id, product_id, photo_url, rejected_quantity')
      .in('dispatch_cycle_id', cycleIds)
      .in('product_id', productIds)

    for (const r of (rawReceptions ?? []) as unknown as RawReception[]) {
      const key = `${r.dispatch_cycle_id}|${r.product_id}`
      // Prefer records that flagged rejected items; otherwise keep first found
      if (!(key in receptionMap) || Number(r.rejected_quantity) > 0) {
        receptionMap[key] = r.photo_url
      }
    }
  }

  const enrichedClaims = claims.map(c => ({
    ...c,
    reception_photo_url: c.order?.dispatch_cycle_id
      ? (receptionMap[`${c.order.dispatch_cycle_id}|${c.product_id}`] ?? null)
      : null,
  }))

  const pending  = enrichedClaims.filter(c => c.status === 'pending') as ClaimRow[]
  const resolved = enrichedClaims.filter(c => c.status !== 'pending') as ClaimRow[]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-miski-forest">Reclamos</h1>
        <p className="text-sm text-miski-muted mt-1">
          {pending.length > 0
            ? `${pending.length} reclamo${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} de resolución`
            : 'Todos los reclamos están resueltos'}
        </p>
      </div>
      <ClaimsBoard pending={pending} resolved={resolved} isSuperadmin={profile?.role === 'superadmin'} />
    </div>
  )
}

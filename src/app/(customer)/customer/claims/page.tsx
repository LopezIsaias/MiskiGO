import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mis reclamos' }

const STATUS_LABEL: Record<string, string> = {
  pending:            'En revisión',
  approved:           'Aprobado',
  partially_approved: 'Aprobado parcial',
  rejected:           'Rechazado',
}

const STATUS_COLOR: Record<string, string> = {
  pending:            'bg-amber-100 text-amber-800',
  approved:           'bg-green-100 text-green-800',
  partially_approved: 'bg-green-100 text-green-800',
  rejected:           'bg-red-100 text-red-700',
}

const RESOLUTION_LABEL: Record<string, string> = {
  wallet_credit:   'Crédito en billetera',
  external_refund: 'Reembolso externo',
  reprogrammed:    'Reprogramado',
}

type RawClaim = {
  id:                   string
  status:               string
  reason:               string
  claimed_quantity:     number
  resolution_type:      string | null
  resolution_amount:    number | null
  resolution_proof_url: string | null
  resolved_at:          string | null
  created_at:           string
  order_id:             string
  product: { name: string; unit: string } | null
}

export default async function CustomerClaimsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: rawClaims } = await adminClient
    .from('claims')
    .select(`
      id, status, reason, claimed_quantity,
      resolution_type, resolution_amount, resolution_proof_url, resolved_at, created_at,
      order_id,
      product:products!product_id(name, unit)
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  const claims = (rawClaims ?? []) as unknown as RawClaim[]

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-6">Mis reclamos</h1>

      {claims.length === 0 ? (
        <p className="text-miski-muted text-sm">Aún no has hecho reclamos.</p>
      ) : (
        <div className="space-y-4">
          {claims.map(claim => (
            <div key={claim.id} className="bg-white rounded-xl border border-miski-border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-miski-muted">
                    {formatDate(claim.created_at)} · Pedido #{claim.order_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm font-semibold text-miski-forest mt-0.5">
                    {claim.product?.name ?? '—'}
                    <span className="text-miski-muted font-normal ml-1">
                      · {claim.claimed_quantity} {claim.product?.unit ?? ''}
                    </span>
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[claim.status] ?? 'bg-gray-100 text-miski-tinta'}`}>
                  {STATUS_LABEL[claim.status] ?? claim.status}
                </span>
              </div>

              <p className="text-xs text-miski-tinta mb-3">{claim.reason}</p>

              {/* Resolución */}
              {claim.status !== 'pending' && (
                <div className="border-t border-miski-border pt-3 space-y-1.5">
                  {claim.resolution_type && (
                    <div className="flex justify-between text-xs">
                      <span className="text-miski-muted">Resolución</span>
                      <span className="font-medium text-miski-forest">
                        {RESOLUTION_LABEL[claim.resolution_type] ?? claim.resolution_type}
                      </span>
                    </div>
                  )}
                  {claim.resolution_amount !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-miski-muted">Monto</span>
                      <span className="tabular font-bold text-miski-forest">{formatCurrency(claim.resolution_amount)}</span>
                    </div>
                  )}
                  {claim.resolved_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-miski-muted">Resuelto</span>
                      <span className="text-miski-tinta">{formatDate(claim.resolved_at)}</span>
                    </div>
                  )}

                  {/* Comprobante de devolución */}
                  {claim.resolution_proof_url ? (
                    <a
                      href={claim.resolution_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-miski-green hover:text-miski-forest"
                    >
                      Ver comprobante de devolución
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    (claim.resolution_type === 'wallet_credit' || claim.resolution_type === 'external_refund') && (
                      <p className="text-xs text-miski-muted mt-2">Comprobante de devolución no disponible.</p>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

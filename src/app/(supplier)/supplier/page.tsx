import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StarRating } from '@/components/ui/star-rating'

const STATUS_LABEL: Record<string, string> = {
  active: 'Activas',
  reserved: 'Reservadas',
  fulfilled: 'Entregadas',
  expired: 'Vencidas',
}

export default async function SupplierDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rawProfile } = await supabase
    .from('users')
    .select('full_name, reliability_score')
    .eq('id', user!.id)
    .maybeSingle()
  const profile = rawProfile as unknown as { full_name: string | null; reliability_score: number | null } | null

  const { data: publications } = await supabase
    .from('supplier_publications')
    .select('status')
    .eq('supplier_id', user!.id)

  const counts = { active: 0, reserved: 0, fulfilled: 0, expired: 0 }
  for (const p of publications ?? []) {
    const s = p.status as keyof typeof counts
    if (s in counts) counts[s]++
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-miski-forest">
          Bienvenido, {profile?.full_name ?? 'proveedor'}
        </h1>
        <p className="text-sm text-miski-olive mt-1">
          Publica tu disponibilidad de productos para los próximos ciclos de despacho.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-miski-olive">Confiabilidad:</span>
          <StarRating score={Number(profile?.reliability_score ?? 100)} size="md" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
        {(Object.keys(STATUS_LABEL) as (keyof typeof counts)[]).map(status => (
          <div key={status} className="bg-white rounded-xl border border-miski-sage/40 shadow-sm p-5">
            <p className="text-xs font-medium text-miski-olive uppercase tracking-wide">
              {STATUS_LABEL[status]}
            </p>
            <p className="text-3xl font-bold text-miski-forest mt-1">{counts[status]}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href="/supplier/publications/new"
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
        >
          Nueva publicación
        </Link>
        <Link
          href="/supplier/publications"
          className="border border-miski-sage text-miski-forest hover:bg-miski-sage/30 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Ver todas las publicaciones
        </Link>
      </div>
    </div>
  )
}

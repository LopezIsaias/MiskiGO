import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CancelPublicationButton } from '@/components/supplier/cancel-publication-button'

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-800',
  reserved:  'bg-amber-100 text-amber-800',
  fulfilled: 'bg-miski-green/15 text-miski-forest',
  expired:   'bg-gray-100 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Activa',
  reserved:  'Reservada',
  fulfilled: 'Entregada',
  expired:   'Vencida',
}

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg',
  unit: 'und.',
  liter: 'lt',
  bunch: 'atado',
}

export default async function PublicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: publications } = await supabase
    .from('supplier_publications')
    .select(`
      *,
      product:products!product_id(name, unit),
      region:regions!region_id(name, city)
    `)
    .eq('supplier_id', user!.id)
    .order('published_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-miski-forest">Mis publicaciones</h1>
        <Link
          href="/supplier/publications/new"
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
        >
          Nueva publicación
        </Link>
      </div>

      {!publications?.length ? (
        <div className="text-center py-16">
          <p className="text-miski-muted text-sm mb-4">Aún no tienes publicaciones.</p>
          <Link
            href="/supplier/publications/new"
            className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
          >
            Publicar disponibilidad
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-miski-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-miski-forest/5">
              <tr>
                <th className="text-left px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Región</th>
                <th className="text-right px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Cantidad</th>
                <th className="text-right px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Precio mín.</th>
                <th className="text-left px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Vence</th>
                <th className="text-center px-4 py-3 text-miski-forest/60 text-xs font-semibold uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {publications.map(pub => {
                const product = pub.product as { name: string; unit: string } | null
                const region = pub.region as { name: string; city: string } | null
                const expiresDate = new Date(pub.expires_at)
                const isActive = pub.status === 'active'

                return (
                  <tr key={pub.id} className="hover:bg-miski-cream/30">
                    <td className="px-4 py-3 border-b border-miski-border font-medium text-gray-700">
                      {product?.name ?? '—'}
                      <span className="ml-1 text-xs text-miski-muted">
                        ({UNIT_LABEL[product?.unit ?? ''] ?? product?.unit})
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-gray-700 text-sm">
                      {region ? `${region.name} — ${region.city}` : '—'}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right text-gray-700 text-sm">
                      {pub.available_quantity.toLocaleString('es-PE')}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right text-gray-700 text-sm">
                      S/ {pub.minimum_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-gray-700 text-sm whitespace-nowrap">
                      {expiresDate.toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'America/Lima',
                      })}
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[pub.status] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {STATUS_LABEL[pub.status] ?? pub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-miski-border text-right">
                      <div className="flex justify-end gap-3">
                        {isActive && (
                          <>
                            <Link
                              href={`/supplier/publications/${pub.id}/edit`}
                              className="text-miski-green hover:text-miski-forest text-sm font-medium"
                            >
                              Editar
                            </Link>
                            <CancelPublicationButton id={pub.id} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

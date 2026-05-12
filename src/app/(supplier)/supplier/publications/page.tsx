import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CancelPublicationButton } from '@/components/supplier/cancel-publication-button'

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  reserved:  'bg-blue-100 text-blue-700',
  fulfilled: 'bg-gray-100 text-gray-600',
  expired:   'bg-red-100 text-red-600',
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
        <h1 className="text-2xl font-bold text-gray-900">Mis publicaciones</h1>
        <Link
          href="/supplier/publications/new"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Nueva publicación
        </Link>
      </div>

      {!publications?.length ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">Aún no tienes publicaciones.</p>
          <Link
            href="/supplier/publications/new"
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Publicar disponibilidad
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Región</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Precio mín.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vence</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {publications.map(pub => {
                const product = pub.product as { name: string; unit: string } | null
                const region = pub.region as { name: string; city: string } | null
                const expiresDate = new Date(pub.expires_at)
                const isActive = pub.status === 'active'

                return (
                  <tr key={pub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {product?.name ?? '—'}
                      <span className="ml-1 text-xs text-gray-400">
                        ({UNIT_LABEL[product?.unit ?? ''] ?? product?.unit})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {region ? `${region.name} — ${region.city}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {pub.available_quantity.toLocaleString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      S/ {pub.minimum_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {expiresDate.toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'America/Lima',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[pub.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABEL[pub.status] ?? pub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        {isActive && (
                          <>
                            <Link
                              href={`/supplier/publications/${pub.id}/edit`}
                              className="text-green-600 hover:text-green-800 font-medium"
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

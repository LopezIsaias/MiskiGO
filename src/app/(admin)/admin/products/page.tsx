import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ToggleButton } from '@/components/admin/toggle-button'

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg',
  unit: 'und.',
  liter: 'lt',
  bunch: 'atado',
}

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*, category:product_categories!category_id(name)')
    .is('deleted_at', null)
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-miski-forest">Productos</h1>
        <Link
          href="/admin/products/new"
          className="bg-miski-forest text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-miski-green transition-all"
        >
          Nuevo producto
        </Link>
      </div>

      {!products?.length ? (
        <p className="text-miski-muted text-sm">No hay productos aún.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Unidad</th>
                <th className="text-center px-4 py-3 font-medium text-miski-tinta">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => {
                const cat = p.category as { name: string } | null
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-miski-tinta">{cat?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-miski-tinta">{UNIT_LABEL[p.unit] ?? p.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <ToggleButton id={p.id} isActive={p.is_active} endpoint="products" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="text-miski-green hover:text-miski-forest font-medium"
                      >
                        Editar
                      </Link>
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

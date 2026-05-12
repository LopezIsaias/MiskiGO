import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ToggleButton } from '@/components/admin/toggle-button'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('product_categories')
    .select('*')
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
        <Link
          href="/admin/categories/new"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Nueva categoría
        </Link>
      </div>

      {!categories?.length ? (
        <p className="text-gray-500 text-sm">No hay categorías aún.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Costo op. %</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Margen %</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Merma %</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {(Number(cat.operational_cost_pct) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {(Number(cat.suggested_margin_pct) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {(Number(cat.estimated_waste_pct) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleButton id={cat.id} isActive={cat.is_active} endpoint="categories" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/categories/${cat.id}/edit`}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

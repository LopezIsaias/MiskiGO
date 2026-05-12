import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ count: catCount }, { count: prodCount }] = await Promise.all([
    supabase.from('product_categories').select('*', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Panel de administración Miski GO</p>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <StatCard title="Categorías" value={catCount ?? 0} href="/admin/categories" />
        <StatCard title="Productos" value={prodCount ?? 0} href="/admin/products" />
      </div>
    </div>
  )
}

function StatCard({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:border-green-300 transition-colors group"
    >
      <p className="text-sm text-gray-500 group-hover:text-green-600 transition-colors">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </Link>
  )
}

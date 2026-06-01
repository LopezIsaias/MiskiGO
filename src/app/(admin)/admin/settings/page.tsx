import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/admin/settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'superadmin') redirect('/admin')

  const [paramsRes, catsRes] = await Promise.all([
    supabase.from('system_params').select('key, value').order('key'),
    supabase
      .from('product_categories')
      .select('id, name, is_active, operational_cost_pct, suggested_margin_pct, estimated_waste_pct')
      .order('name'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-miski-forest mb-1">Parámetros del sistema</h1>
      <p className="text-sm text-miski-olive mb-6">
        Cambios en precios de categoría afectan los precios sugeridos de las próximas publicaciones.
        Los pedidos existentes conservan sus precios congelados.
      </p>
      <SettingsForm
        params={paramsRes.data ?? []}
        categories={catsRes.data ?? []}
      />
    </div>
  )
}

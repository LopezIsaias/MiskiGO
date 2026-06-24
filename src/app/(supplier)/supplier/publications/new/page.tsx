import { createClient } from '@/lib/supabase/server'
import { PublicationForm } from '@/components/supplier/publication-form'
import { getNextCutoffs } from '@/lib/utils/dispatch'

export default async function NewPublicationPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: regions }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:product_categories!category_id(name)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase.from('regions').select('*').eq('is_active', true).order('name'),
  ])

  const cutoffs = getNextCutoffs(4)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-6">Publicar disponibilidad</h1>
      <PublicationForm
        products={products ?? []}
        regions={regions ?? []}
        cutoffs={cutoffs}
      />
    </div>
  )
}

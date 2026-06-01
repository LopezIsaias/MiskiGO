import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PublicationForm } from '@/components/supplier/publication-form'
import { getNextCutoffs } from '@/lib/utils/dispatch'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPublicationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: publication } = await supabase
    .from('supplier_publications')
    .select(`
      *,
      product:products!product_id(id, name, unit, image_url, category:product_categories!category_id(name)),
      region:regions!region_id(id, name, city, department, country, is_active, created_at)
    `)
    .eq('id', id)
    .eq('supplier_id', user!.id)
    .maybeSingle()

  if (!publication) notFound()
  if (publication.status !== 'active') redirect('/supplier/publications')

  const cutoffs = getNextCutoffs(4)

  return (
    <div>
      <h1 className="text-2xl font-bold text-miski-forest mb-6">Editar publicación</h1>
      <PublicationForm
        products={[]}
        regions={[]}
        cutoffs={cutoffs}
        publication={publication as Parameters<typeof PublicationForm>[0]['publication']}
      />
    </div>
  )
}

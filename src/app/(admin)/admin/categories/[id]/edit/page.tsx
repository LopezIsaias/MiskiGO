import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CategoryForm } from '@/components/admin/category-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('product_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (!category) notFound()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-6">Editar categoría</h1>
      <CategoryForm category={category} />
    </div>
  )
}

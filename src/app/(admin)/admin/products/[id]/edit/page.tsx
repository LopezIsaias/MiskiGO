import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/admin/product-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase
      .from('product_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!product) notFound()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-miski-forest mb-6">Editar producto</h1>
      <ProductForm categories={categories ?? []} product={product} />
    </div>
  )
}

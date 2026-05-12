import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/admin/product-form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo producto</h1>
      <ProductForm categories={categories ?? []} />
    </div>
  )
}

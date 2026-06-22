import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getReservedByOthers } from '@/lib/utils/stock-reservations'
import { CatalogGrid, type CatalogProduct } from '@/components/customer/catalog-grid'

// Filas de la vista catalog_availability (mig 036): sin supplier_id ni minimum_price.
type CatalogRow = {
  product_id: string
  name: string
  unit: string
  image_url: string | null
  description: string | null
  category_name: string
  total_available: number
  sale_price: number
  nearest_cutoff: string
  region_id: string
}

function getDeliveryLabel(expiresAtIso: string): string {
  const delivery = new Date(new Date(expiresAtIso).getTime() + 24 * 60 * 60 * 1000)
  return `Entrega el ${new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(delivery)}`
}

function getCutoffBannerLabel(expiresAtIso: string): string {
  const cutoff = new Date(expiresAtIso)
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(cutoff)
}

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Región del cliente: la vista da una fila por (producto, región) del
  // ciclo abierto. Filtramos a la región del cliente para no duplicar.
  const { data: profile } = user
    ? await supabase.from('users').select('region_id').eq('id', user.id).maybeSingle()
    : { data: null }

  let query = supabase
    .from('catalog_availability')
    .select('product_id, name, unit, image_url, description, category_name, total_available, sale_price, nearest_cutoff, region_id')
  if (profile?.region_id) query = query.eq('region_id', profile.region_id)

  const { data: rawRows } = await query
  const rows = (rawRows ?? []) as CatalogRow[]

  // Descontar stock reservado por otros clientes (carritos en curso, no vencidos)
  const reservedByOthers = await getReservedByOthers(
    createAdminClient(),
    rows.map(r => r.product_id),
    user?.id,
  )

  const catalog: CatalogProduct[] = []
  for (const row of rows) {
    const effectiveQty = Math.round((row.total_available - (reservedByOthers.get(row.product_id) ?? 0)) * 1000) / 1000
    if (effectiveQty <= 0) continue
    catalog.push({
      id: row.product_id,
      name: row.name,
      unit: row.unit,
      imageUrl: row.image_url,
      description: row.description,
      categoryName: row.category_name,
      totalAvailable: effectiveQty,
      estimatedPrice: row.sale_price,
      nearestCutoff: row.nearest_cutoff,
      deliveryLabel: getDeliveryLabel(row.nearest_cutoff),
    })
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const nearestCutoff = catalog.length > 0
    ? catalog.reduce((min, p) => p.nearestCutoff < min ? p.nearestCutoff : min, catalog[0].nearestCutoff)
    : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-miski-forest">Catálogo</h1>
        <p className="text-sm text-miski-olive mt-1">
          Productos frescos disponibles para el próximo despacho.
        </p>
      </div>

      {nearestCutoff && (
        <div className="mb-6 bg-miski-gold-light/20 border border-miski-gold/40 rounded-xl px-4 py-3 text-sm text-amber-800">
          Cierre de pedidos: <span className="font-semibold">{getCutoffBannerLabel(nearestCutoff)}</span>
        </div>
      )}

      <CatalogGrid products={catalog} />
    </div>
  )
}

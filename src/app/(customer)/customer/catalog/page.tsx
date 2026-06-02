import { createClient } from '@/lib/supabase/server'
import { calculateSalePrice } from '@/lib/utils'
import { CatalogGrid, type CatalogProduct } from '@/components/customer/catalog-grid'

type RawPublication = {
  product_id: string
  available_quantity: number
  minimum_price: number
  expires_at: string
  product: {
    id: string
    name: string
    unit: string
    image_url: string | null
    description: string | null
    is_active: boolean
    deleted_at: string | null
    category: {
      name: string
      operational_cost_pct: number
      suggested_margin_pct: number
    } | null
  } | null
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

  const { data: rawPubs } = await supabase
    .from('supplier_publications')
    .select(`
      product_id,
      available_quantity,
      minimum_price,
      expires_at,
      product:products!product_id(
        id, name, unit, image_url, description, is_active, deleted_at,
        category:product_categories!category_id(
          name, operational_cost_pct, suggested_margin_pct
        )
      )
    `)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())

  const pubs = (rawPubs ?? []) as unknown as RawPublication[]

  type Aggregated = {
    product: NonNullable<RawPublication['product']>
    maxMinPrice: number
    totalQty: number
    nearestCutoff: string
  }

  const byProduct = new Map<string, Aggregated>()

  for (const pub of pubs) {
    if (!pub.product || !pub.product.is_active || pub.product.deleted_at || !pub.product.category) {
      continue
    }
    const existing = byProduct.get(pub.product_id)
    if (existing) {
      existing.totalQty += pub.available_quantity
      if (pub.minimum_price > existing.maxMinPrice) existing.maxMinPrice = pub.minimum_price
      if (pub.expires_at < existing.nearestCutoff) existing.nearestCutoff = pub.expires_at
    } else {
      byProduct.set(pub.product_id, {
        product: pub.product,
        maxMinPrice: pub.minimum_price,
        totalQty: pub.available_quantity,
        nearestCutoff: pub.expires_at,
      })
    }
  }

  const catalog: CatalogProduct[] = []
  for (const [, item] of byProduct) {
    if (item.totalQty <= 0) continue
    const { operational_cost_pct, suggested_margin_pct } = item.product.category!
    let estimatedPrice: number
    try {
      estimatedPrice = calculateSalePrice(item.maxMinPrice, operational_cost_pct, suggested_margin_pct)
    } catch {
      continue
    }
    catalog.push({
      id: item.product.id,
      name: item.product.name,
      unit: item.product.unit,
      imageUrl: item.product.image_url,
      description: item.product.description,
      categoryName: item.product.category!.name,
      totalAvailable: item.totalQty,
      estimatedPrice,
      nearestCutoff: item.nearestCutoff,
      deliveryLabel: getDeliveryLabel(item.nearestCutoff),
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

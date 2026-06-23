/**
 * Seed de EJEMPLO para probar el flujo demanda-primero end-to-end.
 * Uso: node --env-file=.env.local scripts/seed-example.mjs
 *
 * Crea: categoría + 2 productos demo, 2 proveedores demo, un ciclo ABIERTO
 * con ofertas (catálogo) y publicaciones on-behalf (sourcing listo para asignar).
 * Idempotente: re-correr no duplica.
 *
 * ⚠️  Es data DEMO. Apuntar a LOCAL (.env.local). NO usar en producción:
 *     en prod se siembran datos reales desde el panel del operador.
 */

import { createClient } from '@supabase/supabase-js'

// Acepta el env de la app (.env.local) o el de pruebas local (.env.test.local).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_TEST_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Falta URL/Service key (NEXT_PUBLIC_SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY o SUPABASE_TEST_*)')
  process.exit(1)
}
if (/supabase\.co/.test(url)) {
  console.error('⛔ URL parece de producción (supabase.co). Este seed es DEMO, solo para local. Abortando.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const PRODUCTS = [
  { name: 'Tomate (demo)', slug: 'tomate-demo', unit: 'kg', sale: 8.5, min: 5.0 },
  { name: 'Cebolla (demo)', slug: 'cebolla-demo', unit: 'kg', sale: 6.0, min: 3.5 },
]
const SUPPLIERS = [
  { email: 'proveedor.demo1@miskigo.com', name: 'Proveedor Demo 1' },
  { email: 'proveedor.demo2@miskigo.com', name: 'Proveedor Demo 2' },
]

async function main() {
  // 1. Región
  const { data: region } = await db.from('regions').select('id').eq('is_active', true).limit(1).maybeSingle()
  if (!region) { console.error('No hay región activa. Crea una primero.'); process.exit(1) }
  const regionId = region.id

  // 2. Categoría (reusa la primera activa o crea "Demo")
  let { data: cat } = await db.from('product_categories').select('id').eq('is_active', true).limit(1).maybeSingle()
  if (!cat) {
    const { data } = await db.from('product_categories')
      .insert({ name: 'Demo', slug: 'demo', operational_cost_pct: 0.2, suggested_margin_pct: 0.2, estimated_waste_pct: 0.05 })
      .select('id').single()
    cat = data
  }

  // 3. Productos (idempotente por slug)
  const productIds = {}
  for (const p of PRODUCTS) {
    let { data: prod } = await db.from('products').select('id').eq('slug', p.slug).maybeSingle()
    if (!prod) {
      const { data } = await db.from('products')
        .insert({ category_id: cat.id, name: p.name, slug: p.slug, unit: p.unit, is_active: true })
        .select('id').single()
      prod = data
    }
    productIds[p.slug] = prod.id
  }

  // 4. Proveedores (auth + trigger crea public.users)
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 })
  const supplierIds = []
  for (const s of SUPPLIERS) {
    let u = list.users.find(x => x.email === s.email)
    if (!u) {
      const { data, error } = await db.auth.admin.createUser({
        email: s.email, password: 'DemoProv2026!', email_confirm: true,
        user_metadata: { full_name: s.name, role: 'supplier' },
      })
      if (error) { console.error('Error creando proveedor:', error.message); process.exit(1) }
      u = data.user
    }
    await db.from('users').update({ region_id: regionId }).eq('id', u.id)
    supplierIds.push(u.id)
  }

  // 5. Ciclo ABIERTO (idempotente por region+dispatch_date)
  const dispatch = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() + 86400000).toISOString() // mañana, futuro
  let { data: cycle } = await db.from('dispatch_cycles')
    .select('id').eq('region_id', regionId).eq('dispatch_date', dispatch).maybeSingle()
  if (!cycle) {
    const { data } = await db.from('dispatch_cycles')
      .insert({ region_id: regionId, dispatch_date: dispatch, cutoff_at: cutoff, status: 'open' })
      .select('id').single()
    cycle = data
  }

  // 6. Ofertas (catálogo) — upsert por (ciclo, producto)
  for (const p of PRODUCTS) {
    await db.from('cycle_offerings').upsert(
      { dispatch_cycle_id: cycle.id, product_id: productIds[p.slug], expected_quantity: 100, sale_price: p.sale, status: 'active' },
      { onConflict: 'dispatch_cycle_id,product_id' },
    )
  }

  // 7. Publicaciones on-behalf (sourcing) — una por proveedor/producto si no existe
  for (const p of PRODUCTS) {
    for (const supId of supplierIds) {
      const { data: existing } = await db.from('supplier_publications')
        .select('id').eq('supplier_id', supId).eq('product_id', productIds[p.slug]).eq('status', 'active').maybeSingle()
      if (!existing) {
        await db.from('supplier_publications').insert({
          supplier_id: supId, product_id: productIds[p.slug], region_id: regionId,
          available_quantity: 60, minimum_price: p.min, expires_at: cutoff, status: 'active',
        })
      }
    }
  }

  console.log('✓ Seed demo listo.')
  console.log('  Región:     ', regionId)
  console.log('  Ciclo:      ', cycle.id, `(despacho ${dispatch}, abierto)`)
  console.log('  Productos:  ', Object.values(productIds).join(', '))
  console.log('  Proveedores:', supplierIds.join(', '))
  console.log('\nEl catálogo del cliente (región arriba) ya debe mostrar Tomate y Cebolla demo.')
  console.log('Sourcing listo: en "Asignar pedidos del ciclo" se asignará a las publicaciones demo.')
}

main().catch(e => { console.error(e); process.exit(1) })

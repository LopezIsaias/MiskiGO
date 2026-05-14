/**
 * Diagnóstico y corrección de pedidos con status=confirmed sin asignaciones ejecutadas.
 *
 * Identifica pedidos que se quedaron en 'confirmed' sin llegar a 'assigned' porque
 * fueron aprobados antes de que existiera la lógica de asignación automática.
 * Para cada uno, ejecuta la lógica equivalente a runSupplierAssignment.
 *
 * Uso: node --env-file=.env.local scripts/fix-unassigned-orders.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(DRY_RUN ? '\n🔍 MODO DRY-RUN — no se modificará nada en la BD\n' : '\n🔧 MODO FIX — se aplicarán cambios en la BD\n')

// ── 1. Obtener el superadmin para audit_log ──────────────────────────────────
const { data: superadmin } = await admin
  .from('users')
  .select('id')
  .eq('role', 'superadmin')
  .limit(1)
  .maybeSingle()

const scriptUserId = superadmin?.id ?? null

// ── 2. Obtener todos los pedidos en status=confirmed ─────────────────────────
const { data: confirmedOrders, error: ordersErr } = await admin
  .from('orders')
  .select('id, dispatch_cycle_id, total_amount, created_at')
  .eq('status', 'confirmed')

if (ordersErr) {
  console.error('Error al consultar pedidos:', ordersErr.message)
  process.exit(1)
}

if (!confirmedOrders || confirmedOrders.length === 0) {
  console.log('✓ No hay pedidos con status=confirmed pendientes de asignación.')
  process.exit(0)
}

console.log(`Pedidos con status=confirmed: ${confirmedOrders.length}`)

// ── 3. Obtener ciclos relevantes para conseguir cutoff_at ────────────────────
const cycleIds = [...new Set(confirmedOrders.map(o => o.dispatch_cycle_id).filter(Boolean))]
const { data: cycles } = await admin
  .from('dispatch_cycles')
  .select('id, cutoff_at, dispatch_date, status')
  .in('id', cycleIds)

const cycleMap = Object.fromEntries((cycles ?? []).map(c => [c.id, c]))

// ── 4. Identificar órdenes sin asignaciones confirmadas ──────────────────────
const ordersToFix = []

for (const order of confirmedOrders) {
  const { data: items } = await admin
    .from('order_items')
    .select('id, order_item_assignments(id, status)')
    .eq('order_id', order.id)

  const hasConfirmedAsgn = (items ?? []).some(item =>
    (item.order_item_assignments ?? []).some(a => a.status === 'confirmed')
  )

  if (!hasConfirmedAsgn) {
    const cycle = cycleMap[order.dispatch_cycle_id]
    ordersToFix.push({ ...order, cycle })
  }
}

if (ordersToFix.length === 0) {
  console.log('\n✓ Todos los pedidos confirmed ya tienen asignaciones ejecutadas. No hay nada que corregir.')
  process.exit(0)
}

console.log(`\nPedidos sin asignaciones confirmadas: ${ordersToFix.length}`)
console.log('─'.repeat(60))

for (const order of ordersToFix) {
  const cycle = order.cycle
  console.log(`\nPedido ${order.id.slice(0, 8).toUpperCase()}`)
  console.log(`  Ciclo: ${cycle?.dispatch_date ?? 'desconocido'} (${cycle?.status ?? '?'})`)
  console.log(`  Total: S/ ${order.total_amount}`)
  console.log(`  Creado: ${new Date(order.created_at).toLocaleString('es-PE')}`)

  if (!cycle?.cutoff_at) {
    console.log('  ⚠  Sin cutoff_at — saltando')
    continue
  }

  if (DRY_RUN) {
    // Diagnóstico más detallado en dry-run
    const { data: items } = await admin
      .from('order_items')
      .select(`
        id, quantity, unit_price_frozen, product_id,
        product:products!product_id(name, unit),
        order_item_assignments(id, status, assigned_quantity, supplier_id)
      `)
      .eq('order_id', order.id)

    for (const item of (items ?? [])) {
      const asgnSummary = (item.order_item_assignments ?? []).map(a => `${a.status}(${a.assigned_quantity})`).join(', ') || 'ninguna'
      console.log(`  • ${item.product?.name ?? item.product_id}: qty=${item.quantity} | asignaciones: [${asgnSummary}]`)
    }
    continue
  }

  // ── 5. Ejecutar lógica de asignación ──────────────────────────────────────
  const result = await assignOrder(order.id, cycle.cutoff_at)
  console.log(`  ${result.allAssigned ? '✓' : '⚠ '} allAssigned=${result.allAssigned} | ok=${result.assignedItems} | fallidos=${result.failedItems}`)

  // Audit log
  await admin.from('audit_log').insert({
    user_id: scriptUserId,
    role_at_time: 'superadmin',
    action: result.allAssigned ? 'supplier_assigned' : 'assignment_failed',
    module: 'orders',
    entity_type: 'order',
    entity_id: order.id,
    new_value: {
      source: 'fix-unassigned-orders-script',
      all_assigned: result.allAssigned,
      assigned_items: result.assignedItems,
      failed_items: result.failedItems,
    },
  })
}

console.log('\n─'.repeat(60))
console.log(DRY_RUN ? '\nDiagnóstico completo. Ejecuta sin --dry-run para aplicar cambios.' : '\nCorreción completa.')

// ── Función de asignación (equivalente a runSupplierAssignment) ──────────────
async function assignOrder(orderId, cutoffAt) {
  const now = new Date().toISOString()

  const { data: rawItems } = await admin
    .from('order_items')
    .select(`
      id, quantity, unit_price_frozen, product_id,
      order_item_assignments(
        id, publication_id, supplier_id,
        assigned_quantity, supplier_price_frozen, platform_margin_frozen, status
      )
    `)
    .eq('order_id', orderId)

  const orderItems = rawItems ?? []
  let allAssigned = true
  const failedItemIds = []

  for (const item of orderItems) {
    const pendingAsgs = (item.order_item_assignments ?? []).filter(a => a.status === 'pending')
    const coveredByProvisional = pendingAsgs.reduce(
      (s, a) => Math.round((s + a.assigned_quantity) * 1000) / 1000,
      0,
    )
    let remaining = Math.round((item.quantity - coveredByProvisional) * 1000) / 1000

    // PLAN phase — don't touch DB yet
    const extraPlans = []

    if (remaining > 0.001) {
      const { data: rawPubs } = await admin
        .from('supplier_publications')
        .select(`
          id, available_quantity, supplier_id, minimum_price, published_at,
          supplier:users!supplier_id(reputation_score)
        `)
        .eq('product_id', item.product_id)
        .eq('status', 'active')
        .gt('available_quantity', 0)
        .lte('published_at', cutoffAt)
        .order('minimum_price', { ascending: true })
        .order('published_at', { ascending: true })

      const activePubs = (rawPubs ?? []).sort((a, b) => {
        if (a.minimum_price !== b.minimum_price) return a.minimum_price - b.minimum_price
        if (a.published_at !== b.published_at) return a.published_at < b.published_at ? -1 : 1
        return (b.supplier?.reputation_score ?? 0) - (a.supplier?.reputation_score ?? 0)
      })

      const alreadyUsed = new Set(pendingAsgs.map(a => a.publication_id))

      for (const pub of activePubs) {
        if (remaining <= 0.001) break
        if (alreadyUsed.has(pub.id)) continue
        const deduct = Math.min(pub.available_quantity, remaining)
        remaining = Math.round((remaining - deduct) * 1000) / 1000
        extraPlans.push({
          publication_id: pub.id,
          supplier_id: pub.supplier_id,
          assigned_quantity: deduct,
          supplier_price_frozen: pub.minimum_price,
          platform_margin_frozen: Math.round((item.unit_price_frozen - pub.minimum_price) * 100) / 100,
          origAvailableQty: pub.available_quantity,
        })
      }
    }

    const fullyResolved = remaining <= 0.001

    if (!fullyResolved) {
      allAssigned = false
      failedItemIds.push(item.id)
      await admin.from('order_items').update({ status: 'failed' }).eq('id', item.id)
      if (pendingAsgs.length > 0) {
        await admin
          .from('order_item_assignments')
          .update({ status: 'failed', failure_reason: 'Stock insuficiente al corregir asignación' })
          .in('id', pendingAsgs.map(a => a.id))
      }
    } else {
      // APPLY phase
      for (const plan of extraPlans) {
        const newQty = Math.round((plan.origAvailableQty - plan.assigned_quantity) * 1000) / 1000
        if (newQty <= 0) {
          await admin.from('supplier_publications').update({ status: 'fulfilled' }).eq('id', plan.publication_id)
        } else {
          await admin.from('supplier_publications').update({ available_quantity: newQty }).eq('id', plan.publication_id)
        }
      }

      if (pendingAsgs.length > 0) {
        await admin
          .from('order_item_assignments')
          .update({ status: 'confirmed', confirmed_at: now })
          .in('id', pendingAsgs.map(a => a.id))
      }

      if (extraPlans.length > 0) {
        await admin.from('order_item_assignments').insert(
          extraPlans.map(p => ({
            order_item_id: item.id,
            publication_id: p.publication_id,
            supplier_id: p.supplier_id,
            assigned_quantity: p.assigned_quantity,
            supplier_price_frozen: p.supplier_price_frozen,
            platform_margin_frozen: p.platform_margin_frozen,
            status: 'confirmed',
            confirmed_at: now,
          }))
        )
      }

      await admin.from('order_items').update({ status: 'assigned' }).eq('id', item.id)
    }
  }

  if (allAssigned) {
    await admin.from('orders').update({ status: 'assigned' }).eq('id', orderId)
  }

  return {
    allAssigned,
    assignedItems: orderItems.length - failedItemIds.length,
    failedItems: failedItemIds.length,
  }
}

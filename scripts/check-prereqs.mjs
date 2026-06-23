/**
 * Verifica (solo lectura) los prerrequisitos para operar demanda-primero.
 * Uso: node --env-file=.env.local scripts/check-prereqs.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Falta URL/Service key'); process.exit(1) }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
console.log('Target:', url, '\n')

async function count(table, filter) {
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  return error ? `ERROR: ${error.message}` : count
}

const checks = {
  'regiones activas':        await count('regions', q => q.eq('is_active', true)),
  'categorías activas':      await count('product_categories', q => q.eq('is_active', true)),
  'productos activos':       await count('products', q => q.eq('is_active', true).is('deleted_at', null)),
  'superadmin':              await count('users', q => q.eq('role', 'superadmin').eq('status', 'active')),
  'operadores':              await count('users', q => q.eq('role', 'operator').eq('status', 'active')),
  'repartidores':            await count('users', q => q.eq('role', 'delivery').eq('status', 'active')),
  'proveedores':             await count('users', q => q.eq('role', 'supplier').eq('status', 'active')),
  'clientes':                await count('users', q => q.eq('role', 'customer').eq('status', 'active')),
  'ciclos abiertos':         await count('dispatch_cycles', q => q.eq('status', 'open')),
  'ofertas activas':         await count('cycle_offerings', q => q.eq('status', 'active')),
}

for (const [k, v] of Object.entries(checks)) {
  const ok = typeof v === 'number' && v > 0
  const warn = ['ciclos abiertos', 'ofertas activas', 'proveedores', 'clientes'].includes(k)
  const mark = ok ? '✓' : (warn ? '·' : '✗')
  console.log(`  ${mark} ${k.padEnd(22)} ${v}`)
}
console.log('\n✓=presente  ✗=FALTA (bloquea)  ·=opcional/operativo')

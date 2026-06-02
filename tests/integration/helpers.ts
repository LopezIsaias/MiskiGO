import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL          = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY  = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const ANON_KEY     = process.env.SUPABASE_TEST_ANON_KEY ?? ''

// Integración habilitada solo si hay credenciales (set en .env.test.local).
// Sin ellas, las suites se saltan — `npm test` y CI no se rompen.
export const INTEGRATION_ENABLED = Boolean(SERVICE_KEY && ANON_KEY)

// SEGURIDAD: jamás correr contra una base que no sea local.
// Evita borrar/insertar datos en producción por accidente.
function assertLocal(url: string): void {
  const isLocal = /(127\.0\.0\.1|localhost|::1)/.test(url)
  if (!isLocal && process.env.ALLOW_NONLOCAL_TESTS !== '1') {
    throw new Error(
      `[integration] URL no local (${url}). Estos tests escriben y borran datos. ` +
      `Apunta a Supabase local o exporta ALLOW_NONLOCAL_TESTS=1 si sabes lo que haces.`,
    )
  }
}

export function serviceClient(): SupabaseClient {
  assertLocal(URL)
  return createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function anonClient(): SupabaseClient {
  assertLocal(URL)
  return createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Verifica que la BD responda. Usado en beforeAll para fallar con mensaje claro.
export async function assertReachable(): Promise<void> {
  const svc = serviceClient()
  const { error } = await svc.from('regions').select('id').limit(1)
  if (error) {
    throw new Error(
      `[integration] No se pudo conectar a Supabase local (${URL}): ${error.message}. ` +
      `¿Corriste 'npx supabase start' y generaste .env.test.local?`,
    )
  }
}

// Devuelve el id de la primera región activa (sembrada en la migración 015).
export async function getSeedRegionId(svc: SupabaseClient): Promise<string> {
  const { data, error } = await svc.from('regions').select('id').eq('is_active', true).limit(1).single()
  if (error || !data) throw new Error(`[integration] No hay región sembrada: ${error?.message}`)
  return data.id as string
}

let counter = 0
function uniqueSuffix(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter}`
}

export interface TestUser {
  id: string
  email: string
  password: string
}

// Crea un usuario auth (+ perfil public.users vía trigger handle_new_auth_user).
export async function createTestUser(
  svc: SupabaseClient,
  opts: { role: string; regionId?: string; fullName?: string },
): Promise<TestUser> {
  const email = `it_${uniqueSuffix()}@miski.test`
  const password = 'TestPass123!'
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: opts.fullName ?? 'Usuario Prueba',
      role: opts.role,
      region_id: opts.regionId ?? '',
    },
  })
  if (error || !data.user) throw new Error(`[integration] createTestUser falló: ${error?.message}`)
  return { id: data.user.id, email, password }
}

// Cliente autenticado como el usuario dado (para probar RLS desde su perspectiva).
export async function signedInClient(user: TestUser): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw new Error(`[integration] signIn falló: ${error.message}`)
  return client
}

export async function deleteTestUser(svc: SupabaseClient, id: string): Promise<void> {
  await svc.auth.admin.deleteUser(id)
}

// Base de días aleatoria por proceso + contador → cada ciclo tiene una
// dispatch_date única (constraint UNIQUE(region_id, dispatch_date)), aun si
// la suite se re-ejecuta sin `db reset`.
const cycleDayBase = 5 + Math.floor(Math.random() * 3650)
let cycleDayCounter = 0

// Crea un ciclo de despacho mínimo para colgar pedidos.
export async function createCycle(svc: SupabaseClient, regionId: string): Promise<string> {
  cycleDayCounter += 1
  const offset = cycleDayBase + cycleDayCounter
  const dispatchDate = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() + (offset - 1) * 86_400_000).toISOString()
  const { data, error } = await svc
    .from('dispatch_cycles')
    .insert({ region_id: regionId, dispatch_date: dispatchDate, cutoff_at: cutoff, status: 'open' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[integration] createCycle falló: ${error?.message}`)
  return data.id as string
}

// Crea una categoría + producto en el catálogo maestro (vía service role).
// Devuelve el product_id, listo para colgar publicaciones.
export async function createProduct(svc: SupabaseClient): Promise<string> {
  const suffix = uniqueSuffix()
  const { data: cat, error: catErr } = await svc
    .from('product_categories')
    .insert({
      name: `Cat ${suffix}`, slug: `cat-${suffix}`,
      operational_cost_pct: 0.2, suggested_margin_pct: 0.2, estimated_waste_pct: 0.08,
    })
    .select('id')
    .single()
  if (catErr || !cat) throw new Error(`[integration] createProduct (categoría) falló: ${catErr?.message}`)

  const { data: prod, error: prodErr } = await svc
    .from('products')
    .insert({ category_id: cat.id, name: `Prod ${suffix}`, slug: `prod-${suffix}`, unit: 'kg' })
    .select('id')
    .single()
  if (prodErr || !prod) throw new Error(`[integration] createProduct falló: ${prodErr?.message}`)
  return prod.id as string
}

// Crea un pedido mínimo para el cliente dado.
export async function createOrder(
  svc: SupabaseClient,
  opts: { customerId: string; cycleId: string; regionId: string; status?: string },
): Promise<string> {
  const { data, error } = await svc
    .from('orders')
    .insert({
      customer_id: opts.customerId,
      dispatch_cycle_id: opts.cycleId,
      region_id: opts.regionId,
      status: opts.status ?? 'confirmed',
      subtotal: 100,
      total_amount: 100,
      delivery_address: 'Jr. Prueba 123, Tarapoto',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[integration] createOrder falló: ${error?.message}`)
  return data.id as string
}

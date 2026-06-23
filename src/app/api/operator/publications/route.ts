import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

type AdminClient = ReturnType<typeof createAdminClient>

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users').select('role, status, region_id').eq('id', user.id).maybeSingle()
  if (!['operator', 'superadmin'].includes(data?.role ?? '') || data?.status !== 'active') return null
  return { userId: user.id, role: data!.role, regionId: data!.region_id, admin: createAdminClient() }
}

async function cycleInScope(admin: AdminClient, cycleId: string, role: string, regionId: string | null) {
  const { data } = await admin.from('dispatch_cycles').select('region_id, cutoff_at').eq('id', cycleId).maybeSingle()
  if (!data) return null
  if (role !== 'superadmin' && data.region_id !== regionId) return null
  return data
}

const captureSchema = z.object({
  cycleId:       z.string().uuid(),
  supplierId:    z.string().uuid(),
  productId:     z.string().uuid(),
  quantity:      z.number().positive(),
  minimum_price: z.number().positive(),
})

// POST: captura oferta real de un proveedor EN SU NOMBRE (proveedor offline,
// brecha digital). Crea una supplier_publications atada al ciclo (expires_at =
// cutoff del ciclo). Es la fuente de SOURCING que luego asigna /cycle/[id]/assign.
export async function POST(request: Request) {
  const ctx = await requireStaff()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = captureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }
  const { cycleId, supplierId, productId, quantity, minimum_price } = parsed.data

  const cycle = await cycleInScope(ctx.admin, cycleId, ctx.role, ctx.regionId)
  if (!cycle) return NextResponse.json({ error: 'Ciclo no encontrado o fuera de tu región' }, { status: 403 })

  // Verifica que el usuario indicado sea proveedor activo
  const { data: supplier } = await ctx.admin
    .from('users').select('id, role, status').eq('id', supplierId).maybeSingle()
  if (supplier?.role !== 'supplier' || supplier?.status !== 'active') {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }

  const { data: pub, error } = await ctx.admin
    .from('supplier_publications')
    .insert({
      supplier_id: supplierId,
      product_id: productId,
      region_id: cycle.region_id,
      available_quantity: quantity,
      minimum_price,
      expires_at: cycle.cutoff_at,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !pub) return NextResponse.json({ error: error?.message ?? 'Error al capturar' }, { status: 500 })

  await ctx.admin.from('audit_log').insert({
    user_id: ctx.userId,
    role_at_time: ctx.role,
    action: AUDIT_ACTIONS.SUPPLIER_PUBLICATION_CAPTURED,
    module: AUDIT_MODULES.SUPPLIERS,
    region_id: cycle.region_id,
    entity_type: 'supplier_publication',
    entity_id: pub.id,
    new_value: { on_behalf_of: supplierId, product_id: productId, quantity, minimum_price, cycle_id: cycleId },
  })

  return NextResponse.json({ id: pub.id }, { status: 201 })
}

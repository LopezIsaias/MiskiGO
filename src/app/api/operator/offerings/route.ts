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
    .from('users')
    .select('role, status, region_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!['operator', 'superadmin'].includes(data?.role ?? '') || data?.status !== 'active') return null
  return { userId: user.id, role: data!.role, regionId: data!.region_id, admin: createAdminClient() }
}

// Operador acotado a su región: verifica que el ciclo pertenezca a su región.
async function cycleInScope(admin: AdminClient, cycleId: string, role: string, regionId: string | null): Promise<boolean> {
  if (role === 'superadmin') return true
  const { data } = await admin.from('dispatch_cycles').select('region_id').eq('id', cycleId).maybeSingle()
  return !!data && data.region_id === regionId
}

// GET ?cycleId= : ofertas del ciclo con info de producto.
export async function GET(request: Request) {
  const ctx = await requireStaff()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const cycleId = new URL(request.url).searchParams.get('cycleId')
  if (!cycleId) return NextResponse.json({ error: 'cycleId requerido' }, { status: 400 })
  if (!await cycleInScope(ctx.admin, cycleId, ctx.role, ctx.regionId)) {
    return NextResponse.json({ error: 'Ciclo fuera de tu región' }, { status: 403 })
  }

  const { data, error } = await ctx.admin
    .from('cycle_offerings')
    .select('id, product_id, expected_quantity, sale_price, status, product:products!product_id(name, unit)')
    .eq('dispatch_cycle_id', cycleId)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const upsertSchema = z.object({
  cycleId:           z.string().uuid(),
  productId:         z.string().uuid(),
  expected_quantity: z.number().positive(),
  sale_price:        z.number().positive(),
})

// POST: crea/actualiza la oferta de un producto en un ciclo (precio de venta §4).
export async function POST(request: Request) {
  const ctx = await requireStaff()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }
  const { cycleId, productId, expected_quantity, sale_price } = parsed.data

  if (!await cycleInScope(ctx.admin, cycleId, ctx.role, ctx.regionId)) {
    return NextResponse.json({ error: 'Ciclo fuera de tu región' }, { status: 403 })
  }

  const { data, error } = await ctx.admin
    .from('cycle_offerings')
    .upsert(
      {
        dispatch_cycle_id: cycleId,
        product_id: productId,
        expected_quantity,
        sale_price,
        status: 'active',
        created_by: ctx.userId,
      },
      { onConflict: 'dispatch_cycle_id,product_id' },
    )
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error al guardar' }, { status: 500 })

  await ctx.admin.from('audit_log').insert({
    user_id: ctx.userId,
    role_at_time: ctx.role,
    action: AUDIT_ACTIONS.CYCLE_OFFERING_UPSERTED,
    module: AUDIT_MODULES.PRODUCTS,
    entity_type: 'cycle_offering',
    entity_id: data.id,
    new_value: { cycle_id: cycleId, product_id: productId, expected_quantity, sale_price },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

// DELETE ?id= : retira la oferta (soft, status inactive).
export async function DELETE(request: Request) {
  const ctx = await requireStaff()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data: off } = await ctx.admin
    .from('cycle_offerings')
    .select('dispatch_cycle_id')
    .eq('id', id)
    .maybeSingle()
  if (!off) return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
  if (!await cycleInScope(ctx.admin, off.dispatch_cycle_id, ctx.role, ctx.regionId)) {
    return NextResponse.json({ error: 'Ciclo fuera de tu región' }, { status: 403 })
  }

  const { error } = await ctx.admin
    .from('cycle_offerings')
    .update({ status: 'inactive' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

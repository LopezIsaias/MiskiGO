import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { proposeSubstitution } from '@/lib/utils/substitution'

const bodySchema = z.object({
  orderItemId:         z.string().uuid(),
  substituteProductId: z.string().uuid(),
  publicationId:       z.string().uuid(),
  chargedUnitPrice:    z.number().positive(),
})

// POST: el operador/superadmin propone un producto alternativo para un order_item
// 'failed'. El cliente lo acepta/rechaza después. Ver lib/utils/substitution.ts.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })

  const admin = createAdminClient()

  // El ítem debe pertenecer al pedido de la ruta.
  const { data: item } = await admin
    .from('order_items')
    .select('order_id')
    .eq('id', parsed.data.orderItemId)
    .maybeSingle()
  if (!item || item.order_id !== orderId) {
    return NextResponse.json({ error: 'El ítem no pertenece a este pedido' }, { status: 400 })
  }

  const result = await proposeSubstitution(admin, {
    ...parsed.data,
    proposedBy:     user.id,
    proposedByRole: profile!.role,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })

  return NextResponse.json({ success: true, substitutionId: result.substitutionId })
}

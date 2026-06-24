import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptSubstitution, rejectSubstitution } from '@/lib/utils/substitution'

const bodySchema = z.object({
  substitutionId: z.string().uuid(),
  action:         z.enum(['accept', 'reject']),
})

// POST: el cliente acepta o rechaza una propuesta de sustitución de su pedido.
// La validación de propiedad (customer_id) se hace dentro de accept/reject.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const admin = createAdminClient()

  // La propuesta debe pertenecer al pedido de la ruta.
  const { data: sub } = await admin
    .from('order_item_substitutions')
    .select('order_id')
    .eq('id', parsed.data.substitutionId)
    .maybeSingle()
  if (!sub || sub.order_id !== orderId) {
    return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  }

  const result = parsed.data.action === 'accept'
    ? await acceptSubstitution(admin, parsed.data.substitutionId, user.id)
    : await rejectSubstitution(admin, parsed.data.substitutionId, user.id)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ success: true })
}

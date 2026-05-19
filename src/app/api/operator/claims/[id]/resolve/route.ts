import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.object({
  status:            z.enum(['approved', 'partially_approved', 'rejected']),
  is_justified:      z.boolean(),
  resolution_type:   z.enum(['wallet_credit', 'external_refund', 'reprogrammed']).nullable().optional(),
  resolution_amount: z.number().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.status !== 'rejected' && !data.resolution_type) {
    ctx.addIssue({ code: 'custom', path: ['resolution_type'], message: 'Tipo de resolución requerido' })
  }
  if (
    (data.resolution_type === 'wallet_credit' || data.resolution_type === 'external_refund') &&
    !data.resolution_amount
  ) {
    ctx.addIssue({ code: 'custom', path: ['resolution_amount'], message: 'Monto de resolución requerido' })
  }
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: claimId } = await params

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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  const { data: claim } = await adminClient
    .from('claims')
    .select('id, status, order_id, customer_id, product_id, claimed_quantity')
    .eq('id', claimId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!claim) {
    return NextResponse.json({ error: 'Reclamo no encontrado o ya resuelto' }, { status: 404 })
  }

  const { status, is_justified, resolution_type, resolution_amount } = parsed.data

  await adminClient
    .from('claims')
    .update({
      status,
      is_justified,
      resolution_type:   resolution_type ?? null,
      resolution_amount: resolution_amount ?? null,
      resolved_by:       user.id,
      resolved_at:       now,
    })
    .eq('id', claimId)

  // If wallet credit: create pending wallet_transaction for superadmin approval
  if (resolution_type === 'wallet_credit' && resolution_amount) {
    const { data: customer } = await adminClient
      .from('users')
      .select('wallet_balance')
      .eq('id', claim.customer_id)
      .maybeSingle()

    const balanceBefore = Number(customer?.wallet_balance ?? 0)

    await adminClient
      .from('wallet_transactions')
      .insert({
        user_id:            claim.customer_id,
        type:               'refund',
        amount:             resolution_amount,
        balance_before:     balanceBefore,
        balance_after:      balanceBefore + resolution_amount,
        reference_order_id: claim.order_id,
        status:             'pending',
        notes:              `Crédito por reclamo aprobado — ${claimId}`,
      })
  }

  await adminClient.from('audit_log').insert({
    user_id:      user.id,
    role_at_time: profile!.role,
    action:       AUDIT_ACTIONS.CLAIM_RESOLVED,
    module:       AUDIT_MODULES.CLAIMS,
    entity_type:  'claim',
    entity_id:    claimId,
    new_value: {
      status,
      is_justified,
      resolution_type:   resolution_type ?? null,
      resolution_amount: resolution_amount ?? null,
    },
  })

  return NextResponse.json({ success: true })
}

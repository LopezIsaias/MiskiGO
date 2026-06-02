import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().min(5) }),
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: txId } = await params

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
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local'

  const { data: tx } = await adminClient
    .from('wallet_transactions')
    .select('id, user_id, amount, type, status')
    .eq('id', txId)
    .eq('type', 'recharge')
    .eq('status', 'pending')
    .maybeSingle()

  if (!tx) return NextResponse.json({ error: 'Transacción no encontrada o ya procesada' }, { status: 404 })

  if (parsed.data.action === 'approve') {
    const { data: customer } = await adminClient
      .from('users')
      .select('wallet_balance')
      .eq('id', tx.user_id)
      .maybeSingle()

    const balanceBefore = Number(customer?.wallet_balance ?? 0)
    const balanceAfter  = balanceBefore + Number(tx.amount)

    const { error: balanceErr } = await adminClient
      .from('users')
      .update({ wallet_balance: balanceAfter, updated_at: now })
      .eq('id', tx.user_id)

    if (balanceErr) {
      console.error('[wallet/approve] balance update failed:', balanceErr)
      return NextResponse.json({ error: 'Error al actualizar el saldo' }, { status: 500 })
    }

    const { error: txErr } = await adminClient
      .from('wallet_transactions')
      .update({
        status:         'approved',
        approved_by:    user.id,
        approved_at:    now,
        balance_before: balanceBefore,
        balance_after:  balanceAfter,
      })
      .eq('id', txId)

    if (txErr) {
      console.error('[wallet/approve] transaction update failed:', txErr)
      // Rollback balance
      await adminClient
        .from('users')
        .update({ wallet_balance: balanceBefore, updated_at: now })
        .eq('id', tx.user_id)
      return NextResponse.json({ error: 'Error al aprobar la transacción' }, { status: 500 })
    }

    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.WALLET_RECHARGE_APPROVED,
      module:       AUDIT_MODULES.WALLET,
      entity_type:  'wallet_transaction',
      entity_id:    txId,
      ip_address:   ip,
      new_value:    { customer_id: tx.user_id, amount: tx.amount, balance_before: balanceBefore, balance_after: balanceAfter },
    })
  } else {
    const { error: rejectErr } = await adminClient
      .from('wallet_transactions')
      .update({
        status:      'rejected',
        approved_by: user.id,
        approved_at: now,
        notes:       parsed.data.reason,
      })
      .eq('id', txId)

    if (rejectErr) {
      console.error('[wallet/reject] transaction update failed:', rejectErr)
      return NextResponse.json({ error: 'Error al rechazar la transacción' }, { status: 500 })
    }

    await adminClient.from('audit_log').insert({
      user_id:      user.id,
      role_at_time: profile!.role,
      action:       AUDIT_ACTIONS.WALLET_RECHARGE_REJECTED,
      module:       AUDIT_MODULES.WALLET,
      entity_type:  'wallet_transaction',
      entity_id:    txId,
      ip_address:   ip,
      new_value:    { customer_id: tx.user_id, amount: tx.amount, reason: parsed.data.reason },
    })
  }

  return NextResponse.json({ success: true })
}

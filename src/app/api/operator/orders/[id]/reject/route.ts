import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const rejectSchema = z.object({
  reason: z.string().min(1, 'Se requiere un motivo'),
})

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
  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Motivo requerido' }, { status: 422 })
  const { reason } = parsed.data

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, customer_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (order.status !== 'payment_submitted') {
    return NextResponse.json({ error: 'El pedido no está pendiente de validación' }, { status: 400 })
  }

  // Reverse stock using order_item_assignments
  const { data: orderItemsData } = await adminClient
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)

  for (const oi of orderItemsData ?? []) {
    const { data: assignments } = await adminClient
      .from('order_item_assignments')
      .select('id, publication_id, assigned_quantity')
      .eq('order_item_id', oi.id)
      .eq('status', 'pending')

    for (const asg of assignments ?? []) {
      const { data: pub } = await adminClient
        .from('supplier_publications')
        .select('id, status, available_quantity')
        .eq('id', asg.publication_id)
        .maybeSingle()

      if (!pub) continue

      if (pub.status === 'fulfilled') {
        // Fully consumed by this order — restore to active (available_quantity is unchanged, still > 0)
        await adminClient
          .from('supplier_publications')
          .update({ status: 'active' })
          .eq('id', pub.id)
      } else if (pub.status === 'active') {
        // Partially consumed — add back the assigned quantity
        const restored = Math.round((pub.available_quantity + asg.assigned_quantity) * 1000) / 1000
        await adminClient
          .from('supplier_publications')
          .update({ available_quantity: restored })
          .eq('id', pub.id)
      }

      await adminClient
        .from('order_item_assignments')
        .update({ status: 'failed', failure_reason: `Pago rechazado: ${reason}` })
        .eq('id', asg.id)
    }
  }

  // Refund wallet if it was used
  const { data: walletTx } = await adminClient
    .from('wallet_transactions')
    .select('amount')
    .eq('reference_order_id', orderId)
    .eq('type', 'payment')
    .eq('status', 'approved')
    .maybeSingle()

  let walletRefunded = 0
  if (walletTx) {
    const { data: customer } = await adminClient
      .from('users')
      .select('wallet_balance')
      .eq('id', order.customer_id)
      .maybeSingle()

    const currentBalance = customer?.wallet_balance ?? 0
    const newBalance = Math.round((currentBalance + walletTx.amount) * 100) / 100
    walletRefunded = walletTx.amount

    await adminClient.from('wallet_transactions').insert({
      user_id: order.customer_id,
      type: 'refund',
      amount: walletTx.amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      reference_order_id: orderId,
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      notes: `Reembolso por rechazo — ${reason}`,
    })

    await adminClient
      .from('users')
      .update({ wallet_balance: newBalance })
      .eq('id', order.customer_id)

    await adminClient.from('audit_log').insert({
      user_id: user.id,
      role_at_time: profile!.role,
      action: AUDIT_ACTIONS.WALLET_BALANCE_UPDATED,
      module: AUDIT_MODULES.WALLET,
      entity_type: 'order',
      entity_id: orderId,
      previous_value: { wallet_balance: currentBalance },
      new_value: { wallet_balance: newBalance, refunded: walletTx.amount },
    })
  }

  await adminClient
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)

  await adminClient
    .from('payment_verifications')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('order_id', orderId)
    .eq('status', 'pending')

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.PAYMENT_REJECTED,
    module: AUDIT_MODULES.PAYMENTS,
    entity_type: 'order',
    entity_id: orderId,
    previous_value: { status: 'payment_submitted' },
    new_value: { status: 'cancelled', reason, wallet_refunded: walletRefunded },
    notes: reason,
  })

  return NextResponse.json({ success: true, walletRefunded })
}

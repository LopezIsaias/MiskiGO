import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

export async function POST(
  _request: Request,
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

  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (order.status !== 'payment_submitted') {
    return NextResponse.json({ error: 'El pedido no está pendiente de validación' }, { status: 400 })
  }

  // setting payment_approved_at triggers the lock_order_on_payment DB trigger automatically
  const { error: updateErr } = await adminClient
    .from('orders')
    .update({
      status: 'confirmed',
      payment_approved_at: new Date().toISOString(),
      payment_approved_by: user.id,
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[approve] order update failed:', updateErr.message)
    return NextResponse.json({ error: 'Error al aprobar el pedido' }, { status: 500 })
  }

  await adminClient
    .from('payment_verifications')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'pending')

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    role_at_time: profile!.role,
    action: AUDIT_ACTIONS.PAYMENT_APPROVED,
    module: AUDIT_MODULES.PAYMENTS,
    entity_type: 'order',
    entity_id: orderId,
    new_value: { status: 'confirmed', approved_by: user.id },
  })

  return NextResponse.json({ success: true })
}

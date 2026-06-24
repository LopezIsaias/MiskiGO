import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES, ORDER_STATUSES } from '@/lib/constants'
import { restorePublicationStock } from '@/lib/utils/stock'
import { expireStaleSubstitutions } from '@/lib/utils/substitution'

// Cron: marca como 'failed' los pedidos que siguen 'confirmed' pese a que su
// fecha de despacho ya pasó (nunca fueron asignados/entregados). Libera el
// stock reservado, registra en audit_log y notifica al cliente.
// Programado en vercel.json. Autorizado con CRON_SECRET.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (fecha de despacho)

  // ── Cierre de pedidos entregados cuya ventana de reclamo (2h) ya venció ──
  // delivered → completed (§4). Independiente de los ciclos vencidos.
  const nowIso = new Date().toISOString()
  const { data: completedRows } = await adminClient
    .from('orders')
    .update({ status: 'completed' })
    .eq('status', 'delivered')
    .lt('claim_window_expires_at', nowIso)
    .select('id')
  const completed = completedRows?.length ?? 0
  for (const o of completedRows ?? []) {
    await adminClient.from('audit_log').insert({
      user_id:      null,
      role_at_time: 'system',
      action:       AUDIT_ACTIONS.ORDER_COMPLETED,
      module:       AUDIT_MODULES.ORDERS,
      entity_type:  'order',
      entity_id:    o.id,
      previous_value: { status: 'delivered' },
      new_value:      { status: 'completed' },
      notes:        'Cerrado automáticamente: venció la ventana de reclamo',
    })
  }

  // Vencer propuestas de sustitución sin respuesta del cliente (cae al reembolso Fase 3).
  const { expired: substitutionsExpired } = await expireStaleSubstitutions(adminClient)

  // Ciclos cuya fecha de despacho ya pasó
  const { data: cycles } = await adminClient
    .from('dispatch_cycles')
    .select('id')
    .lt('dispatch_date', today)

  const cycleIds = (cycles ?? []).map((c: { id: string }) => c.id)
  if (cycleIds.length === 0) {
    return NextResponse.json({ success: true, expired: 0, completed, substitutionsExpired })
  }

  // Pedidos aún 'confirmed' en esos ciclos
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, status, customer_id')
    .eq('status', ORDER_STATUSES.CONFIRMED)
    .in('dispatch_cycle_id', cycleIds)

  const reason = 'Vencido: la fecha de despacho pasó sin que el pedido fuera asignado ni entregado'
  const now = new Date().toISOString()
  let expired = 0

  for (const order of orders ?? []) {
    // Liberar stock reservado (mismas reglas que la cancelación del operador)
    const { data: orderItemsData } = await adminClient
      .from('order_items')
      .select('id')
      .eq('order_id', order.id)

    for (const oi of orderItemsData ?? []) {
      const { data: assignments } = await adminClient
        .from('order_item_assignments')
        .select('id, publication_id, assigned_quantity, status')
        .eq('order_item_id', oi.id)
        .in('status', ['pending', 'confirmed'])

      for (const asg of assignments ?? []) {
        // Restauración atómica del stock (RPC con FOR UPDATE).
        await restorePublicationStock(adminClient, asg.publication_id, asg.assigned_quantity)

        await adminClient
          .from('order_item_assignments')
          .update({ status: 'failed', failure_reason: reason })
          .eq('id', asg.id)
      }
    }

    await adminClient
      .from('orders')
      .update({ status: ORDER_STATUSES.FAILED })
      .eq('id', order.id)

    await adminClient.from('audit_log').insert({
      user_id:        null,
      role_at_time:   'system',
      action:         AUDIT_ACTIONS.ORDER_AUTO_FAILED,
      module:         AUDIT_MODULES.ORDERS,
      entity_type:    'order',
      entity_id:      order.id,
      previous_value: { status: order.status },
      new_value:      { status: ORDER_STATUSES.FAILED },
      notes:          reason,
    })

    await adminClient.from('notifications').insert({
      recipient_id:   order.customer_id,
      type:           'order_failed',
      channel:        'in_app',
      title:          'Pedido no procesado',
      body:           `Tu pedido #${order.id.slice(0, 8).toUpperCase()} no pudo procesarse en su fecha de despacho. Si realizaste un pago, nos pondremos en contacto para tu reembolso.`,
      reference_type: 'order',
      reference_id:   order.id,
      status:         'sent',
      sent_at:        now,
    })

    expired++
  }

  return NextResponse.json({ success: true, expired, completed, substitutionsExpired })
}

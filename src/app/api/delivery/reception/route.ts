import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

const itemSchema = z.object({
  productId: z.string().uuid(),
  expectedQty: z.number().positive(),
  receivedQty: z.number().min(0),
  rejectedQty: z.number().min(0),
  rejectionReason: z.string().optional(),
})

const receptionSchema = z.object({
  cycleId: z.string().uuid(),
  supplierId: z.string().uuid(),
  photoUrl: z.string().url(),
  items: z.array(itemSchema).min(1),
}).superRefine((data, ctx) => {
  for (const item of data.items) {
    if (item.rejectedQty > item.receivedQty + 0.001) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Rechazado no puede superar recibido en producto ${item.productId}` })
    }
    if (item.receivedQty > item.expectedQty + 0.001) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Recibido no puede superar esperado en producto ${item.productId}` })
    }
    if (item.rejectedQty > 0.001 && !item.rejectionReason?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Motivo de rechazo requerido en producto ${item.productId}` })
    }
  }
})

type RawAffectedAssignment = {
  id: string
  assigned_quantity: number
  order_item: {
    id: string
    product_id: string
    quantity: number
    unit_price_frozen: number
    order: { id: string; dispatch_cycle_id: string; customer_id: string } | null
  } | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['delivery', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = receptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const { cycleId, supplierId, photoUrl, items } = parsed.data
  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  // Verify cycle exists and is active
  const { data: cycle } = await adminClient
    .from('dispatch_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .in('status', ['in_progress', 'closed'])
    .maybeSingle()

  if (!cycle) return NextResponse.json({ error: 'Ciclo no encontrado o no activo' }, { status: 404 })

  // Check for duplicates: reject if any product already has a reception record for this cycle
  const { data: existingRecords } = await adminClient
    .from('reception_records')
    .select('product_id')
    .eq('dispatch_cycle_id', cycleId)
    .eq('supplier_id', supplierId)
    .in('product_id', items.map(i => i.productId))

  if ((existingRecords ?? []).length > 0) {
    return NextResponse.json({ error: 'Uno o más productos ya tienen recepción registrada para este ciclo' }, { status: 409 })
  }

  for (const item of items) {
    const { productId, expectedQty, receivedQty, rejectedQty, rejectionReason } = item

    // goodQty = what was received in good condition
    const goodQty = Math.round((receivedQty - rejectedQty) * 1000) / 1000
    // shortfall = what customers won't get from this supplier for this product
    const shortfall = Math.round((expectedQty - goodQty) * 1000) / 1000

    // 1. Insert reception_record
    const { data: record } = await adminClient
      .from('reception_records')
      .insert({
        delivery_person_id: user.id,
        dispatch_cycle_id: cycleId,
        supplier_id: supplierId,
        product_id: productId,
        expected_quantity: expectedQty,
        received_quantity: receivedQty,
        rejected_quantity: rejectedQty,
        rejection_reason: rejectedQty > 0 ? (rejectionReason ?? null) : null,
        photo_url: photoUrl,
        recorded_at: now,
      })
      .select('id')
      .maybeSingle()

    // 2. Handle shortfall: update assignments and compensate customers
    if (shortfall > 0.001) {
      // Get all confirmed assignments from this supplier for this product in this cycle
      const { data: rawAffected } = await adminClient
        .from('order_item_assignments')
        .select(`
          id,
          assigned_quantity,
          order_item:order_items!order_item_id(
            id,
            product_id,
            quantity,
            unit_price_frozen,
            order:orders!order_id(id, dispatch_cycle_id, customer_id)
          )
        `)
        .eq('supplier_id', supplierId)
        .eq('status', 'confirmed')

      const affected = ((rawAffected ?? []) as unknown as RawAffectedAssignment[])
        .filter(a =>
          a.order_item?.product_id === productId &&
          a.order_item?.order?.dispatch_cycle_id === cycleId
        )

      const totalAssigned = affected.reduce((s, a) => s + a.assigned_quantity, 0)

      for (const asgn of affected) {
        if (!asgn.order_item?.order) continue

        const { id: orderItemId, unit_price_frozen, quantity: orderItemQty } = asgn.order_item
        const { id: orderId, customer_id: customerId } = asgn.order_item.order

        // Proportional shortfall for this assignment
        const asgnShortfall = totalAssigned > 0
          ? Math.round((asgn.assigned_quantity / totalAssigned) * shortfall * 1000) / 1000
          : 0

        if (asgnShortfall <= 0.001) continue

        const newAssignedQty = Math.max(0, Math.round((asgn.assigned_quantity - asgnShortfall) * 1000) / 1000)
        const isFailed = newAssignedQty <= 0.001

        // Update assignment
        await adminClient.from('order_item_assignments').update({
          assigned_quantity: isFailed ? asgn.assigned_quantity : newAssignedQty,
          status: isFailed ? 'failed' : 'confirmed',
          ...(isFailed ? { failure_reason: `Rechazado en recepción: ${rejectionReason ?? 'producto en mal estado'}` } : {}),
        }).eq('id', asgn.id)

        // Customer compensation = shortfall units × unit price
        const compensation = Math.round(asgnShortfall * unit_price_frozen * 100) / 100

        if (compensation > 0) {
          // Get customer's current wallet balance
          const { data: customerData } = await adminClient
            .from('users')
            .select('wallet_balance')
            .eq('id', customerId)
            .maybeSingle()

          const balanceBefore = customerData?.wallet_balance ?? 0
          const balanceAfter = Math.round((balanceBefore + compensation) * 100) / 100

          // Insert wallet_transaction
          await adminClient.from('wallet_transactions').insert({
            user_id: customerId,
            type: 'refund',
            amount: compensation,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference_order_id: orderId,
            status: 'approved',
            approved_by: user.id,
            approved_at: now,
            notes: `Compensación automática por rechazo de producto en recepción (${asgnShortfall} unidades)`,
          })

          // Update customer wallet_balance
          await adminClient.from('users').update({
            wallet_balance: balanceAfter,
          }).eq('id', customerId)

          await adminClient.from('audit_log').insert({
            user_id: user.id,
            role_at_time: profile!.role,
            action: AUDIT_ACTIONS.WALLET_BALANCE_UPDATED,
            module: AUDIT_MODULES.WALLET,
            entity_type: 'user',
            entity_id: customerId,
            new_value: {
              compensation,
              product_id: productId,
              order_id: orderId,
              shortfall_qty: asgnShortfall,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
            },
          })
        }

        // Check if order_item is still fully covered after deduction
        const { data: remainingAsgns } = await adminClient
          .from('order_item_assignments')
          .select('assigned_quantity, status')
          .eq('order_item_id', orderItemId)
          .eq('status', 'confirmed')

        const totalCovered = (remainingAsgns ?? []).reduce((s, a) => s + a.assigned_quantity, 0)

        if (totalCovered < orderItemQty - 0.001) {
          await adminClient
            .from('order_items')
            .update({ status: 'rejected' })
            .eq('id', orderItemId)
        }
      }

      // Audit for product rejection
      if (rejectedQty > 0.001) {
        await adminClient.from('audit_log').insert({
          user_id: user.id,
          role_at_time: profile!.role,
          action: AUDIT_ACTIONS.BAD_PRODUCT_REPORTED,
          module: AUDIT_MODULES.DELIVERIES,
          entity_type: 'reception_record',
          entity_id: record?.id ?? null,
          new_value: {
            supplier_id: supplierId,
            product_id: productId,
            expected_qty: expectedQty,
            received_qty: receivedQty,
            rejected_qty: rejectedQty,
            rejection_reason: rejectionReason ?? null,
          },
        })
      }
    }

    // Audit for every reception record
    await adminClient.from('audit_log').insert({
      user_id: user.id,
      role_at_time: profile!.role,
      action: AUDIT_ACTIONS.RECEPTION_RECORDED,
      module: AUDIT_MODULES.DELIVERIES,
      entity_type: 'reception_record',
      entity_id: record?.id ?? null,
      new_value: {
        cycle_id: cycleId,
        supplier_id: supplierId,
        product_id: productId,
        expected_qty: expectedQty,
        received_qty: receivedQty,
        rejected_qty: rejectedQty,
        shortfall,
      },
    })
  }

  return NextResponse.json({ success: true })
}

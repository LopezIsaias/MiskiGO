import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkoutSchema } from '@/lib/validations/customer'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { getReservedByOthers } from '@/lib/utils/stock-reservations'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('role, status, wallet_balance, region_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'customer' || profile?.status !== 'active') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Lectura de stock/precio de proveedor: server-only. El customer ya no
    // tiene acceso RLS a supplier_publications (mig 036) y minimum_price
    // nunca debe salir al navegador.
    const adminClient = createAdminClient()

    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      console.error('[orders POST] Zod validation failed:', JSON.stringify(parsed.error.flatten()))
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const {
      items, delivery_address, delivery_lat, delivery_lng, delivery_notes, customer_note,
      payment_method, use_wallet, proof_url,
      receipt_type, receipt_document, receipt_name,
    } = parsed.data

    // Resolve region (customer's region or first active region)
    let regionId = profile.region_id
    if (!regionId) {
      const { data: region } = await supabase
        .from('regions').select('id').eq('is_active', true).limit(1).maybeSingle()
      if (!region) return NextResponse.json({ error: 'No hay regiones activas' }, { status: 400 })
      regionId = region.id
    }

    // Demanda-primero: el catálogo y el precio salen de cycle_offerings del
    // ciclo ABIERTO de la región. El operador siembra las ofertas y define el
    // precio (§4). El ciclo ya existe (lo abre el operador); no se crea aquí.
    const { data: openCycle } = await adminClient
      .from('dispatch_cycles')
      .select('id, cutoff_at')
      .eq('region_id', regionId)
      .eq('status', 'open')
      .gt('cutoff_at', new Date().toISOString())
      .order('cutoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!openCycle) {
      return NextResponse.json({ error: 'No hay un ciclo de despacho abierto para tu región' }, { status: 400 })
    }
    const cycleId = openCycle.id

    const productIds = items.map(i => i.productId)
    const { data: rawOfferings } = await adminClient
      .from('cycle_offerings')
      .select('product_id, expected_quantity, sale_price')
      .eq('dispatch_cycle_id', cycleId)
      .eq('status', 'active')
      .in('product_id', productIds)

    const offeringByProduct = new Map<string, { expected: number; price: number }>()
    for (const o of rawOfferings ?? []) {
      offeringByProduct.set(o.product_id, { expected: Number(o.expected_quantity), price: Number(o.sale_price) })
    }

    // Reservas activas de otros clientes (excluye las propias, que se consumen en este pedido)
    const reservedByOthers = await getReservedByOthers(adminClient, productIds, user.id)

    // Validate stock contra la cantidad esperada de la oferta
    for (const item of items) {
      const off = offeringByProduct.get(item.productId)
      if (!off) return NextResponse.json({ error: `Producto no disponible` }, { status: 400 })
      const available = off.expected - (reservedByOthers.get(item.productId) ?? 0)
      if (item.quantity > Math.floor(available)) {
        return NextResponse.json({ error: `Stock insuficiente` }, { status: 400 })
      }
    }

    // Precios congelados = sale_price de la oferta
    type OrderItemPayload = {
      productId: string; quantity: number
      unitPriceFrozen: number; subtotalFrozen: number
    }
    const orderItems: OrderItemPayload[] = []
    let subtotal = 0

    for (const item of items) {
      const off = offeringByProduct.get(item.productId)!
      const price = off.price
      const itemSubtotal = Math.round(price * item.quantity * 100) / 100
      subtotal += itemSubtotal
      orderItems.push({ productId: item.productId, quantity: item.quantity, unitPriceFrozen: price, subtotalFrozen: itemSubtotal })
    }

    subtotal = Math.round(subtotal * 100) / 100
    const total = subtotal  // delivery_fee = 0 en MVP

    // Payment logic
    const walletBalance: number = profile.wallet_balance ?? 0
    let walletUsed = 0
    let remainder = total
    let orderStatus: string
    let effectiveProofUrl: string | null = null

    if (payment_method === 'wallet') {
      if (walletBalance < total) {
        return NextResponse.json({ error: 'Saldo de billetera insuficiente' }, { status: 400 })
      }
      walletUsed = total
      remainder = 0
      orderStatus = 'confirmed'
    } else {
      if (use_wallet && walletBalance > 0) {
        walletUsed = Math.round(Math.min(walletBalance, total) * 100) / 100
        remainder = Math.round((total - walletUsed) * 100) / 100
      }
      if (remainder > 0) {
        if (!proof_url) return NextResponse.json({ error: 'Se requiere comprobante de pago' }, { status: 400 })
        effectiveProofUrl = proof_url
        orderStatus = 'payment_submitted'
      } else {
        orderStatus = 'confirmed'
      }
    }

    // Generate 6-digit delivery confirmation code
    const confirmationCode = String(Math.floor(100000 + Math.random() * 900000))

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        dispatch_cycle_id: cycleId,
        region_id: regionId,
        status: orderStatus,
        subtotal,
        delivery_fee: 0,
        total_amount: total,
        payment_method,
        payment_proof_url: effectiveProofUrl,
        delivery_address,
        delivery_lat: delivery_lat ?? null,
        delivery_lng: delivery_lng ?? null,
        delivery_notes: delivery_notes ?? null,
        customer_note: customer_note ?? null,
        delivery_confirmation_code: confirmationCode as never,
        receipt_type,
        receipt_document,
        receipt_name,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('[orders POST] order insert failed:', orderErr?.message, orderErr?.code, orderErr?.details)
      return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
    }

    // Create order_items via adminClient to retrieve IDs for assignment tracking
    const { data: createdItems, error: itemsErr } = await adminClient
      .from('order_items')
      .insert(
        orderItems.map(i => ({
          order_id: order.id,
          product_id: i.productId,
          quantity: i.quantity,
          unit_price_frozen: i.unitPriceFrozen,
          subtotal_frozen: i.subtotalFrozen,
        }))
      )
      .select('id, product_id')

    if (itemsErr || !createdItems) {
      console.error('[orders POST] order_items insert failed:', itemsErr?.message, itemsErr?.code)
      await adminClient.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Error al registrar ítems del pedido' }, { status: 500 })
    }

    // Consumir las reservas propias de estos productos (ya se materializaron en el pedido)
    await adminClient
      .from('stock_reservations')
      .update({ status: 'consumed', updated_at: new Date().toISOString() })
      .eq('customer_id', user.id)
      .eq('status', 'active')
      .in('product_id', productIds)

    // Demanda-primero: NO se asigna proveedor en el checkout. Las publicaciones
    // (sourcing) pueden no existir aún; el operador captura la oferta real y la
    // asignación corre en Fase 2 (autoSourceOrderConfirmed: al aprobar pago o
    // desde "Captura de oferta"). Los order_items quedan en 'pending'.

    // Wallet debit (admin client bypasses RLS on wallet_transactions)
    if (walletUsed > 0) {
      const newBalance = Math.round((walletBalance - walletUsed) * 100) / 100
      const { error: txErr } = await adminClient.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'payment',
        amount: walletUsed,
        balance_before: walletBalance,
        balance_after: newBalance,
        reference_order_id: order.id,
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        notes: `Pago pedido ${order.id}`,
      })
      if (txErr) {
        console.error('[orders POST] wallet_transaction insert failed:', txErr.message)
        await adminClient.from('orders').delete().eq('id', order.id)
        return NextResponse.json({ error: 'Error al procesar pago de billetera' }, { status: 500 })
      }
      await adminClient.from('users').update({ wallet_balance: newBalance }).eq('id', user.id)
      await adminClient.from('audit_log').insert({
        user_id: user.id,
        role_at_time: 'customer',
        action: AUDIT_ACTIONS.WALLET_BALANCE_UPDATED,
        module: AUDIT_MODULES.WALLET,
        entity_type: 'order',
        entity_id: order.id,
        previous_value: { wallet_balance: walletBalance },
        new_value: { wallet_balance: newBalance, deducted: walletUsed },
      })
    }

    // Payment verification record (for comprobante)
    if (effectiveProofUrl && remainder > 0) {
      const { error: pvErr } = await supabase.from('payment_verifications').insert({
        order_id: order.id,
        method: payment_method as 'yape' | 'transfer',
        amount: remainder,
        proof_url: effectiveProofUrl,
      })
      if (pvErr) console.error('[orders POST] payment_verifications insert failed:', pvErr.message, pvErr.code)
    }

    return NextResponse.json({ orderId: order.id, status: orderStatus, walletUsed, remainder }, { status: 201 })
  } catch (err) {
    console.error('[orders POST] Unhandled exception:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkoutSchema } from '@/lib/validations/customer'
import { calculateSalePrice } from '@/lib/utils'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

type PubRow = {
  product_id: string
  available_quantity: number
  minimum_price: number
  expires_at: string
  product: {
    category: { operational_cost_pct: number; suggested_margin_pct: number } | null
  } | null
}

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
      items, delivery_address, delivery_notes, customer_note,
      payment_method, use_wallet, proof_url,
    } = parsed.data

    // Resolve region (customer's region or first active region)
    let regionId = profile.region_id
    if (!regionId) {
      const { data: region } = await supabase
        .from('regions').select('id').eq('is_active', true).limit(1).maybeSingle()
      if (!region) return NextResponse.json({ error: 'No hay regiones activas' }, { status: 400 })
      regionId = region.id
    }

    // Validate stock and collect pricing data
    const productIds = items.map(i => i.productId)
    const { data: rawPubs } = await supabase
      .from('supplier_publications')
      .select(`
        product_id, available_quantity, minimum_price, expires_at,
        product:products!product_id(
          category:product_categories!category_id(operational_cost_pct, suggested_margin_pct)
        )
      `)
      .in('product_id', productIds)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())

    const pubs = (rawPubs ?? []) as unknown as PubRow[]

    type ProductAgg = {
      totalAvailable: number
      maxMinPrice: number
      nearestCutoff: string
      opCostPct: number
      marginPct: number
    }
    const byProduct = new Map<string, ProductAgg>()

    for (const pub of pubs) {
      if (!pub.product?.category) continue
      const existing = byProduct.get(pub.product_id)
      if (existing) {
        existing.totalAvailable += pub.available_quantity
        if (pub.minimum_price > existing.maxMinPrice) existing.maxMinPrice = pub.minimum_price
        if (pub.expires_at < existing.nearestCutoff) existing.nearestCutoff = pub.expires_at
      } else {
        byProduct.set(pub.product_id, {
          totalAvailable: pub.available_quantity,
          maxMinPrice: pub.minimum_price,
          nearestCutoff: pub.expires_at,
          opCostPct: pub.product.category.operational_cost_pct,
          marginPct: pub.product.category.suggested_margin_pct,
        })
      }
    }

    for (const item of items) {
      const agg = byProduct.get(item.productId)
      if (!agg) return NextResponse.json({ error: `Producto no disponible` }, { status: 400 })
      if (item.quantity > Math.floor(agg.totalAvailable)) {
        return NextResponse.json({ error: `Stock insuficiente` }, { status: 400 })
      }
    }

    // Calculate frozen prices
    type OrderItemPayload = {
      productId: string; quantity: number
      unitPriceFrozen: number; subtotalFrozen: number
    }
    const orderItems: OrderItemPayload[] = []
    let subtotal = 0
    let minCutoff = ''

    for (const item of items) {
      const agg = byProduct.get(item.productId)!
      let price: number
      try { price = calculateSalePrice(agg.maxMinPrice, agg.opCostPct, agg.marginPct) }
      catch (e) {
        console.error('[orders POST] calculateSalePrice failed:', e)
        return NextResponse.json({ error: 'Error al calcular precios' }, { status: 500 })
      }
      const itemSubtotal = Math.round(price * item.quantity * 100) / 100
      subtotal += itemSubtotal
      orderItems.push({ productId: item.productId, quantity: item.quantity, unitPriceFrozen: price, subtotalFrozen: itemSubtotal })
      if (!minCutoff || agg.nearestCutoff < minCutoff) minCutoff = agg.nearestCutoff
    }

    subtotal = Math.round(subtotal * 100) / 100
    const total = subtotal  // delivery_fee = 0 en MVP

    // Get or create dispatch cycle
    const adminClient = createAdminClient()
    const dispatchDate = new Date(new Date(minCutoff).getTime() + 24 * 60 * 60 * 1000)
    const dispatchDateStr = dispatchDate.toISOString().split('T')[0]

    const { data: existingCycle } = await adminClient
      .from('dispatch_cycles')
      .select('id')
      .eq('region_id', regionId)
      .eq('dispatch_date', dispatchDateStr)
      .maybeSingle()

    let cycleId: string
    if (existingCycle) {
      cycleId = existingCycle.id
    } else {
      const { data: newCycle, error: cycleErr } = await adminClient
        .from('dispatch_cycles')
        .insert({ region_id: regionId, dispatch_date: dispatchDateStr, cutoff_at: minCutoff, status: 'open' })
        .select('id')
        .single()
      if (cycleErr || !newCycle) {
        console.error('[orders POST] dispatch_cycle insert failed:', cycleErr?.message)
        return NextResponse.json({ error: 'Error al crear ciclo de despacho' }, { status: 500 })
      }
      cycleId = newCycle.id
    }

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
        delivery_notes: delivery_notes ?? null,
        customer_note: customer_note ?? null,
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

    // Map product_id → order_item_id for assignment creation
    const itemIdByProduct = new Map<string, string>()
    for (const ci of createdItems) itemIdByProduct.set(ci.product_id, ci.id)

    // Decrement stock and create provisional order_item_assignments (greedy, cheapest first)
    type StockPub = { id: string; available_quantity: number; supplier_id: string; minimum_price: number }
    for (const item of orderItems) {
      const orderItemId = itemIdByProduct.get(item.productId)
      if (!orderItemId) continue

      const { data: stockPubs } = await adminClient
        .from('supplier_publications')
        .select('id, available_quantity, supplier_id, minimum_price')
        .eq('product_id', item.productId)
        .eq('status', 'active')
        .gt('available_quantity', 0)
        .order('minimum_price', { ascending: true })
        .order('published_at', { ascending: true })

      const assignments: {
        order_item_id: string; publication_id: string; supplier_id: string
        assigned_quantity: number; supplier_price_frozen: number; platform_margin_frozen: number
      }[] = []

      let remaining = item.quantity
      for (const pub of (stockPubs ?? []) as StockPub[]) {
        if (remaining <= 0) break
        const deduct = Math.min(pub.available_quantity, remaining)
        remaining = Math.round((remaining - deduct) * 1000) / 1000
        const newQty = Math.round((pub.available_quantity - deduct) * 1000) / 1000

        assignments.push({
          order_item_id: orderItemId,
          publication_id: pub.id,
          supplier_id: pub.supplier_id,
          assigned_quantity: deduct,
          supplier_price_frozen: pub.minimum_price,
          platform_margin_frozen: Math.round((item.unitPriceFrozen - pub.minimum_price) * 100) / 100,
        })

        if (newQty <= 0) {
          await adminClient
            .from('supplier_publications')
            .update({ status: 'fulfilled' })
            .eq('id', pub.id)
        } else {
          await adminClient
            .from('supplier_publications')
            .update({ available_quantity: newQty })
            .eq('id', pub.id)
        }
      }

      if (assignments.length > 0) {
        await adminClient.from('order_item_assignments').insert(assignments)
      }
    }

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

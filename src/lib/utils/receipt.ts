import { createAdminClient } from '@/lib/supabase/admin'

const SERIES: Record<string, string> = {
  boleta:  'B001',
  factura: 'F001',
}

// Serie del comprobante según tipo. 'X001' como fallback defensivo.
export function seriesForReceiptType(type: string): string {
  return SERIES[type] ?? 'X001'
}

// Número formateado: SERIE-00000123 (correlativo a 8 dígitos).
export function formatReceiptNumber(series: string, correlative: number): string {
  return `${series}-${String(correlative).padStart(8, '0')}`
}

export interface EmitReceiptResult {
  emitted: boolean
  number?: string
  reason?: string
}

/**
 * Emits the fiscal receipt (boleta/factura) for an order. Idempotent: if a receipt
 * already exists for the order, it is not re-emitted. Designed to run when delivery
 * is completed. Numbering is atomic per series via next_receipt_correlative.
 *
 * MVP: internal numbered receipt, no IGV breakdown, no SUNAT submission.
 */
export async function emitReceiptForOrder(orderId: string): Promise<EmitReceiptResult> {
  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('id, customer_id, subtotal, total_amount, receipt_type, receipt_document, receipt_name')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { emitted: false, reason: 'order_not_found' }
  if (!order.receipt_type || !order.receipt_document || !order.receipt_name) {
    return { emitted: false, reason: 'missing_receipt_data' }
  }

  // Idempotency: skip if already emitted
  const { data: existing } = await adminClient
    .from('receipts')
    .select('number')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existing) return { emitted: false, number: existing.number, reason: 'already_emitted' }

  const series = seriesForReceiptType(order.receipt_type)

  const { data: correlative, error: rpcErr } = await adminClient
    .rpc('next_receipt_correlative', { p_series: series })

  if (rpcErr || correlative == null) {
    console.error('[emitReceipt] correlative RPC failed:', rpcErr)
    return { emitted: false, reason: 'numbering_failed' }
  }

  const number = formatReceiptNumber(series, correlative)

  const { error: insertErr } = await adminClient.from('receipts').insert({
    order_id:      orderId,
    customer_id:   order.customer_id,
    type:          order.receipt_type,
    series,
    correlative,
    number,
    document:      order.receipt_document,
    customer_name: order.receipt_name,
    subtotal:      order.subtotal,
    total:         order.total_amount,
  })

  if (insertErr) {
    console.error('[emitReceipt] insert failed:', insertErr)
    return { emitted: false, reason: 'insert_failed' }
  }

  return { emitted: true, number }
}

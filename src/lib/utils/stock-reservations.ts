import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Admin = SupabaseClient<Database>

/**
 * Suma de reservas ACTIVAS y NO vencidas por producto, excluyendo opcionalmente
 * a un cliente (para no descontarle su propia reserva). Devuelve un Map
 * product_id → cantidad reservada por otros.
 */
export async function getReservedByOthers(
  admin: Admin,
  productIds: string[],
  excludeCustomerId?: string,
): Promise<Map<string, number>> {
  const reserved = new Map<string, number>()
  if (productIds.length === 0) return reserved

  let query = admin
    .from('stock_reservations')
    .select('product_id, quantity, customer_id')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .in('product_id', productIds)

  if (excludeCustomerId) {
    query = query.neq('customer_id', excludeCustomerId)
  }

  const { data } = await query
  for (const row of (data ?? []) as { product_id: string; quantity: number }[]) {
    reserved.set(row.product_id, Math.round(((reserved.get(row.product_id) ?? 0) + row.quantity) * 1000) / 1000)
  }
  return reserved
}

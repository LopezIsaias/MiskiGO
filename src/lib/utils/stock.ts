import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClientLike = ReturnType<typeof createAdminClient>

/**
 * Descuenta hasta `qty` del stock de una publicación de forma ATÓMICA (RPC con
 * SELECT ... FOR UPDATE en Postgres). Devuelve la cantidad realmente descontada
 * (0 si no había stock o la publicación no está activa). Previene la sobreventa
 * en checkouts/asignaciones concurrentes — ver migración 034.
 *
 * IMPORTANTE: usar SIEMPRE el valor devuelto como `assigned_quantity`; puede ser
 * menor a `qty` si otro proceso consumió stock en paralelo.
 */
export async function decrementPublicationStock(
  admin: AdminClientLike,
  pubId: string,
  qty: number,
): Promise<number> {
  const { data, error } = await admin.rpc('decrement_publication_stock', { p_pub_id: pubId, p_qty: qty })
  if (error) {
    console.error('[stock] decrement_publication_stock falló:', error.message)
    return 0
  }
  return Number(data ?? 0)
}

/**
 * Restaura `qty` al stock de una publicación de forma atómica y la reactiva si
 * estaba 'fulfilled' (al rechazar pago / cancelar pedido). Ver migración 034.
 */
export async function restorePublicationStock(
  admin: AdminClientLike,
  pubId: string,
  qty: number,
): Promise<number> {
  const { data, error } = await admin.rpc('restore_publication_stock', { p_pub_id: pubId, p_qty: qty })
  if (error) {
    console.error('[stock] restore_publication_stock falló:', error.message)
    return 0
  }
  return Number(data ?? 0)
}

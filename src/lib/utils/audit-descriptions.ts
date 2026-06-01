import type { AuditRow } from '@/components/admin/audit-table'

function s(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : ''
}

function shortId(v: unknown): string {
  const str = s(v)
  return str.length >= 8 ? str.slice(0, 8).toUpperCase() : str.toUpperCase()
}

function money(v: unknown): string {
  const n = Number(v)
  return isNaN(n) ? '' : `S/${n.toFixed(2)}`
}

export function describeAuditAction(row: AuditRow): string {
  const nv = row.new_value ?? {}
  const pv = row.previous_value ?? {}

  switch (row.action) {
    case 'payment_approved':
      return `Se aprobó el pago ${nv.amount ? money(nv.amount) + ' ' : ''}del pedido #${shortId(nv.order_id ?? row.entity_id)}`

    case 'payment_rejected':
      return `Se rechazó el comprobante de pago del pedido #${shortId(nv.order_id ?? row.entity_id)}`

    case 'wallet_balance_updated':
      return `Billetera actualizada: ${money(pv.balance_before ?? nv.balance_before)} → ${money(nv.balance_after)}`

    case 'credit_proposed':
      return `Se propuso crédito de ${money(nv.amount)} para usuario`

    case 'credit_approved':
      return `Se aprobó crédito de ${money(nv.amount)}`

    case 'account_suspended':
      return `Cuenta suspendida${nv.full_name ? ': ' + s(nv.full_name) : ''}`

    case 'account_reactivated':
      return `Cuenta reactivada${nv.full_name ? ': ' + s(nv.full_name) : ''}`

    case 'price_modified':
      return `Precio modificado${nv.product_name ? ' — ' + s(nv.product_name) : ''}: ${money(pv.price ?? nv.old_price)} → ${money(nv.price ?? nv.new_price)}`

    case 'supplier_manually_assigned':
      return `Asignación manual de proveedor en pedido #${shortId(nv.order_id ?? row.entity_id)}`

    case 'reputation_exception':
      return `Excepción de reputación registrada${nv.reason ? ': ' + s(nv.reason) : ''}`

    case 'claim_window_reopened':
      return `Plazo de reclamo reabierto para pedido #${shortId(nv.order_id ?? row.entity_id)}`

    case 'role_assigned':
      return `Rol asignado: ${s(nv.role)}`

    case 'supplier_payment_recorded':
      return `Pago al proveedor registrado ${nv.amount ? money(nv.amount) : ''}`

    case 'bad_product_reported':
      return `Producto en mal estado reportado — rechazados: ${s(nv.rejected_qty ?? '')} ${s(nv.unit ?? '')}`

    case 'role_converted':
      return `Rol convertido: ${s(pv.role ?? nv.old_role)} → ${s(nv.role ?? nv.new_role)}`

    case 'order_cancelled_post_payment':
      return `Pedido #${shortId(nv.order_id ?? row.entity_id)} cancelado por superadmin post-pago`

    case 'user_created':
      return `Usuario creado: ${s(nv.full_name ?? nv.email)}`

    case 'password_reset':
      return `Contraseña restablecida`

    case 'supplier_assigned':
      return `Proveedores asignados — pedido #${shortId(nv.entity_id ?? row.entity_id)}: ${s(nv.assigned_items ?? '')} ítem(s) cubierto(s)`

    case 'assignment_failed':
      return `Asignación fallida: ${s(nv.reason ?? 'sin stock suficiente')}${nv.remaining_qty ? ` (${s(nv.remaining_qty)} sin cubrir)` : ''}`

    case 'reception_recorded':
      return `Recepción registrada — recibidos ${s(nv.received_qty ?? '')} / esperados ${s(nv.expected_qty ?? '')}${Number(nv.rejected_qty) > 0 ? `, rechazados ${s(nv.rejected_qty)}` : ''}`

    case 'dispatch_cycle_status_changed':
      return `Ciclo de despacho cambió de "${s(pv.status ?? nv.old_status)}" a "${s(nv.status)}"`

    case 'order_delivered':
      return `Pedido #${shortId(nv.order_id ?? row.entity_id)} marcado como entregado`

    case 'delivery_incident':
      return `Incidencia de entrega reportada — intento #${s(nv.attempt ?? '')}`

    case 'claim_resolved': {
      const verdict = nv.status === 'approved' ? 'aprobado' : nv.status === 'rejected' ? 'rechazado' : 'aprobado parcialmente'
      const resType = s(nv.resolution_type ?? '')
      const resLabel = resType === 'wallet_credit' ? 'crédito en billetera' : resType === 'external_refund' ? 'reembolso externo' : resType === 'reprogrammed' ? 'reprogramado' : ''
      return `Reclamo ${verdict}${resLabel ? ' — ' + resLabel : ''}${nv.resolution_amount ? ': ' + money(nv.resolution_amount) : ''}`
    }

    case 'wallet_recharge_approved':
      return `Recarga de billetera aprobada: ${money(nv.amount)}`

    case 'wallet_recharge_rejected':
      return `Recarga de billetera rechazada${nv.reason ? ': ' + s(nv.reason) : ''}`

    case 'wallet_credit_approved':
      return `Crédito en billetera aprobado: ${money(nv.amount)}`

    case 'wallet_credit_rejected':
      return `Crédito en billetera rechazado`

    case 'system_params_updated':
      return `Parámetros del sistema actualizados`

    case 'category_updated':
      return `Categoría actualizada${nv.name ? ': ' + s(nv.name) : ''}`

    case 'order_in_storage':
      return `Pedido #${shortId(nv.order_id ?? row.entity_id)} enviado a almacén (2do intento fallido)`

    case 'supplier_confirmed':
      return `Proveedor confirmó su asignación — ítem #${shortId(nv.order_item_id ?? row.entity_id)}`

    case 'supplier_rejected':
      return `Proveedor rechazó su asignación: "${s(nv.reason)}"${nv.replaced ? ' — reemplazo encontrado' : ' — sin reemplazo'}`

    case 'delivery_code_failed':
      return `Código de confirmación de entrega incorrecto`

    default:
      return row.action.replace(/_/g, ' ')
  }
}

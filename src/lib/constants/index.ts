export const USER_ROLES = {
  SUPERADMIN: 'superadmin',
  REGION_OPERATOR: 'region_operator',
  OPERATOR: 'operator',
  DELIVERY: 'delivery',
  SUPPLIER: 'supplier',
  CUSTOMER: 'customer',
} as const

export const ORDER_STATUSES = {
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_SUBMITTED: 'payment_submitted',
  CONFIRMED: 'confirmed',
  ASSIGNED: 'assigned',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  IN_STORAGE: 'in_storage',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const

export const PAYMENT_METHODS = {
  YAPE: 'yape',
  TRANSFER: 'transfer',
  WALLET: 'wallet',
} as const

export const PRODUCT_UNITS = {
  KG: 'kg',
  UNIT: 'unit',
  LITER: 'liter',
  BUNCH: 'bunch',
} as const

// JS day-of-week values (0=Sunday)
export const DISPATCH_DAY_TUESDAY = 2
export const DISPATCH_DAY_FRIDAY = 5

export const CLAIM_WINDOW_HOURS = 2
export const CUTOFF_HOUR = 12  // mediodía hora Lima

// Vigencia de una reserva de stock al agregar al carrito (minutos)
export const RESERVATION_TTL_MINUTES = 30

// Transiciones permitidas del ciclo de despacho: open → closed → in_progress → completed
export const CYCLE_TRANSITIONS: Record<string, string> = {
  open:        'closed',
  closed:      'in_progress',
  in_progress: 'completed',
}

// Devuelve el siguiente estado válido del ciclo, o null si es terminal/desconocido.
export function nextCycleStatus(current: string): string | null {
  return CYCLE_TRANSITIONS[current] ?? null
}

// Parámetros operativos por categoría (CLAUDE.md sección 4)
export const CATEGORY_PARAMS = {
  fragile:  { minOpCost: 0.30, maxOpCost: 0.35, minMargin: 0.20, maxMargin: 0.25, minWaste: 0.12, maxWaste: 0.18 },
  standard: { minOpCost: 0.20, maxOpCost: 0.25, minMargin: 0.18, maxMargin: 0.22, minWaste: 0.06, maxWaste: 0.10 },
  robust:   { minOpCost: 0.15, maxOpCost: 0.18, minMargin: 0.15, maxMargin: 0.20, minWaste: 0.03, maxWaste: 0.06 },
} as const

// Dashboard de destino según rol
export const ROLE_DASHBOARD: Record<string, string> = {
  superadmin:      '/admin',
  region_operator: '/admin',
  operator:        '/operator',
  delivery:        '/delivery',
  supplier:        '/supplier',
  customer:        '/customer',
}

// Acciones de audit_log estandarizadas (CLAUDE.md sección 8)
export const AUDIT_ACTIONS = {
  PAYMENT_APPROVED:           'payment_approved',
  PAYMENT_REJECTED:           'payment_rejected',
  WALLET_BALANCE_UPDATED:     'wallet_balance_updated',
  CREDIT_PROPOSED:            'credit_proposed',
  CREDIT_APPROVED:            'credit_approved',
  ACCOUNT_SUSPENDED:          'account_suspended',
  ACCOUNT_REACTIVATED:        'account_reactivated',
  PRICE_MODIFIED:             'price_modified',
  SUPPLIER_MANUALLY_ASSIGNED: 'supplier_manually_assigned',
  REPUTATION_EXCEPTION:       'reputation_exception',
  CLAIM_WINDOW_REOPENED:      'claim_window_reopened',
  ROLE_ASSIGNED:              'role_assigned',
  SUPPLIER_PAYMENT_RECORDED:  'supplier_payment_recorded',
  BAD_PRODUCT_REPORTED:       'bad_product_reported',
  ROLE_CONVERTED:             'role_converted',
  ORDER_CANCELLED_POST_PAYMENT: 'order_cancelled_post_payment',
  ORDER_CANCELLATION_REQUESTED: 'order_cancellation_requested',
  USER_CREATED:               'user_created',
  PASSWORD_RESET:             'password_reset',
  SUPPLIER_ASSIGNED:          'supplier_assigned',
  ASSIGNMENT_FAILED:          'assignment_failed',
  RECEPTION_RECORDED:         'reception_recorded',
  DISPATCH_CYCLE_STATUS_CHANGED: 'dispatch_cycle_status_changed',
  ORDER_DELIVERED:            'order_delivered',
  DELIVERY_INCIDENT:          'delivery_incident',
  CLAIM_RESOLVED:             'claim_resolved',
  WALLET_RECHARGE_APPROVED:   'wallet_recharge_approved',
  WALLET_RECHARGE_REJECTED:   'wallet_recharge_rejected',
  WALLET_CREDIT_APPROVED:     'wallet_credit_approved',
  WALLET_CREDIT_REJECTED:     'wallet_credit_rejected',
  SYSTEM_PARAMS_UPDATED:      'system_params_updated',
  CATEGORY_UPDATED:           'category_updated',
  ORDER_IN_STORAGE:           'order_in_storage',
  SUPPLIER_CONFIRMED:         'supplier_confirmed',
  SUPPLIER_REJECTED:          'supplier_rejected',
  DELIVERY_CODE_FAILED:       'delivery_code_failed',
  ORDER_AUTO_FAILED:          'order_auto_failed',
} as const

export const AUDIT_MODULES = {
  PAYMENTS:    'payments',
  WALLET:      'wallet',
  ORDERS:      'orders',
  USERS:       'users',
  PRODUCTS:    'products',
  DELIVERIES:  'deliveries',
  CLAIMS:      'claims',
  SYSTEM:      'system',
  SUPPLIERS:   'suppliers',
} as const

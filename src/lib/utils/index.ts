const LIMA_TZ = 'America/Lima'

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatCurrency(amount: number): string {
  return `S/ ${amount.toFixed(2)}`
}

// Precio de venta = precio_min_proveedor_más_caro / (1 - costo_operativo% - margen%)
export function calculateSalePrice(
  highestSupplierMinPrice: number,
  operationalCostPct: number,
  marginPct: number,
): number {
  const denominator = 1 - operationalCostPct - marginPct
  if (denominator <= 0) throw new Error('Parámetros inválidos: denominador ≤ 0')
  return Math.ceil((highestSupplierMinPrice / denominator) * 100) / 100
}

// Retorna el próximo martes (2) o viernes (5) a partir de `from`
export function getNextDispatchDate(from: Date = new Date()): Date {
  const day = from.getDay()
  let daysUntil: number
  if (day < 2)      daysUntil = 2 - day   // antes del martes
  else if (day < 5) daysUntil = 5 - day   // antes del viernes
  else              daysUntil = 9 - day    // después del viernes → próximo martes

  const next = new Date(from)
  next.setDate(next.getDate() + daysUntil)
  next.setHours(0, 0, 0, 0)
  return next
}

// claim_window_expires_at = delivered_at + 2 horas
export function getClaimWindowExpiry(deliveredAt: string | Date): Date {
  const date = new Date(deliveredAt)
  date.setHours(date.getHours() + 2)
  return date
}

export function isCutoffPassed(cutoffAt: string | Date): boolean {
  return new Date() > new Date(cutoffAt)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'hace un momento'
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)} h`
  return `hace ${Math.floor(secs / 86400)} días`
}

export function toWANumber(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('51') && digits.length === 11) return digits
  if (digits.length === 9) return `51${digits}`
  return null
}

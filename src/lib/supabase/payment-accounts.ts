import type { createAdminClient } from './admin'

// Cuentas de cobro (Yape / transferencia) que se muestran al cliente en checkout
// y recarga de billetera. Viven en system_params (editables por el superadmin, §20).
export interface PaymentAccounts {
  yapeNumber: string
  yapeName: string
  transferBank: string
  transferAccount: string
  transferCci: string
}

export const PAYMENT_ACCOUNT_KEYS = [
  'yape_number',
  'yape_name',
  'transfer_bank',
  'transfer_account',
  'transfer_cci',
] as const

// Se lee con el admin client: system_params no es legible por el customer vía RLS.
export async function getPaymentAccounts(
  admin: ReturnType<typeof createAdminClient>,
): Promise<PaymentAccounts> {
  const { data } = await admin
    .from('system_params')
    .select('key, value')
    .in('key', PAYMENT_ACCOUNT_KEYS as unknown as string[])

  const m: Record<string, string> = {}
  for (const r of data ?? []) m[r.key] = r.value

  return {
    yapeNumber: m['yape_number'] ?? '',
    yapeName: m['yape_name'] ?? '',
    transferBank: m['transfer_bank'] ?? '',
    transferAccount: m['transfer_account'] ?? '',
    transferCci: m['transfer_cci'] ?? '',
  }
}

import type { PaymentAccounts } from '@/lib/supabase/payment-accounts'

interface Props {
  method: 'yape' | 'transfer'
  accounts: PaymentAccounts
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-miski-muted">{label}</span>
      <span className="text-sm font-semibold text-miski-forest tabular text-right break-all">{value}</span>
    </div>
  )
}

// Muestra a quién pagar según el método. Datos desde system_params (§20).
export function PaymentAccountInfo({ method, accounts }: Props) {
  return (
    <div className="bg-miski-green-soft border border-miski-green/30 rounded-xl px-4 py-3 space-y-1.5">
      <p className="text-xs font-semibold text-miski-forest uppercase tracking-wider">
        {method === 'yape' ? 'Yapea a' : 'Transfiere a'}
      </p>
      {method === 'yape' ? (
        <>
          <Line label="Titular" value={accounts.yapeName || '—'} />
          <Line label="Número" value={accounts.yapeNumber || '—'} />
        </>
      ) : (
        <>
          <Line label="Banco" value={accounts.transferBank || '—'} />
          <Line label="Cuenta" value={accounts.transferAccount || '—'} />
          <Line label="CCI" value={accounts.transferCci || '—'} />
        </>
      )}
    </div>
  )
}

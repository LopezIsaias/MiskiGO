'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarShell } from '@/components/shared/sidebar-shell'

const NAV = [
  { label: 'Aprobación de pagos',   href: '/operator/payments',   exact: false },
  { label: 'Gestión de pedidos',    href: '/operator/orders',     exact: false },
  { label: 'Ciclo de despacho',     href: '/operator/cycle',      exact: false },
  { label: 'Ofertas del ciclo',     href: '/operator/offerings',  exact: false },
  { label: 'Captura de oferta',     href: '/operator/sourcing',   exact: false },
  { label: 'Reclamos',              href: '/operator/claims',     exact: false },
  { label: 'Recargas',              href: '/operator/wallet',     exact: false },
  { label: 'Repartidores activos',  href: '/operator/deliveries', exact: false },
] as const

export function OperatorSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <SidebarShell>
      <div className="px-5 py-4 border-b border-white/10">
        <span className="font-display text-base font-extrabold tracking-wide text-white">Miski GO</span>
        <p className="mt-0.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-miski-lime/15 text-miski-lime tracking-wide">
            Operador
          </span>
        </p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ label, href, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-miski-lime text-miski-forest font-medium'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </SidebarShell>
  )
}

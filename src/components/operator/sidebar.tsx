'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Aprobación de pagos',   href: '/operator/payments',   exact: false },
  { label: 'Gestión de pedidos',    href: '/operator/orders',     exact: false },
  { label: 'Ciclo de despacho',     href: '/operator/cycle',      exact: false },
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
    <aside className="w-56 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-200">
        <span className="text-base font-bold text-green-700">Miski GO</span>
        <p className="text-xs text-gray-400 mt-0.5">Operaciones</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ label, href, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

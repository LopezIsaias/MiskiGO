'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cart'
import { NotificationBell } from '@/components/customer/notification-bell'

const NAV = [
  { label: 'Catálogo',     href: '/customer/catalog', exact: false },
  { label: 'Mis pedidos',  href: '/customer/orders',  exact: false },
  { label: 'Mis reclamos', href: '/customer/claims',  exact: false },
  { label: 'Mi billetera', href: '/customer/wallet',  exact: false },
] as const

export function CustomerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const cartCount = useCartStore(s => s.items.length)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen bg-miski-forest flex flex-col">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <span className="text-base font-bold tracking-wide text-white">Miski GO</span>
          <p className="mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-miski-lime/15 text-miski-lime tracking-wide">
              Cliente
            </span>
          </p>
        </div>
        <NotificationBell />
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
        <Link
          href="/customer/cart"
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname.startsWith('/customer/cart')
              ? 'bg-miski-lime text-miski-forest font-medium'
              : 'text-white/65 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span>Carrito</span>
          {cartCount > 0 && (
            <span className="bg-miski-lime text-miski-forest text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Link>
      </nav>

      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

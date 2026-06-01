'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cart'
import { NotificationBell } from '@/components/customer/notification-bell'

const NAV = [
  { label: 'Catálogo',     href: '/customer/catalog', exact: false },
  { label: 'Mis pedidos',  href: '/customer/orders',  exact: false },
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
    <aside className="w-56 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-green-700">Miski GO</span>
          <p className="text-xs text-gray-400 mt-0.5">Mi cuenta</p>
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
        <Link
          href="/customer/cart"
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith('/customer/cart')
              ? 'bg-green-50 text-green-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span>Carrito</span>
          {cartCount > 0 && (
            <span className="bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Link>
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

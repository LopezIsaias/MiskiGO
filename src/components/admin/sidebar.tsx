'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Dashboard',     href: '/admin',            exact: true  },
  { label: 'Categorías',    href: '/admin/categories', exact: false },
  { label: 'Productos',     href: '/admin/products',   exact: false },
  { label: 'Usuarios',      href: '/admin/users',      exact: false },
  { label: 'Billetera',     href: '/admin/wallet',     exact: false },
  { label: 'Auditoría',     href: '/admin/audit',      exact: false },
  { label: 'Configuración', href: '/admin/settings',   exact: false },
] as const

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-58 shrink-0 h-screen bg-miski-forest flex flex-col">
      {/* Marca */}
      <div className="px-5 py-5 border-b border-white/10">
        <span className="font-display text-base font-extrabold text-white tracking-wide">Miski GO</span>
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-miski-lime/15 text-miski-lime tracking-wide">
            Superadmin
          </span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-miski-lime text-miski-forest shadow-sm'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-miski-forest mr-2 shrink-0" />
              )}
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-3 py-4 border-t border-white/10">
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

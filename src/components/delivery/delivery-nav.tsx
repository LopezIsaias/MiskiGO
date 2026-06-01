'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Recepción', href: '/delivery/reception' },
  { label: 'Ruta',      href: '/delivery/route' },
] as const

export function DeliveryNav() {
  const pathname = usePathname()

  return (
    <nav className="flex border-b border-miski-sage/40 bg-white">
      {TABS.map(({ label, href }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 text-center py-2.5 text-xs font-semibold transition-colors border-b-2 ${
              isActive
                ? 'border-miski-lime text-miski-forest'
                : 'border-transparent text-gray-400 hover:text-miski-forest'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

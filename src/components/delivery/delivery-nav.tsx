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
    <nav className="flex border-b border-gray-200 bg-white">
      {TABS.map(({ label, href }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 text-center py-2.5 text-xs font-semibold transition-colors border-b-2 ${
              isActive
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

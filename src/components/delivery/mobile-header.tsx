'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  title: string
  subtitle?: string
}

export function MobileHeader({ title, subtitle }: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="min-w-0">
        <span className="text-sm font-bold text-green-700 block">Miski GO</span>
        <span className="text-xs text-gray-400 block leading-none">Repartidor</span>
      </div>
      <div className="text-center min-w-0 px-2">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
      <button
        onClick={handleSignOut}
        className="text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap py-1 px-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Salir
      </button>
    </header>
  )
}

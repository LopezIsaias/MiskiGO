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
    <header className="sticky top-0 z-10 bg-miski-forest px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="min-w-0">
        <span className="font-display text-sm font-extrabold text-white block">Miski GO</span>
        <span className="text-xs text-white/60 block leading-none">Repartidor</span>
      </div>
      <div className="text-center min-w-0 px-2">
        <p className="text-sm font-bold text-white truncate">{title}</p>
        {subtitle && (
          <p className="text-xs truncate">
            <span className="bg-miski-lime text-miski-forest font-semibold rounded-full px-2 py-0.5 text-[10px]">
              {subtitle}
            </span>
          </p>
        )}
      </div>
      <button
        onClick={handleSignOut}
        className="text-xs text-white/70 hover:text-white whitespace-nowrap py-1 px-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        Salir
      </button>
    </header>
  )
}

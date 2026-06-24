'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  // Ancho del panel en escritorio (algunos roles usan w-58). Default w-56.
  width?: string
}

// Shell mobile-first para los sidebars de rol. En escritorio (md+) el panel es
// estático como antes. En móvil se vuelve un drawer deslizable con barra superior
// + botón hamburguesa, y se cierra solo al navegar (cambio de pathname).
// ponytail: un solo shell reutilizado por los 4 sidebars; sin libs de drawer.
export function SidebarShell({ children, width = 'w-56' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Barra superior móvil */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-miski-forest flex items-center gap-3 px-4">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="-ml-1 p-1 text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-display text-base font-extrabold tracking-wide text-white">Miski GO</span>
      </header>

      {/* Backdrop móvil */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Panel / drawer — cerrar al tocar un Link o el botón de salir */}
      <aside
        onClick={(e) => { if ((e.target as HTMLElement).closest('a, button')) setOpen(false) }}
        className={`${width} shrink-0 bg-miski-forest flex flex-col z-50 fixed inset-y-0 left-0 transition-transform md:static md:h-screen md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {children}
      </aside>
    </>
  )
}

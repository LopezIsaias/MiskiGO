import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/miski_portada.png')" }}
    >
      <div className="absolute inset-0 bg-miski-forest/50" />
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}

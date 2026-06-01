import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/miski_portada.png')" }}
    >
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}

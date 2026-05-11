import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700">Miski GO</h1>
          <p className="text-green-600 text-sm mt-1">Del campo a tu mesa, sin escalas.</p>
        </div>
        {children}
      </div>
    </div>
  )
}

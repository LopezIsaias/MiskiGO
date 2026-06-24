import type { ReactNode } from 'react'
import { OperatorSidebar } from '@/components/operator/sidebar'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:h-screen md:flex md:overflow-hidden bg-miski-hueso">
      <OperatorSidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-20 md:p-8">
        {children}
      </main>
    </div>
  )
}

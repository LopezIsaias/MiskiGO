import type { ReactNode } from 'react'
import { OperatorSidebar } from '@/components/operator/sidebar'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-miski-hueso">
      <OperatorSidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { OperatorSidebar } from '@/components/operator/sidebar'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <OperatorSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

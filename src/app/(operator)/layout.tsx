import type { ReactNode } from 'react'
import { OperatorSidebar } from '@/components/operator/sidebar'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <OperatorSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}

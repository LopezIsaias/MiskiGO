import type { ReactNode } from 'react'
import { OperatorSidebar } from '@/components/operator/sidebar'

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: '#F3F6EE' }}>
      <OperatorSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

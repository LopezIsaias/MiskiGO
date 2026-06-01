import type { ReactNode } from 'react'
import { CustomerSidebar } from '@/components/customer/sidebar'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: '#F3F6EE' }}>
      <CustomerSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

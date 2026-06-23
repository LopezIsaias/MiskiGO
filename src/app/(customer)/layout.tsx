import type { ReactNode } from 'react'
import { CustomerSidebar } from '@/components/customer/sidebar'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-miski-hueso">
      <CustomerSidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

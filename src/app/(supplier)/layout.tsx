import type { ReactNode } from 'react'
import { SupplierSidebar } from '@/components/supplier/sidebar'

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: '#F3F6EE' }}>
      <SupplierSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { SupplierSidebar } from '@/components/supplier/sidebar'

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:h-screen md:flex md:overflow-hidden" style={{ backgroundColor: '#F6F8F1' }}>
      <SupplierSidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-8">
        {children}
      </main>
    </div>
  )
}

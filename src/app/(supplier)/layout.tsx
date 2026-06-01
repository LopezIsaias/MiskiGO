import type { ReactNode } from 'react'
import { SupplierSidebar } from '@/components/supplier/sidebar'

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <SupplierSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

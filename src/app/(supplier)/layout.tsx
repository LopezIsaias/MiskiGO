import type { ReactNode } from 'react'
import { SupplierSidebar } from '@/components/supplier/sidebar'

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SupplierSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}

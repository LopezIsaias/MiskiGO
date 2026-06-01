import type { ReactNode } from 'react'
import { AdminSidebar } from '@/components/admin/sidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

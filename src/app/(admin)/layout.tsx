import type { ReactNode } from 'react'
import { AdminSidebar } from '@/components/admin/sidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: '#F6F8F1' }}>
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

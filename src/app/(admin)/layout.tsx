import type { ReactNode } from 'react'
import { AdminSidebar } from '@/components/admin/sidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:h-screen md:flex md:overflow-hidden" style={{ backgroundColor: '#F6F8F1' }}>
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-8">
        {children}
      </main>
    </div>
  )
}

import type { ReactNode } from 'react'

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F6F8F1' }}>
      {children}
    </div>
  )
}

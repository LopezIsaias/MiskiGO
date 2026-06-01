import type { ReactNode } from 'react'

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F6EE' }}>
      {children}
    </div>
  )
}

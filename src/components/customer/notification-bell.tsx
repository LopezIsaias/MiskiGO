'use client'

import { useState, useEffect } from 'react'
import { timeAgo } from '@/lib/utils'

interface NotifItem {
  id:             string
  title:          string | null
  body:           string
  reference_type: string | null
  reference_id:   string | null
  created_at:     string
  read_at:        string | null
}

interface FetchResult {
  notifications: NotifItem[]
  unreadCount:   number
}

export function NotificationBell() {
  const [open,  setOpen]  = useState(false)
  const [data,  setData]  = useState<FetchResult>({ notifications: [], unreadCount: 0 })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const res = await fetch('/api/customer/notifications')
        if (!res.ok || !active) return
        const json = await res.json() as FetchResult
        if (active) setData(json)
      } catch { /* silent */ }
    }

    void load()
    const interval = setInterval(() => void load(), 30_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  async function handleToggle() {
    const opening = !open
    setOpen(opening)
    if (opening && data.unreadCount > 0) {
      await fetch('/api/customer/notifications/read', { method: 'PATCH' })
      const now = new Date().toISOString()
      setData(prev => ({
        notifications: prev.notifications.map(n => ({ ...n, read_at: n.read_at ?? now })),
        unreadCount: 0,
      }))
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleToggle()}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notificaciones"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-gray-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {data.unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {data.unreadCount > 9 ? '9+' : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Notificaciones</p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {data.notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sin notificaciones</p>
              ) : (
                data.notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 ${!n.read_at ? 'bg-green-50' : ''}`}>
                    {n.title && (
                      <p className="text-xs font-semibold text-gray-800 mb-0.5">{n.title}</p>
                    )}
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

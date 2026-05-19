'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatTime } from '@/lib/utils'

interface Props {
  orderId:              string
  claimWindowExpiresAt: string
}

export function DeliveryClaimBanner({ orderId, claimWindowExpiresAt }: Props) {
  const [windowOpen, setWindowOpen] = useState(
    () => Date.now() < new Date(claimWindowExpiresAt).getTime()
  )

  useEffect(() => {
    const ms = new Date(claimWindowExpiresAt).getTime() - Date.now()
    if (ms <= 0) return
    const t = setTimeout(() => setWindowOpen(false), ms)
    return () => clearTimeout(t)
  }, [claimWindowExpiresAt])

  const limitTime = formatTime(claimWindowExpiresAt)

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3 mt-3">
      <p className="text-sm text-green-800 leading-relaxed">
        {'🌱 ¡Tu pedido ha llegado! Esperamos que estés disfrutando productos frescos directo del campo. '}
        {windowOpen
          ? `Si notas algún inconveniente, tienes hasta las ${limitTime} para reportarlo desde la app. Después de ese plazo no podremos procesar cambios en este pedido. `
          : `El plazo para reportar inconvenientes venció a las ${limitTime}. `}
        {'¡Gracias por confiar en Miski GO! 🙌'}
      </p>
      {windowOpen ? (
        <Link
          href={`/customer/orders/${orderId}/claim`}
          className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
        >
          Reportar problema
        </Link>
      ) : (
        <span className="text-xs text-gray-400 font-medium">Plazo de reclamo vencido</span>
      )}
    </div>
  )
}

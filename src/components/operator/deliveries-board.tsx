'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DeliveryStop {
  stopId:    string
  orderId:   string
  stopOrder: number
  status:    string
}

export interface DeliveryPersonRow {
  personId:      string
  personName:    string
  routeId:       string
  routeStatus:   string
  stops:         DeliveryStop[]
}

const STOP_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  arrived:   'En destino',
  delivered: 'Entregado',
  failed:    'Fallido',
}

const STOP_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-miski-gold-light/40 text-amber-800',
  arrived:   'bg-blue-100 text-blue-700',
  delivered: 'bg-miski-lime/20 text-miski-forest',
  failed:    'bg-red-100 text-red-700',
}

interface Props {
  initialData: DeliveryPersonRow[]
  realtime?:   boolean
}

export function DeliveriesBoard({ initialData, realtime = true }: Props) {
  const [data, setData] = useState<DeliveryPersonRow[]>(initialData)

  useEffect(() => {
    if (!realtime) return

    const supabase = createClient()

    const channel = supabase
      .channel('delivery-stops-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_stops' },
        (payload) => {
          const changed = payload.new as { id: string; status: string; route_id: string; order_id: string; stop_order: number } | undefined
          if (!changed) return

          setData(prev =>
            prev.map(person => {
              if (person.routeId !== changed.route_id) return person
              const stopIdx = person.stops.findIndex(s => s.stopId === changed.id)
              if (stopIdx === -1) {
                // New stop — add it
                return {
                  ...person,
                  stops: [...person.stops, {
                    stopId:    changed.id,
                    orderId:   changed.order_id,
                    stopOrder: changed.stop_order,
                    status:    changed.status,
                  }].sort((a, b) => a.stopOrder - b.stopOrder),
                }
              }
              const stops = [...person.stops]
              stops[stopIdx] = { ...stops[stopIdx], status: changed.status }
              return { ...person, stops }
            })
          )
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [realtime])

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-miski-sage/40 shadow-sm p-8 text-center">
        <p className="text-sm text-miski-olive">No hay repartidores activos en el ciclo actual.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map(person => {
        const delivered = person.stops.filter(s => s.status === 'delivered').length
        const pending   = person.stops.filter(s => s.status === 'pending').length
        const total     = person.stops.length

        return (
          <div key={person.personId} className="bg-white rounded-xl border border-miski-sage/40 shadow-sm overflow-hidden">
            {/* Person header */}
            <div className="px-5 py-4 border-b border-miski-sage/20 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-miski-forest">{person.personName}</p>
                <p className="text-xs text-miski-olive mt-0.5">
                  {delivered} entregados · {pending} pendientes · {total} total
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Progress bar */}
                <div className="w-32 h-2 bg-miski-sage/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-miski-green transition-all duration-500"
                    style={{ width: total > 0 ? `${(delivered / total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-semibold text-miski-forest">
                  {total > 0 ? Math.round((delivered / total) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Stops list */}
            {person.stops.length > 0 && (
              <div className="divide-y divide-miski-sage/10">
                {person.stops.map(stop => (
                  <div key={stop.stopId} className="px-5 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-miski-olive w-4 shrink-0 font-medium">{stop.stopOrder}</span>
                    <span className="text-xs text-gray-700 font-mono flex-1 truncate">
                      #{stop.orderId.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STOP_STATUS_COLOR[stop.status] ?? 'bg-miski-gold-light/40 text-amber-800'}`}>
                      {STOP_STATUS_LABEL[stop.status] ?? stop.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

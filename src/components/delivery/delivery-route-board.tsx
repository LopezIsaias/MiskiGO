'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatTime } from '@/lib/utils'

// ── Public types (consumed by the server page) ───────────────────────────────

export interface StopItem {
  productName: string
  quantity:    number
  unit:        string
}

export interface StopData {
  orderId:              string
  stopOrder:            number
  customerName:         string
  deliveryAddress:      string
  customerNote:         string | null
  deliveryNotes:        string | null
  orderStatus:          string
  stopStatus:           string | null
  failureReason:        string | null
  deliveredAt:          string | null
  claimWindowExpiresAt: string | null
  items:                StopItem[]
}

interface Props {
  cycleId:       string
  routeId:       string | null
  staticMapUrl:  string | null
  googleMapsUrl: string
  initialStops:  StopData[]
}

// ── StopCard ─────────────────────────────────────────────────────────────────

interface StopCardProps {
  stop:         StopData
  index:        number
  routeStarted: boolean
  isDelivering: boolean
  onDeliver:         () => void
  onReportIncident:  () => void
}

function StopCard({
  stop, index, routeStarted, isDelivering, onDeliver, onReportIncident,
}: StopCardProps) {
  const isDelivered = stop.orderStatus === 'delivered'
  const isFailed    = stop.stopStatus  === 'failed'
  const isPending   = !isDelivered && !isFailed

  const [expanded, setExpanded] = useState(isPending)

  const borderColor = isDelivered
    ? 'border-green-200 bg-green-50'
    : isFailed
      ? 'border-red-200 bg-red-50'
      : 'border-gray-200 bg-white'

  const numberColor = isDelivered
    ? 'bg-green-500'
    : isFailed
      ? 'bg-red-500'
      : 'bg-gray-400'

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${numberColor}`}>
          {isDelivered ? '✓' : isFailed ? '✕' : index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{stop.customerName}</p>
          <p className="text-xs text-gray-500 truncate">{stop.deliveryAddress}</p>
          {isDelivered && stop.deliveredAt && (
            <p className="text-xs text-green-600 mt-0.5">
              Entregado a las {formatTime(stop.deliveredAt)}
              {stop.claimWindowExpiresAt && (
                <> · ventana hasta las {formatTime(stop.claimWindowExpiresAt)}</>
              )}
            </p>
          )}
          {isFailed && (
            <p className="text-xs text-red-600 mt-0.5">Incidencia: {stop.failureReason}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          <div className="pt-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Productos a entregar</p>
            <div className="space-y-1">
              {stop.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-700">{item.productName}</span>
                  <span className="font-semibold text-gray-800">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {stop.customerNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Nota del cliente:</span> {stop.customerNote}
              </p>
            </div>
          )}

          {stop.deliveryNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Instrucciones:</span> {stop.deliveryNotes}
              </p>
            </div>
          )}

          {routeStarted && isPending && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onReportIncident}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 border border-red-200 active:bg-red-100"
              >
                Incidencia
              </button>
              <button
                type="button"
                onClick={onDeliver}
                disabled={isDelivering}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-green-600 active:bg-green-700 disabled:opacity-50"
              >
                {isDelivering ? 'Registrando…' : 'Marcar entregado'}
              </button>
            </div>
          )}

          {!routeStarted && isPending && (
            <p className="text-xs text-gray-400 text-center pt-1">
              Inicia la ruta para registrar entregas
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main board ───────────────────────────────────────────────────────────────

export function DeliveryRouteBoard({
  cycleId, routeId: initialRouteId, staticMapUrl, googleMapsUrl, initialStops,
}: Props) {
  const router = useRouter()

  const [stops,   setStops]   = useState<StopData[]>(initialStops)
  const [routeId, setRouteId] = useState<string | null>(initialRouteId)
  const [starting, setStarting] = useState(false)
  const [delivering, setDelivering] = useState<string | null>(null)

  // Incident modal state
  const [incidentOrderId, setIncidentOrderId] = useState<string | null>(null)
  const [incidentReason,  setIncidentReason]  = useState('')
  const [submittingIncident, setSubmittingIncident] = useState(false)

  const [error, setError] = useState('')

  const totalCount     = stops.length
  const deliveredCount = stops.filter(s => s.orderStatus === 'delivered').length
  const pendingCount   = stops.filter(s => s.orderStatus !== 'delivered' && s.stopStatus !== 'failed').length
  const allDone        = pendingCount === 0

  async function handleStartRoute() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/delivery/route/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId,
          stops: stops.map((s, i) => ({ orderId: s.orderId, stopOrder: i + 1 })),
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json() as { routeId: string }
      setRouteId(data.routeId)
      setStops(prev => prev.map(s => ({
        ...s,
        orderStatus: s.orderStatus === 'assigned' ? 'in_transit' : s.orderStatus,
        stopStatus:  s.stopStatus ?? 'pending',
      })))
    } catch {
      setError('Error al iniciar la ruta. Intenta de nuevo.')
    } finally {
      setStarting(false)
    }
  }

  async function handleDeliver(orderId: string) {
    setDelivering(orderId)
    setError('')
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json() as { deliveredAt: string; claimWindowExpiresAt: string }
      setStops(prev => prev.map(s =>
        s.orderId === orderId
          ? {
              ...s,
              orderStatus:          'delivered',
              stopStatus:           'delivered',
              deliveredAt:          data.deliveredAt,
              claimWindowExpiresAt: data.claimWindowExpiresAt,
            }
          : s
      ))
    } catch {
      setError('Error al registrar entrega. Intenta de nuevo.')
    } finally {
      setDelivering(null)
    }
  }

  async function handleIncidentSubmit() {
    if (!incidentOrderId || !incidentReason.trim()) return
    setSubmittingIncident(true)
    setError('')
    try {
      const res = await fetch(`/api/delivery/orders/${incidentOrderId}/incident`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, reason: incidentReason.trim() }),
      })
      if (!res.ok) throw new Error()
      const reason = incidentReason.trim()
      setStops(prev => prev.map(s =>
        s.orderId === incidentOrderId
          ? { ...s, stopStatus: 'failed', failureReason: reason }
          : s
      ))
      setIncidentOrderId(null)
      setIncidentReason('')
    } catch {
      setError('Error al registrar incidencia. Intenta de nuevo.')
    } finally {
      setSubmittingIncident(false)
    }
  }

  function handleRefresh() {
    router.refresh()
  }

  return (
    <div className="pb-20">
      {/* Map */}
      <div className="relative bg-gray-100">
        {staticMapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticMapUrl}
            alt="Mapa de ruta"
            className="w-full h-52 object-cover"
          />
        ) : (
          <div className="w-full h-52 flex items-center justify-center">
            <p className="text-xs text-gray-400">Mapa no disponible</p>
          </div>
        )}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 bg-white text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-full shadow-sm border border-gray-200"
        >
          Abrir en Google Maps
        </a>
      </div>

      {/* Action bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {totalCount} paradas · {pendingCount} pendientes · {deliveredCount} entregadas
        </p>
        {!routeId && (
          <button
            type="button"
            onClick={handleStartRoute}
            disabled={starting || totalCount === 0}
            className="shrink-0 text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 active:bg-green-700"
          >
            {starting ? 'Iniciando…' : 'Iniciar ruta'}
          </button>
        )}
        {routeId && allDone && (
          <span className="text-xs font-semibold text-green-600">Ruta completada ✓</span>
        )}
        {routeId && !allDone && (
          <button
            type="button"
            onClick={handleRefresh}
            className="shrink-0 text-xs text-gray-500 underline"
          >
            Actualizar
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Stop list */}
      <div className="px-4 py-3 space-y-3">
        {stops.map((stop, i) => (
          <StopCard
            key={stop.orderId}
            stop={stop}
            index={i + 1}
            routeStarted={routeId !== null}
            isDelivering={delivering === stop.orderId}
            onDeliver={() => handleDeliver(stop.orderId)}
            onReportIncident={() => {
              setIncidentOrderId(stop.orderId)
              setIncidentReason('')
              setError('')
            }}
          />
        ))}
      </div>

      {/* Incident bottom-sheet */}
      {incidentOrderId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setIncidentOrderId(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800">Reportar incidencia</h3>
            <p className="text-xs text-gray-500">
              Pedido {incidentOrderId.slice(0, 8).toUpperCase()} · el status quedará pendiente para que el operador gestione.
            </p>
            <textarea
              rows={3}
              value={incidentReason}
              onChange={e => setIncidentReason(e.target.value)}
              placeholder="Ej: cliente no se encontraba, dirección incorrecta, portón cerrado…"
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400 resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIncidentOrderId(null); setIncidentReason('') }}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 active:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleIncidentSubmit}
                disabled={submittingIncident || !incidentReason.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 disabled:opacity-50 active:bg-red-700"
              >
                {submittingIncident ? 'Enviando…' : 'Reportar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

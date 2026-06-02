'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'

// ── Public types ──────────────────────────────────────────────────────────────

export interface StopItem {
  productName: string
  quantity:    number
  unit:        string
}

export interface StopData {
  orderId:                  string
  stopOrder:                number
  customerName:             string
  deliveryAddress:          string
  customerNote:             string | null
  deliveryNotes:            string | null
  orderStatus:              string
  stopStatus:               string | null
  failureReason:            string | null
  deliveredAt:              string | null
  claimWindowExpiresAt:     string | null
  deliveryConfirmationCode: string | null
  deliveryAttempts:         number
  items:                    StopItem[]
}

interface Props {
  cycleId:       string
  routeId:       string | null
  staticMapUrl:  string | null
  googleMapsUrl: string
  initialStops:  StopData[]
}

// ── StopCard ──────────────────────────────────────────────────────────────────

interface StopCardProps {
  stop:         StopData
  index:        number
  routeStarted: boolean
  isDelivering: boolean
  onDeliver:        () => void
  onIncident:       () => void
}

function StopCard({ stop, index, routeStarted, isDelivering, onDeliver, onIncident }: StopCardProps) {
  const isDelivered  = stop.orderStatus === 'delivered'
  const isInStorage  = stop.orderStatus === 'in_storage'
  const isFailed     = stop.stopStatus  === 'failed'
  const isPending    = !isDelivered && !isInStorage && !isFailed

  const [expanded, setExpanded] = useState(isPending)

  const borderColor = isDelivered  ? 'border-l-4 border-miski-green bg-white'
    : isInStorage   ? 'border-l-4 border-miski-gold bg-white'
    : isFailed      ? 'border-l-4 border-red-400 bg-white'
    : 'border-l-4 border-miski-gold bg-white'

  const numberColor = isDelivered ? 'bg-miski-green'
    : isInStorage   ? 'bg-miski-gold'
    : isFailed      ? 'bg-red-500'
    : 'bg-miski-forest'

  const numberLabel = isDelivered ? '✓' : isInStorage ? '⚠' : isFailed ? '✕' : index

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${borderColor}`}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${numberColor}`}>
          {numberLabel}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isDelivered ? 'text-gray-400' : 'text-miski-forest'}`}>{stop.customerName}</p>
          <p className={`text-xs truncate ${isDelivered ? 'text-gray-400' : 'text-miski-olive'}`}>{stop.deliveryAddress}</p>
          {isDelivered && stop.deliveredAt && (
            <p className="text-xs text-miski-green mt-0.5">
              Entregado a las {formatTime(stop.deliveredAt)}
              {stop.claimWindowExpiresAt && (
                <> · ventana hasta {formatTime(stop.claimWindowExpiresAt)}</>
              )}
            </p>
          )}
          {isInStorage && (
            <p className="text-xs text-amber-600 mt-0.5">Guardado en almacén tras 2 intentos fallidos</p>
          )}
          {isFailed && (
            <p className="text-xs text-red-600 mt-0.5">Incidencia: {stop.failureReason}</p>
          )}
          {isPending && stop.deliveryAttempts > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">Intento {stop.deliveryAttempts}/2 fallido</p>
          )}
        </div>
        <span className="text-xs text-miski-sage shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-miski-sage/20">
          <div className="pt-3">
            <p className="text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">Productos a entregar</p>
            <div className="space-y-1">
              {stop.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-700">{item.productName}</span>
                  <span className="font-semibold text-miski-forest">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {stop.customerNote && (
            <div className="bg-miski-gold-light/20 border border-miski-gold/30 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Nota del cliente:</span> {stop.customerNote}
              </p>
            </div>
          )}
          {stop.deliveryNotes && (
            <div className="bg-miski-sage/20 border border-miski-sage/40 rounded-lg px-3 py-2">
              <p className="text-xs text-miski-forest">
                <span className="font-semibold">Instrucciones:</span> {stop.deliveryNotes}
              </p>
            </div>
          )}

          {routeStarted && isPending && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onIncident}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 border border-red-200 active:bg-red-100"
              >
                {stop.deliveryAttempts >= 1 ? 'Segundo intento fallido' : 'Incidencia'}
              </button>
              <button
                type="button"
                onClick={onDeliver}
                disabled={isDelivering}
                className="flex-1 bg-miski-lime text-miski-forest font-semibold rounded-xl py-2.5 px-4 active:scale-[0.98] text-xs disabled:opacity-50"
              >
                {isDelivering ? 'Verificando…' : 'Marcar entregado'}
              </button>
            </div>
          )}

          {!routeStarted && isPending && (
            <p className="text-xs text-miski-olive text-center pt-1">
              Inicia la ruta para registrar entregas
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────

export function DeliveryRouteBoard({
  cycleId, routeId: initialRouteId, staticMapUrl, googleMapsUrl, initialStops,
}: Props) {
  const router = useRouter()

  const [stops,    setStops]    = useState<StopData[]>(initialStops)
  const [routeId,  setRouteId]  = useState<string | null>(initialRouteId)
  const [starting, setStarting] = useState(false)
  const [delivering, setDelivering] = useState<string | null>(null)
  const [error, setError] = useState('')

  // ── Confirmation code modal ──
  const [codeOrderId, setCodeOrderId] = useState<string | null>(null)
  const [enteredCode, setEnteredCode] = useState('')
  const [codeError,   setCodeError]   = useState('')

  // ── Delivery receipt (recibo tras confirmar) ──
  const [receipt, setReceipt] = useState<{ stop: StopData; deliveredAt: string; claimWindowExpiresAt: string; code: string } | null>(null)

  // ── Incident modal ──
  const [incidentOrderId,    setIncidentOrderId]    = useState<string | null>(null)
  const [incidentReason,     setIncidentReason]     = useState('')
  const [incidentPhotoFile,  setIncidentPhotoFile]  = useState<File | null>(null)
  const [submittingIncident, setSubmittingIncident] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const totalCount     = stops.length
  const deliveredCount = stops.filter(s => ['delivered', 'in_storage'].includes(s.orderStatus)).length
  const pendingCount   = stops.filter(s => !['delivered', 'in_storage'].includes(s.orderStatus) && s.stopStatus !== 'failed').length
  const allDone        = pendingCount === 0

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function handleStartRoute() {
    setStarting(true); setError('')
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

  function openCodeModal(orderId: string) {
    setCodeOrderId(orderId)
    setEnteredCode('')
    setCodeError('')
    setError('')
  }

  async function handleDeliver() {
    if (!codeOrderId) return
    const orderId = codeOrderId
    if (enteredCode.length !== 6) { setCodeError('Ingresa los 6 dígitos.'); return }

    setDelivering(orderId); setCodeError('')
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, confirmationCode: enteredCode }),
      })

      if (res.status === 422) {
        const d = await res.json() as { error?: string }
        setCodeError(d.error ?? 'Código incorrecto. Verifica con el cliente.')
        return
      }
      if (!res.ok) throw new Error()

      const data = await res.json() as { deliveredAt: string; claimWindowExpiresAt: string }
      const deliveredStop = stops.find(s => s.orderId === orderId)
      setStops(prev => prev.map(s =>
        s.orderId === orderId
          ? { ...s, orderStatus: 'delivered', stopStatus: 'delivered', deliveredAt: data.deliveredAt, claimWindowExpiresAt: data.claimWindowExpiresAt }
          : s
      ))
      // Recibo de entrega con el detalle de lo entregado
      if (deliveredStop) {
        setReceipt({
          stop: deliveredStop,
          deliveredAt: data.deliveredAt,
          claimWindowExpiresAt: data.claimWindowExpiresAt,
          code: enteredCode,
        })
      }
      setCodeOrderId(null)
      setEnteredCode('')
      setCodeError('')
    } catch {
      setCodeError('Error de conexión. Intenta de nuevo.')
    } finally {
      setDelivering(null)
    }
  }

  function openIncidentModal(orderId: string) {
    setIncidentOrderId(orderId)
    setIncidentReason('')
    setIncidentPhotoFile(null)
    setError('')
  }

  async function handleIncidentSubmit() {
    if (!incidentOrderId || !incidentReason.trim()) return
    const currentStop = stops.find(s => s.orderId === incidentOrderId)
    const isSecondAttempt = (currentStop?.deliveryAttempts ?? 0) >= 1

    if (isSecondAttempt && !incidentPhotoFile) {
      setError('La foto es obligatoria en el segundo intento fallido.')
      return
    }

    setSubmittingIncident(true); setError('')
    try {
      let photoUrl: string | null = null

      if (isSecondAttempt && incidentPhotoFile) {
        const supabase = createClient()
        const ext = incidentPhotoFile.name.split('.').pop() ?? 'jpg'
        const path = `${incidentOrderId}-${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('delivery-incidents')
          .upload(path, incidentPhotoFile, { upsert: true })

        if (uploadErr) throw new Error('upload')

        const { data: urlData } = supabase.storage
          .from('delivery-incidents')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }

      const res = await fetch(`/api/delivery/orders/${incidentOrderId}/incident`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          reason:   incidentReason.trim(),
          photoUrl: photoUrl ?? undefined,
        }),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al registrar incidencia.')
        return
      }

      const reason = incidentReason.trim()

      if (isSecondAttempt) {
        setStops(prev => prev.map(s =>
          s.orderId === incidentOrderId
            ? { ...s, orderStatus: 'in_storage', stopStatus: 'failed', failureReason: reason, deliveryAttempts: 2 }
            : s
        ))
      } else {
        setStops(prev => prev.map(s =>
          s.orderId === incidentOrderId
            ? { ...s, stopStatus: 'failed', failureReason: reason, deliveryAttempts: 1 }
            : s
        ))
      }

      setIncidentOrderId(null)
      setIncidentReason('')
      setIncidentPhotoFile(null)
    } catch (err) {
      const msg = err instanceof Error && err.message === 'upload'
        ? 'Error al subir la foto. Intenta de nuevo.'
        : 'Error de conexión. Intenta de nuevo.'
      setError(msg)
    } finally {
      setSubmittingIncident(false)
    }
  }

  const incidentStop = stops.find(s => s.orderId === incidentOrderId)
  const isSecondAttempt = (incidentStop?.deliveryAttempts ?? 0) >= 1

  return (
    <div className="pb-20">
      {/* Map */}
      <div className="relative bg-gray-100">
        {staticMapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticMapUrl} alt="Mapa de ruta" className="w-full h-52 object-cover" />
        ) : (
          <div className="w-full h-52 flex items-center justify-center">
            <p className="text-xs text-gray-400">Mapa no disponible</p>
          </div>
        )}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 bg-white text-xs text-miski-forest font-semibold px-3 py-1.5 rounded-full shadow-sm border border-miski-sage/40"
        >
          Abrir en Google Maps
        </a>
      </div>

      {/* Action bar */}
      <div className="px-4 py-3 bg-white border-b border-miski-sage/20 flex items-center justify-between gap-3">
        <p className="text-xs text-miski-olive">
          {totalCount} paradas · {pendingCount} pendientes · {deliveredCount} finalizadas
        </p>
        {!routeId && (
          <button
            type="button"
            onClick={handleStartRoute}
            disabled={starting || totalCount === 0}
            className="shrink-0 text-xs font-semibold bg-miski-forest text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-miski-green active:scale-[0.98] transition-all"
          >
            {starting ? 'Iniciando…' : 'Iniciar ruta'}
          </button>
        )}
        {routeId && allDone && (
          <span className="bg-miski-lime/20 text-miski-forest text-xs font-semibold px-2.5 py-1 rounded-full">Ruta completada ✓</span>
        )}
        {routeId && !allDone && (
          <button type="button" onClick={() => router.refresh()} className="shrink-0 text-xs text-miski-olive underline">
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
            onDeliver={() => openCodeModal(stop.orderId)}
            onIncident={() => openIncidentModal(stop.orderId)}
          />
        ))}
      </div>

      {/* ── Code confirmation bottom-sheet ── */}
      {codeOrderId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => { setCodeOrderId(null); setDelivering(null) }}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold text-miski-forest">Confirmar entrega</h3>
              <p className="text-xs text-miski-olive mt-0.5">
                Pide al cliente su código de 6 dígitos y escríbelo abajo.
              </p>
            </div>

            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={enteredCode}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setEnteredCode(v)
                setCodeError('')
              }}
              placeholder="• • • • • •"
              autoFocus
              className="w-full text-center text-4xl font-bold tracking-[0.4em] border-2 border-miski-sage rounded-xl py-3 focus:outline-none focus:border-miski-green focus:ring-2 focus:ring-miski-lime/50 transition-colors text-gray-800"
            />

            {codeError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {codeError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCodeOrderId(null); setDelivering(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 active:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeliver}
                disabled={enteredCode.length !== 6 || delivering === codeOrderId}
                className="flex-1 bg-miski-lime text-miski-forest font-semibold rounded-xl py-3 text-sm active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {delivering === codeOrderId ? 'Verificando…' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delivery receipt bottom-sheet ── */}
      {receipt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setReceipt(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-miski-lime/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl text-miski-forest">✓</span>
              </div>
              <h3 className="text-base font-semibold text-miski-forest">Entrega confirmada</h3>
              <p className="text-xs text-miski-olive mt-0.5">Código verificado correctamente</p>
            </div>

            <div className="rounded-xl border border-miski-sage/40 divide-y divide-miski-sage/20 text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-miski-olive text-xs">Pedido</span>
                <span className="font-mono text-miski-forest">#{receipt.stop.orderId.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-miski-olive text-xs">Cliente</span>
                <span className="text-miski-forest font-medium">{receipt.stop.customerName}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-miski-olive text-xs">Dirección</span>
                <span className="text-gray-600 text-xs text-right max-w-[60%]">{receipt.stop.deliveryAddress}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-miski-olive text-xs">Entregado</span>
                <span className="text-miski-forest">{formatTime(receipt.deliveredAt)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-miski-olive text-xs">Ventana de reclamo</span>
                <span className="text-miski-forest">hasta {formatTime(receipt.claimWindowExpiresAt)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">Productos entregados</p>
              <div className="rounded-xl border border-miski-sage/40 divide-y divide-miski-sage/20">
                {receipt.stop.items.map((item, i) => (
                  <div key={i} className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-gray-700">{item.productName}</span>
                    <span className="font-semibold text-miski-forest">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="w-full bg-miski-forest text-white font-semibold rounded-xl py-3 text-sm active:scale-[0.98] transition-all"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ── Incident bottom-sheet ── */}
      {incidentOrderId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setIncidentOrderId(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold text-miski-forest">
                {isSecondAttempt ? 'Segundo intento fallido — almacenamiento' : 'Reportar incidencia'}
              </h3>
              <p className="text-xs text-miski-olive mt-0.5">
                {isSecondAttempt
                  ? 'El pedido pasará a estado "En almacén". Sube una foto del lugar de almacenamiento (obligatorio).'
                  : `Pedido ${incidentOrderId?.slice(0, 8).toUpperCase()} · se registrará el primer intento fallido.`}
              </p>
            </div>

            <textarea
              rows={3}
              value={incidentReason}
              onChange={e => setIncidentReason(e.target.value)}
              placeholder={isSecondAttempt
                ? 'Describe el motivo y dónde se almacenó el pedido…'
                : 'Ej: cliente no se encontraba, dirección incorrecta, portón cerrado…'}
              className="w-full border border-miski-sage rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-lime/50 focus:border-miski-green transition-colors text-gray-800 resize-none"
              autoFocus
            />

            {/* Photo upload — required on second attempt */}
            {isSecondAttempt && (
              <div>
                <p className="block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5">
                  Foto del lugar de almacenamiento <span className="text-red-500">*</span>
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => setIncidentPhotoFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className={`w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed transition-colors ${
                    incidentPhotoFile
                      ? 'border-miski-green bg-miski-lime/10 text-miski-forest'
                      : 'border-miski-sage bg-miski-cream/20 text-miski-olive hover:bg-miski-cream/40'
                  }`}
                >
                  {incidentPhotoFile
                    ? `✓ ${incidentPhotoFile.name}`
                    : 'Tomar o seleccionar foto'}
                </button>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIncidentOrderId(null); setIncidentReason(''); setIncidentPhotoFile(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 active:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleIncidentSubmit}
                disabled={
                  submittingIncident ||
                  !incidentReason.trim() ||
                  (isSecondAttempt && !incidentPhotoFile)
                }
                className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all ${
                  isSecondAttempt ? 'bg-amber-600 active:bg-amber-700' : 'bg-red-600 active:bg-red-700'
                }`}
              >
                {submittingIncident
                  ? 'Enviando…'
                  : isSecondAttempt
                    ? 'Registrar y almacenar'
                    : 'Reportar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

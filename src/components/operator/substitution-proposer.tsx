'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { OrderItem } from './order-card'

interface Candidate {
  publicationId: string
  productId:     string
  productName:   string
  unit:          string
  supplierName:  string
  availableQty:  number
  minimumPrice:  number
}

// Propone un producto alternativo (distinto) para un order_item 'failed'. El
// cliente lo acepta/rechaza después. Precio topado al unitario original (§4).
export function SubstitutionProposer({ orderId, item }: { orderId: string; item: OrderItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function fetchCandidates() {
    setLoading(true)
    setOpen(true)
    setError('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/substitute/candidates`)
      const data = await res.json() as { candidates?: Candidate[] }
      // Distinto producto (el mismo lo cubre "Buscar proveedor alternativo") y con stock suficiente.
      setCandidates((data.candidates ?? []).filter(c => c.productId !== item.productId && c.availableQty >= item.quantity - 0.001))
    } catch {
      setError('Error al cargar productos alternativos')
    } finally {
      setLoading(false)
    }
  }

  function selectCandidate(c: Candidate) {
    setSelected(c)
    setPrice(String(item.unitPrice)) // por defecto al precio original (tope); editable a la baja
    setError('')
  }

  async function submit() {
    if (!selected) return
    const charged = parseFloat(price)
    if (!(charged > 0)) { setError('Precio inválido'); return }
    if (charged > item.unitPrice + 0.001) { setError('No puede superar el precio original'); return }
    if (charged < selected.minimumPrice - 0.001) { setError('Quedaría por debajo del costo del proveedor'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId:         item.id,
          substituteProductId: selected.productId,
          publicationId:       selected.publicationId,
          chargedUnitPrice:    charged,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Error al proponer')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="mt-1 text-xs text-miski-green font-medium">Propuesta de sustitución enviada al cliente.</p>
  }

  return (
    <div className="mt-1 space-y-1">
      <button
        onClick={fetchCandidates}
        disabled={loading}
        className="text-xs font-medium border border-miski-border text-miski-forest rounded px-2 py-1 hover:bg-miski-green-soft disabled:opacity-50"
      >
        {loading ? 'Buscando…' : 'Proponer producto alternativo'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {open && !loading && (
        <div className="mt-1 space-y-2 border border-miski-border rounded-lg p-2 bg-miski-cream/30">
          {candidates.length === 0 ? (
            <p className="text-xs text-red-600">Sin productos alternativos con stock suficiente</p>
          ) : !selected ? (
            candidates.map(c => (
              <div key={c.publicationId} className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-medium text-miski-tinta">{c.productName}</span>
                <span className="text-gray-500">{c.supplierName}</span>
                <span className="text-gray-500">{c.availableQty} {c.unit} · {formatCurrency(c.minimumPrice)}/{c.unit}</span>
                <button
                  onClick={() => selectCandidate(c)}
                  className="ml-auto border border-miski-border text-miski-forest rounded px-2 py-0.5 hover:bg-miski-green-soft"
                >
                  Elegir
                </button>
              </div>
            ))
          ) : (
            <div className="space-y-2 text-xs">
              <p className="text-miski-tinta">
                Sustituir <span className="font-medium">{item.productName}</span> por{' '}
                <span className="font-medium">{selected.productName}</span> ({item.quantity} {selected.unit})
              </p>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Precio unit. (S/, máx {formatCurrency(item.unitPrice)})</span>
                <input
                  type="number"
                  min={selected.minimumPrice}
                  max={item.unitPrice}
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-24 border border-miski-border rounded px-2 py-1 text-miski-tinta focus:outline-none focus:ring-2 focus:ring-miski-green/40"
                />
              </label>
              <p className="text-gray-500">
                Si es menor a {formatCurrency(item.unitPrice)}, la diferencia va como crédito de billetera (aprueba superadmin).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="border border-miski-green text-white bg-miski-green rounded px-3 py-1 hover:bg-miski-forest disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Proponer al cliente'}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="border border-miski-border text-miski-forest rounded px-2 py-1 hover:bg-miski-green-soft"
                >
                  Cambiar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

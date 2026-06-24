'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface OfferingCycle { id: string; dispatch_date: string; region_id: string }
export interface OfferingProduct { id: string; name: string; unit: string }
export interface ExistingOffering { product_id: string; expected_quantity: number; sale_price: number }

interface Row { qty: string; price: string }

interface Props {
  cycles: OfferingCycle[]
  products: OfferingProduct[]
  initialOfferings: ExistingOffering[]
  canCreateCycle: boolean
}

function toRows(offerings: ExistingOffering[]): Record<string, Row> {
  const map: Record<string, Row> = {}
  for (const o of offerings) map[o.product_id] = { qty: String(o.expected_quantity), price: String(o.sale_price) }
  return map
}

export function OfferingsManager({ cycles, products, initialOfferings, canCreateCycle }: Props) {
  const router = useRouter()
  const [cycleId, setCycleId] = useState<string>(cycles[0]?.id ?? '')
  const [rows, setRows] = useState<Record<string, Row>>(toRows(initialOfferings))
  const [savingId, setSavingId] = useState<string>('')
  const [savedId, setSavedId] = useState<string>('')
  const [error, setError] = useState('')
  const [newDate, setNewDate] = useState('')
  const [creating, setCreating] = useState(false)

  async function selectCycle(id: string) {
    setCycleId(id)
    setError('')
    if (!id) { setRows({}); return }
    const res = await fetch(`/api/operator/offerings?cycleId=${id}`)
    if (res.ok) {
      const data = (await res.json()) as ExistingOffering[]
      setRows(toRows(data))
    }
  }

  async function createCycle() {
    if (!newDate || creating) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/operator/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_date: newDate }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al crear el ciclo')
        return
      }
      router.refresh()
    } catch { setError('Error de conexión') } finally { setCreating(false) }
  }

  function setRow(productId: string, patch: Partial<Row>) {
    setRows(prev => {
      const base = prev[productId] ?? { qty: '', price: '' }
      return { ...prev, [productId]: { ...base, ...patch } }
    })
  }

  async function saveRow(productId: string) {
    const row = rows[productId]
    const qty = Number(row?.qty), price = Number(row?.price)
    if (!(qty > 0) || !(price > 0)) { setError('Cantidad y precio deben ser mayores a 0'); return }
    setSavingId(productId); setError(''); setSavedId('')
    try {
      const res = await fetch('/api/operator/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, productId, expected_quantity: qty, sale_price: price }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al guardar')
        return
      }
      setSavedId(productId)
    } catch { setError('Error de conexión') } finally { setSavingId('') }
  }

  if (cycles.length === 0) {
    return (
      <div className="max-w-md bg-white rounded-2xl border border-miski-border p-5">
        <p className="text-sm text-miski-muted mb-3">No hay un ciclo abierto.</p>
        {canCreateCycle ? (
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-miski-muted">
              Fecha de despacho
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="mt-1 w-full border border-miski-border rounded-lg px-3 py-2 text-sm" />
            </label>
            <button onClick={createCycle} disabled={creating || !newDate}
              className="py-2 px-4 rounded-lg text-sm font-semibold text-white bg-miski-green hover:bg-miski-forest disabled:opacity-50">
              {creating ? 'Abriendo…' : 'Abrir ciclo'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-miski-muted">Un operador debe abrir un ciclo para su región.</p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-xs text-xs text-miski-muted">
        Ciclo
        <select value={cycleId} onChange={e => selectCycle(e.target.value)}
          className="mt-1 w-full border border-miski-border rounded-lg px-3 py-2 text-sm">
          {cycles.map(c => <option key={c.id} value={c.id}>Despacho {c.dispatch_date}</option>)}
        </select>
      </label>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>}

      <div className="bg-white rounded-2xl border border-miski-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-miski-green-soft text-miski-forest/70 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Producto</th>
              <th className="text-left px-4 py-2 w-32">Cantidad</th>
              <th className="text-left px-4 py-2 w-32">Precio venta</th>
              <th className="px-4 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const row = rows[p.id] ?? { qty: '', price: '' }
              return (
                <tr key={p.id} className="border-t border-miski-border">
                  <td className="px-4 py-2 text-miski-forest">{p.name} <span className="text-xs text-miski-muted">/{p.unit}</span></td>
                  <td className="px-4 py-2">
                    <input type="number" min="0" step="0.001" value={row.qty}
                      onChange={e => setRow(p.id, { qty: e.target.value })}
                      className="w-28 border border-miski-border rounded px-2 py-1" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" min="0" step="0.01" value={row.price}
                      onChange={e => setRow(p.id, { price: e.target.value })}
                      className="w-28 border border-miski-border rounded px-2 py-1" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => saveRow(p.id)} disabled={savingId === p.id}
                      className="py-1 px-3 rounded-lg text-xs font-semibold text-white bg-miski-green hover:bg-miski-forest disabled:opacity-50">
                      {savingId === p.id ? '…' : savedId === p.id ? '✓' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

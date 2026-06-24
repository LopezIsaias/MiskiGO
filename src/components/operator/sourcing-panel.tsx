'use client'

import { useState } from 'react'

export interface SourcingCycle { id: string; dispatch_date: string; region_id: string }
export interface SourcingSupplier { id: string; full_name: string }
export interface SourcingProduct { id: string; name: string; unit: string }

interface Props {
  cycles: SourcingCycle[]
  suppliers: SourcingSupplier[]
  products: SourcingProduct[]
}

export function SourcingPanel({ cycles, suppliers, products }: Props) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [assignResult, setAssignResult] = useState('')

  if (cycles.length === 0) {
    return <p className="text-sm text-miski-muted">No hay ciclos abiertos. Abre uno en “Ofertas del ciclo”.</p>
  }

  async function capture() {
    setError(''); setMsg('')
    if (!supplierId || !productId || !(Number(qty) > 0) || !(Number(price) > 0)) {
      setError('Completa proveedor, producto, cantidad y precio (> 0).'); return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/operator/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, supplierId, productId, quantity: Number(qty), minimum_price: Number(price) }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === 'string' ? d.error : 'Error al capturar'); return
      }
      const prod = products.find(p => p.id === productId)
      setMsg(`Oferta registrada: ${qty} ${prod?.unit ?? ''} de ${prod?.name ?? ''}.`)
      setQty(''); setPrice('')
    } catch { setError('Error de conexión') } finally { setBusy(false) }
  }

  async function assignCycle() {
    setError(''); setAssignResult('')
    if (!confirm('Asignar todos los pedidos confirmados del ciclo a la oferta capturada?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/operator/cycle/${cycleId}/assign`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { setError(typeof d.error === 'string' ? d.error : 'Error al asignar'); return }
      setAssignResult(`Pedidos: ${d.orders}. Ítems asignados: ${d.assigned}, fallidos: ${d.failed}, pendientes: ${d.pending}. Reembolsos propuestos: ${d.refundsProposed ?? 0}.`)
    } catch { setError('Error de conexión') } finally { setBusy(false) }
  }

  const field = 'mt-1 w-full border border-miski-border rounded-lg px-3 py-2 text-sm'

  return (
    <div className="max-w-xl space-y-5">
      <label className="block text-xs text-miski-muted">
        Ciclo
        <select value={cycleId} onChange={e => setCycleId(e.target.value)} className={field}>
          {cycles.map(c => <option key={c.id} value={c.id}>Despacho {c.dispatch_date}</option>)}
        </select>
      </label>

      <div className="bg-white rounded-xl border border-miski-border p-5 space-y-3">
        <h2 className="text-sm font-bold text-miski-forest">Registrar oferta de proveedor</h2>
        <label className="block text-xs text-miski-muted">
          Proveedor
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={field}>
            <option value="">— elige —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-miski-muted">
          Producto
          <select value={productId} onChange={e => setProductId(e.target.value)} className={field}>
            <option value="">— elige —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} /{p.unit}</option>)}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-xs text-miski-muted">
            Cantidad
            <input type="number" min="0" step="0.001" value={qty} onChange={e => setQty(e.target.value)} className={field} />
          </label>
          <label className="flex-1 text-xs text-miski-muted">
            Precio mínimo (proveedor)
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={field} />
          </label>
        </div>
        <button onClick={capture} disabled={busy}
          className="py-2 px-4 rounded-lg text-sm font-semibold text-white bg-miski-green hover:bg-miski-forest disabled:opacity-50">
          {busy ? '…' : 'Registrar oferta'}
        </button>
        {msg && <p className="text-xs text-miski-forest bg-miski-lime/20 border border-miski-lime/40 rounded-lg px-3 py-1.5">{msg}</p>}
      </div>

      <div className="bg-white rounded-xl border border-miski-border p-5 space-y-3">
        <h2 className="text-sm font-bold text-miski-forest">Asignar pedidos del ciclo</h2>
        <p className="text-xs text-miski-muted">Asigna los pedidos confirmados a la oferta capturada (cheapest-first).</p>
        <button onClick={assignCycle} disabled={busy}
          className="py-2 px-4 rounded-lg text-sm font-semibold text-white bg-miski-green hover:bg-miski-forest disabled:opacity-50">
          {busy ? '…' : 'Asignar pedidos'}
        </button>
        {assignResult && <p className="text-xs text-miski-forest bg-miski-lime/20 border border-miski-lime/40 rounded-lg px-3 py-1.5">{assignResult}</p>}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { SupplierReceptionForm } from './supplier-reception-form'

export interface ReceptionItemData {
  productId: string
  productName: string
  unit: string
  expectedQty: number
  alreadyRecorded: boolean
}

export interface ReceptionSupplierData {
  supplierId: string
  supplierName: string
  items: ReceptionItemData[]
  isComplete: boolean
}

interface Props {
  suppliers: ReceptionSupplierData[]
  cycleId: string
  deliveryPersonId: string
}

export function ReceptionBoard({ suppliers, cycleId, deliveryPersonId }: Props) {
  const [openSupplierId, setOpenSupplierId] = useState<string | null>(
    // Auto-open first pending supplier
    suppliers.find(s => !s.isComplete)?.supplierId ?? null
  )

  function toggle(id: string) {
    setOpenSupplierId(prev => (prev === id ? null : id))
  }

  return (
    <div className="divide-y divide-gray-100">
      {suppliers.map(supplier => {
        const isOpen = openSupplierId === supplier.supplierId
        const pendingCount = supplier.items.filter(i => !i.alreadyRecorded).length

        return (
          <div key={supplier.supplierId} className="bg-white">
            {/* Supplier header — tap to expand */}
            <button
              className="w-full text-left px-4 py-4 flex items-center justify-between gap-3"
              onClick={() => toggle(supplier.supplierId)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  supplier.isComplete ? 'bg-green-500' : 'bg-amber-400'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {supplier.supplierName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {supplier.items.length} producto{supplier.items.length > 1 ? 's' : ''}
                    {supplier.isComplete
                      ? ' · Registrado'
                      : pendingCount > 0
                        ? ` · ${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`
                        : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {supplier.isComplete && (
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    ✓ Listo
                  </span>
                )}
                <span className="text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded form */}
            {isOpen && (
              <div className="border-t border-gray-50 bg-gray-50 px-4 pb-5 pt-4">
                {supplier.isComplete ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-green-600 font-medium">Recepción registrada correctamente.</p>
                    <p className="text-xs text-gray-400 mt-1">Todos los productos de este proveedor han sido recibidos.</p>
                  </div>
                ) : (
                  <SupplierReceptionForm
                    supplier={supplier}
                    cycleId={cycleId}
                    deliveryPersonId={deliveryPersonId}
                    onSuccess={() => {
                      // Collapse after success — page will refresh with updated data
                      setOpenSupplierId(null)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

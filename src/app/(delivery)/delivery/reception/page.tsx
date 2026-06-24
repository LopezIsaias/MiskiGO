import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MobileHeader } from '@/components/delivery/mobile-header'
import { DeliveryNav } from '@/components/delivery/delivery-nav'
import { ReceptionBoard } from '@/components/delivery/reception-board'
import type { ReceptionSupplierData } from '@/components/delivery/reception-board'
import { formatDate } from '@/lib/utils'

type RawAssignment = {
  id: string
  assigned_quantity: number
  supplier_id: string
  supplier: { id: string; full_name: string } | null
  order_item: {
    id: string
    product_id: string
    product: { name: string; unit: string } | null
    order: { dispatch_cycle_id: string } | null
  } | null
}

export default async function ReceptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['delivery', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // Active cycle: prefer in_progress, fallback to closed
  const { data: cycles } = await adminClient
    .from('dispatch_cycles')
    .select('id, dispatch_date, status')
    .in('status', ['in_progress', 'closed'])
    .order('dispatch_date', { ascending: false })
    .limit(1)

  const cycle = cycles?.[0] ?? null

  if (!cycle) {
    return (
      <div>
        <MobileHeader title="Recepción" />
        <DeliveryNav />
        <div className="p-6 text-center">
          <p className="text-miski-muted text-sm mt-8">No hay ciclos activos con pedidos asignados.</p>
        </div>
      </div>
    )
  }

  const cycleId = cycle.id
  const cycleLabel = `Ciclo ${formatDate(cycle.dispatch_date + 'T12:00:00')}`

  // Get all confirmed assignments for the active cycle
  const { data: rawAssignments } = await adminClient
    .from('order_item_assignments')
    .select(`
      id,
      assigned_quantity,
      supplier_id,
      supplier:users!supplier_id(id, full_name),
      order_item:order_items!order_item_id(
        id,
        product_id,
        product:products!product_id(name, unit),
        order:orders!order_id(dispatch_cycle_id)
      )
    `)
    .eq('status', 'confirmed')

  const assignments = ((rawAssignments ?? []) as unknown as RawAssignment[])
    .filter(a => a.order_item?.order?.dispatch_cycle_id === cycleId)

  // Get reception records already completed for this cycle (any delivery person)
  const { data: existingRecords } = await adminClient
    .from('reception_records')
    .select('supplier_id, product_id')
    .eq('dispatch_cycle_id', cycleId)

  const recordedSet = new Set(
    (existingRecords ?? []).map(r => `${r.supplier_id}::${r.product_id}`)
  )

  // Aggregate by supplier → products
  const supplierMap = new Map<string, ReceptionSupplierData>()

  for (const asgn of assignments) {
    if (!asgn.supplier || !asgn.order_item?.product) continue

    const supplierId = asgn.supplier_id
    const productId = asgn.order_item.product_id
    const productName = asgn.order_item.product.name
    const unit = asgn.order_item.product.unit ?? ''

    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, {
        supplierId,
        supplierName: asgn.supplier.full_name,
        items: [],
        isComplete: false,
      })
    }

    const supplier = supplierMap.get(supplierId)!
    const existing = supplier.items.find(i => i.productId === productId)

    if (existing) {
      existing.expectedQty = Math.round((existing.expectedQty + asgn.assigned_quantity) * 1000) / 1000
    } else {
      supplier.items.push({
        productId,
        productName,
        unit,
        expectedQty: asgn.assigned_quantity,
        alreadyRecorded: recordedSet.has(`${supplierId}::${productId}`),
      })
    }
  }

  // Mark supplier complete if all items already recorded
  const suppliers: ReceptionSupplierData[] = [...supplierMap.values()].map(s => ({
    ...s,
    isComplete: s.items.length > 0 && s.items.every(i => i.alreadyRecorded),
  }))

  // Sort: pending first, then by supplier name
  suppliers.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1
    return a.supplierName.localeCompare(b.supplierName)
  })

  const pendingCount = suppliers.filter(s => !s.isComplete).length

  return (
    <div>
      <MobileHeader title="Recepción" subtitle={cycleLabel} />
      <DeliveryNav />
      <div className="px-4 py-3 bg-white border-b border-miski-border">
        <p className="text-xs text-miski-muted">
          {pendingCount === 0
            ? 'Todos los proveedores registrados ✓'
            : `${pendingCount} proveedor${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''}`}
        </p>
      </div>
      {suppliers.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-miski-muted text-sm mt-4">
            No hay asignaciones confirmadas para este ciclo.
          </p>
        </div>
      ) : (
        <ReceptionBoard suppliers={suppliers} cycleId={cycleId} deliveryPersonId={user.id} />
      )}
    </div>
  )
}

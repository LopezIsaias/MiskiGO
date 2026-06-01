import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DateFilter }            from '@/components/admin/dashboard/date-filter'
import { SummaryCards }           from '@/components/admin/dashboard/summary-cards'
import { SalesChart }             from '@/components/admin/dashboard/sales-chart'
import { TopProductsChart }       from '@/components/admin/dashboard/top-products-chart'
import { TopSuppliersChart }      from '@/components/admin/dashboard/top-suppliers-chart'
import { RecentOrdersTable }      from '@/components/admin/dashboard/recent-orders-table'
import { QualityIndicators }      from '@/components/admin/dashboard/quality-indicators'
import { ProfitabilitySection }   from '@/components/admin/dashboard/profitability-section'
import type { SalePoint }         from '@/components/admin/dashboard/sales-chart'
import type { TopProduct }        from '@/components/admin/dashboard/top-products-chart'
import type { TopSupplier }       from '@/components/admin/dashboard/top-suppliers-chart'
import type { RecentOrder }       from '@/components/admin/dashboard/recent-orders-table'
import type { ProfitabilityCycle } from '@/components/admin/dashboard/profitability-section'

export const metadata: Metadata = { title: 'Dashboard' }

// ─── helpers ────────────────────────────────────────────────────────────────

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(mon.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── types ──────────────────────────────────────────────────────────────────

type RawProfitAssignment = {
  platform_margin_frozen: number
  assigned_quantity:      number
  status:                 string
  order_item: {
    unit_price_frozen: number
    order: { dispatch_cycle_id: string; dispatch_cycle: { dispatch_date: string } | null } | null
    product: { category: { operational_cost_pct: number } | null } | null
  } | null
}

type Assignment = {
  assigned_quantity:     number
  supplier_id:           string
  platform_margin_frozen: number
  status:                string
  supplier:              { full_name: string } | null
}

type Item = {
  quantity: number
  product:  { name: string; unit: string } | null
  assignments: Assignment[]
}

type RawOrder = {
  id:             string
  status:         string
  total_amount:   number
  created_at:     string
  delivered_at:   string | null
  customer:       { full_name: string } | null
  dispatch_cycle: { dispatch_date: string } | null
  items:          Item[]
}

// ─── aggregation ────────────────────────────────────────────────────────────

const ACTIVE   = ['confirmed', 'assigned', 'in_transit', 'delivered', 'completed']
const FAILED   = ['failed', 'cancelled']
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function buildSalesByDay(orders: RawOrder[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const o of orders) {
    if (!ACTIVE.includes(o.status)) continue
    const d = o.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + o.total_amount)
  }
  return map
}

function fillRange(map: Map<string, number>, from: string, to: string): SalePoint[] {
  const pts: SalePoint[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur <= end) {
    const key = toISO(cur)
    pts.push({ date: key, current: map.get(key) ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return pts
}

function weekSalesByDayIndex(orders: RawOrder[]): number[] {
  const arr = new Array<number>(7).fill(0)
  for (const o of orders) {
    if (!ACTIVE.includes(o.status)) continue
    const d = new Date(o.created_at)
    const idx = (d.getDay() + 6) % 7  // Mon=0 … Sun=6
    arr[idx] += o.total_amount
  }
  return arr
}

function computeMetrics(
  orders:     RawOrder[],
  claimsCount: number,
  prevOrders?: RawOrder[],
  fromDate?:  string,
  toDate?:    string,
  isWeek?:    boolean,
) {
  const active  = orders.filter(o => ACTIVE.includes(o.status))
  const totalRevenue   = active.reduce((s, o) => s + o.total_amount, 0)
  const orderCount     = active.length
  const avgTicket      = orderCount > 0 ? totalRevenue / orderCount : 0
  const failedOrders   = orders.filter(o => FAILED.includes(o.status)).length

  // Platform margin + all non-failed assignments
  let platformMargin = 0
  const allAssignments: Assignment[] = []
  for (const o of active) {
    for (const item of o.items) {
      for (const a of item.assignments) {
        if (a.status !== 'failed') {
          platformMargin += a.platform_margin_frozen
          allAssignments.push(a)
        }
      }
    }
  }

  // Sales chart data
  let salesData: SalePoint[]
  if (isWeek && prevOrders) {
    const curByDay  = weekSalesByDayIndex(orders)
    const prevByDay = weekSalesByDayIndex(prevOrders)
    salesData = DAY_NAMES.map((day, i) => ({
      date:     day,
      current:  curByDay[i] ?? 0,
      previous: prevByDay[i] ?? 0,
    }))
  } else {
    const map = buildSalesByDay(orders)
    salesData = fromDate && toDate ? fillRange(map, fromDate, toDate) : []
  }

  // Top 5 products
  const prodMap = new Map<string, { name: string; unit: string; qty: number }>()
  for (const o of active) {
    for (const item of o.items) {
      if (!item.product) continue
      const key = item.product.name
      const ex  = prodMap.get(key)
      if (ex) { ex.qty += item.quantity }
      else prodMap.set(key, { name: item.product.name, unit: item.product.unit, qty: item.quantity })
    }
  }
  const topProducts: TopProduct[] = Array.from(prodMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map(p => ({ name: p.name, unit: p.unit, totalQty: p.qty }))

  // Top 5 suppliers
  const suppMap = new Map<string, { name: string; qty: number }>()
  for (const o of active) {
    for (const item of o.items) {
      for (const a of item.assignments) {
        if (a.status === 'failed' || !a.supplier) continue
        const ex = suppMap.get(a.supplier_id)
        if (ex) { ex.qty += a.assigned_quantity }
        else suppMap.set(a.supplier_id, { name: a.supplier.full_name, qty: a.assigned_quantity })
      }
    }
  }
  const topSuppliers: TopSupplier[] = Array.from(suppMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map(s => ({ name: s.name, totalQty: s.qty }))

  // Recent orders (latest 10, all statuses)
  const recentOrders: RecentOrder[] = orders.slice(0, 10).map(o => ({
    id:           o.id,
    status:       o.status,
    customerName: o.customer?.full_name ?? '—',
    total:        o.total_amount,
    createdAt:    o.created_at,
  }))

  // Quality indicators
  const deliveredCount = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length
  const claimRate      = deliveredCount > 0 ? (claimsCount / deliveredCount) * 100 : 0

  const finalAssignments = allAssignments.filter(a => a.status !== 'pending')
  const successCount     = finalAssignments.filter(a => ['confirmed', 'shipped'].includes(a.status)).length
  const supplierFulfillmentRate =
    finalAssignments.length > 0 ? (successCount / finalAssignments.length) * 100 : 100

  const withCycle = orders.filter(o =>
    ['delivered', 'completed'].includes(o.status) &&
    o.delivered_at &&
    o.dispatch_cycle?.dispatch_date,
  )
  const onTime = withCycle.filter(o =>
    o.delivered_at!.slice(0, 10) <= o.dispatch_cycle!.dispatch_date,
  ).length
  const onTimeDeliveryRate = withCycle.length > 0 ? (onTime / withCycle.length) * 100 : 100

  return {
    totalRevenue, orderCount, avgTicket, platformMargin, failedOrders, claimsCount,
    salesData, topProducts, topSuppliers, recentOrders,
    claimRate, supplierFulfillmentRate, onTimeDeliveryRate,
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

const ORDER_SELECT = `
  id, status, total_amount, created_at, delivered_at,
  customer:users!customer_id(full_name),
  dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date),
  items:order_items(
    quantity,
    product:products!product_id(name, unit),
    assignments:order_item_assignments(
      assigned_quantity, supplier_id, platform_margin_frozen, status,
      supplier:users!supplier_id(full_name)
    )
  )
`

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, status').eq('id', user.id).maybeSingle()

  if (profile?.role !== 'superadmin' || profile?.status !== 'active') redirect('/login')

  // ── resolve date range ───────────────────────────────────────────────────
  const preset   = str(sp.preset) || 'last_30'
  const today    = new Date()
  today.setHours(0, 0, 0, 0)

  let fromDate = str(sp.from)
  let toDate   = str(sp.to)

  if (!fromDate || !toDate) {
    if (preset === 'this_week') {
      fromDate = toISO(getMonday(today))
      toDate   = toISO(today)
    } else if (preset === 'last_week') {
      const mon = getMonday(today)
      mon.setDate(mon.getDate() - 7)
      const sun = new Date(mon)
      sun.setDate(sun.getDate() + 6)
      fromDate = toISO(mon)
      toDate   = toISO(sun)
    } else {
      const f = new Date(today)
      f.setDate(f.getDate() - 29)
      fromDate = toISO(f)
      toDate   = toISO(today)
    }
  }

  const isCurrentWeek = preset === 'this_week'

  // ── queries ──────────────────────────────────────────────────────────────
  const adminClient = createAdminClient()

  const [{ data: rawOrders }, { count: claimsCount }, { data: rawProfitAsgns }] = await Promise.all([
    adminClient
      .from('orders')
      .select(ORDER_SELECT)
      .gte('created_at', fromDate)
      .lte('created_at', `${toDate}T23:59:59`)
      .order('created_at', { ascending: false }),
    adminClient
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fromDate)
      .lte('created_at', `${toDate}T23:59:59`),
    adminClient
      .from('order_item_assignments')
      .select(`
        platform_margin_frozen, assigned_quantity, status,
        order_item:order_items!order_item_id(
          unit_price_frozen,
          order:orders!order_id(
            dispatch_cycle_id,
            dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date)
          ),
          product:products!product_id(
            category:product_categories!category_id(operational_cost_pct)
          )
        )
      `)
      .in('status', ['confirmed', 'shipped'])
      .gte('created_at', fromDate)
      .lte('created_at', `${toDate}T23:59:59`),
  ])

  const orders = (rawOrders ?? []) as unknown as RawOrder[]

  // Previous week for comparison (only when this_week is selected)
  let prevOrders: RawOrder[] | undefined
  if (isCurrentWeek) {
    const curFrom = new Date(fromDate + 'T00:00:00')
    const prevFrom = new Date(curFrom)
    prevFrom.setDate(prevFrom.getDate() - 7)
    const prevTo = new Date(curFrom)
    prevTo.setDate(prevTo.getDate() - 1)

    const { data: rawPrev } = await adminClient
      .from('orders')
      .select(ORDER_SELECT)
      .gte('created_at', toISO(prevFrom))
      .lte('created_at', `${toISO(prevTo)}T23:59:59`)
      .order('created_at', { ascending: false })

    prevOrders = (rawPrev ?? []) as unknown as RawOrder[]
  }

  const data = computeMetrics(
    orders, claimsCount ?? 0, prevOrders, fromDate, toDate, isCurrentWeek,
  )

  // ── profitability ────────────────────────────────────────────────────────
  const profitAsgns = (rawProfitAsgns ?? []) as unknown as RawProfitAssignment[]

  let totalGrossMargin = 0
  let totalOpCost = 0
  const cycleMap = new Map<string, { label: string; gross: number; op: number }>()

  for (const a of profitAsgns) {
    const gross  = Number(a.platform_margin_frozen)
    const price  = Number(a.order_item?.unit_price_frozen ?? 0)
    const qty    = Number(a.assigned_quantity)
    const opPct  = Number(a.order_item?.product?.category?.operational_cost_pct ?? 0.22)
    const opCost = price * qty * opPct

    totalGrossMargin += gross
    totalOpCost      += opCost

    const cycleId = a.order_item?.order?.dispatch_cycle_id
    if (cycleId) {
      const dispatchDate = a.order_item?.order?.dispatch_cycle?.dispatch_date ?? cycleId.slice(0, 10)
      const label = dispatchDate
      if (!cycleMap.has(cycleId)) {
        cycleMap.set(cycleId, { label, gross: 0, op: 0 })
      }
      const entry = cycleMap.get(cycleId)!
      entry.gross += gross
      entry.op    += opCost
    }
  }

  const totalNetProfit = totalGrossMargin - totalOpCost

  const profitCycles: ProfitabilityCycle[] = Array.from(cycleMap.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(c => ({
      label:       c.label,
      grossMargin: Math.round(c.gross * 100) / 100,
      opCost:      Math.round(c.op   * 100) / 100,
      netProfit:   Math.round((c.gross - c.op) * 100) / 100,
    }))

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-miski-forest">Dashboard</h1>
          <p className="text-xs text-miski-olive mt-0.5">{fromDate} → {toDate}</p>
        </div>
        <DateFilter preset={preset} from={fromDate} to={toDate} />
      </div>

      {/* Section 1 — summary */}
      <SummaryCards
        totalRevenue={data.totalRevenue}
        orderCount={data.orderCount}
        avgTicket={data.avgTicket}
        platformMargin={data.platformMargin}
        failedOrders={data.failedOrders}
        claimsCount={data.claimsCount}
      />

      {/* Section 2 — sales chart */}
      <SalesChart data={data.salesData} isWeekComparison={isCurrentWeek} />

      {/* Section 3 — top products + top suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProductsChart data={data.topProducts} />
        <TopSuppliersChart data={data.topSuppliers} />
      </div>

      {/* Section 4 — recent orders + quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrdersTable orders={data.recentOrders} />
        <QualityIndicators
          claimRate={data.claimRate}
          supplierFulfillmentRate={data.supplierFulfillmentRate}
          onTimeDeliveryRate={data.onTimeDeliveryRate}
        />
      </div>

      {/* Section 5 — profitability */}
      <div className="pb-8">
        <ProfitabilitySection
          grossMargin={Math.round(totalGrossMargin * 100) / 100}
          opCost={Math.round(totalOpCost * 100) / 100}
          netProfit={Math.round(totalNetProfit * 100) / 100}
          cycles={profitCycles}
        />
      </div>
    </div>
  )
}

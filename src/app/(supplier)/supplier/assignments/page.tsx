import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AssignmentsBoard } from '@/components/supplier/assignments-board'
import type { AssignmentRow } from '@/components/supplier/assignments-board'

export const metadata: Metadata = { title: 'Pedidos asignados' }

type RawNotification = {
  id:         string
  title:      string | null
  body:       string
  created_at: string
  read_at:    string | null
}

export default async function SupplierAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['supplier', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  // Pending assignments for this supplier in active/open cycles
  const { data: rawAssignments } = await adminClient
    .from('order_item_assignments')
    .select(`
      id, assigned_quantity, supplier_price_frozen, status,
      order_item:order_items!order_item_id(
        product:products!product_id(name, unit),
        order:orders!order_id(
          id,
          dispatch_cycle:dispatch_cycles!dispatch_cycle_id(dispatch_date)
        )
      )
    `)
    .eq('supplier_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const assignments = (rawAssignments ?? []) as unknown as AssignmentRow[]

  // Recent notifications for this supplier
  const { data: rawNotifs } = await adminClient
    .from('notifications')
    .select('id, title, body, created_at, read_at')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const notifications = (rawNotifs ?? []) as unknown as RawNotification[]
  const unreadCount   = notifications.filter(n => !n.read_at).length

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-miski-forest">Pedidos asignados</h1>
        <p className="text-sm text-miski-muted mt-1">
          {assignments.length > 0
            ? `${assignments.length} pedido${assignments.length > 1 ? 's' : ''} pendiente${assignments.length > 1 ? 's' : ''} de confirmación`
            : 'Sin pedidos pendientes de confirmación'}
        </p>
      </div>

      <AssignmentsBoard assignments={assignments} />

      {/* Notifications section */}
      {notifications.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider mb-3">
            Notificaciones {unreadCount > 0 && (
              <span className="ml-1 bg-miski-forest text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`bg-white rounded-xl border px-4 py-3 ${
                  !n.read_at ? 'border-miski-green/30' : 'border-miski-border'
                }`}
              >
                {n.title && (
                  <p className="text-xs font-semibold text-miski-forest">{n.title}</p>
                )}
                <p className="text-xs text-gray-700 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-miski-muted/60 mt-1">
                  {new Date(n.created_at).toLocaleDateString('es-PE', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

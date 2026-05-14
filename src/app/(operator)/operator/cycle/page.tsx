import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CycleStatusControl } from '@/components/operator/cycle-status-control'

export default async function OperatorCyclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!['operator', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  const { data: cycles } = await adminClient
    .from('dispatch_cycles')
    .select('id, status, dispatch_date')
    .not('status', 'eq', 'completed')
    .order('dispatch_date', { ascending: false })
    .limit(5)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Ciclo de despacho</h1>
      <p className="text-sm text-gray-500 mb-6">
        Controla el estado del ciclo activo. Los cambios quedan registrados en el log de auditoría.
      </p>

      {!cycles || cycles.length === 0 ? (
        <p className="text-sm text-gray-500">No hay ciclos activos en este momento.</p>
      ) : (
        <div className="space-y-4 max-w-lg">
          <div className="text-xs text-gray-400 mb-1 px-1">
            Transiciones permitidas: Abierto → Cerrado → En progreso → Completado
          </div>
          {cycles.map(cycle => (
            <CycleStatusControl
              key={cycle.id}
              cycleId={cycle.id}
              currentStatus={cycle.status}
              dispatchDate={cycle.dispatch_date}
            />
          ))}
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StarRating } from '@/components/ui/star-rating'

const ROLE_LABELS: Record<string, string> = {
  superadmin:      'Superadmin',
  region_operator: 'Op. región',
  operator:        'Operador',
  delivery:        'Repartidor',
  supplier:        'Proveedor',
  customer:        'Cliente',
}

const ROLE_BADGE: Record<string, string> = {
  superadmin:      'bg-red-100 text-red-700',
  region_operator: 'bg-indigo-100 text-indigo-700',
  operator:        'bg-blue-100 text-blue-700',
  delivery:        'bg-purple-100 text-purple-700',
  supplier:        'bg-green-100 text-green-700',
  customer:        'bg-amber-100 text-amber-700',
}

type UserRow = {
  id: string; full_name: string; email: string; phone: string | null
  dni: string | null; role: string; status: string; reliability_score: number | null
  must_change_password: boolean | null; created_at: string
}

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: rawUsers, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, dni, role, status, reliability_score, must_change_password, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) notFound()

  const users = (rawUsers ?? []) as unknown as UserRow[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-miski-forest">Usuarios</h1>
          <p className="text-sm text-miski-muted mt-0.5">Todos los usuarios del sistema</p>
        </div>
        <Link
          href="/admin/users/new"
          className="bg-miski-forest text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-miski-green transition-all"
        >
          + Nuevo usuario
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-miski-muted text-sm">
          No hay operadores ni repartidores creados.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">DNI</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Email</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Confiabilidad</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-miski-tinta">Contraseña</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-miski-tinta">{u.dni ?? '—'}</td>
                  <td className="px-4 py-3 text-miski-tinta">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ROLE_BADGE[u.role] ?? 'bg-gray-100 text-miski-tinta'
                      }`}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'supplier' ? (
                      <StarRating score={Number(u.reliability_score ?? 100)} showPercent />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.status === 'active' ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.must_change_password ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        Debe cambiar
                      </span>
                    ) : (
                      <span className="text-miski-muted text-xs">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'superadmin' && (
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="text-miski-green hover:text-miski-forest font-medium text-xs"
                      >
                        Editar
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

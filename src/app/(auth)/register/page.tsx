import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, city')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Crear cuenta</h2>
      <p className="text-sm text-gray-500 mb-6">Para proveedores y clientes</p>
      <RegisterForm regions={regions ?? []} />
      <p className="text-center text-sm text-gray-500 mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-green-600 font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}

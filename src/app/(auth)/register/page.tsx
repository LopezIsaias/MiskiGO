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
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-miski-forest via-miski-green to-miski-lime" />
      <div className="p-8">
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold text-miski-forest tracking-tight">Miski GO</span>
        </div>
        <h2 className="text-xl font-bold text-miski-forest mb-1">Crear cuenta</h2>
        <p className="text-sm text-gray-400 mb-6">Para proveedores y clientes</p>
        <RegisterForm regions={regions ?? []} />
        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-miski-green hover:text-miski-forest font-medium transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

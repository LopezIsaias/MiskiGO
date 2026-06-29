import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <div className="bg-miski-hueso rounded-2xl shadow-2xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-miski-forest via-miski-green to-miski-lime" />
      <div className="p-8">
        <div className="text-center mb-6">
          <span className="font-display text-2xl font-extrabold text-miski-forest tracking-tight">Miski GO</span>
          <p className="font-display text-xs font-semibold text-miski-green mt-0.5">Del campo a tu mesa, sin escalas.</p>
        </div>
        <h2 className="font-display text-xl font-bold text-miski-forest mb-1">Crear cuenta</h2>
        <p className="text-sm text-miski-muted mb-6">Para proveedores y clientes</p>
        <RegisterForm />
        <p className="text-center text-sm text-miski-muted mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-miski-green hover:text-miski-forest font-semibold transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

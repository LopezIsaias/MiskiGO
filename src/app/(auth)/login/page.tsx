import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { SinEscalasRule } from '@/components/ui/sin-escalas-rule'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="bg-miski-hueso rounded-2xl shadow-2xl overflow-hidden">
      {/* Barra de acento superior */}
      <div className="h-1 bg-gradient-to-r from-miski-forest via-miski-green to-miski-lime" />

      <div className="px-8 pt-8 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="Miski GO" className="h-24 mx-auto mb-3 object-contain" />
        <p className="text-center font-display text-sm font-semibold text-miski-green mb-6">
          Del campo a tu mesa, sin escalas.
        </p>

        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-miski-forest">Bienvenido de vuelta</h2>
          <p className="text-sm text-miski-muted mt-0.5">Ingresa tus credenciales para continuar</p>
        </div>

        <LoginForm />

        <div className="mt-7">
          <SinEscalasRule from="campo" to="mesa" />
        </div>

        <p className="text-center text-sm text-miski-muted mt-5">
          ¿Eres proveedor o cliente?{' '}
          <Link
            href="/register"
            className="text-miski-green font-semibold hover:text-miski-forest transition-colors"
          >
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  )
}

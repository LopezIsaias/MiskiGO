import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      {/* Barra de acento superior */}
      <div className="h-1 bg-gradient-to-r from-miski-forest via-miski-green to-miski-lime" />

      <div className="px-8 pt-8 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="Miski GO" className="h-32 mx-auto mb-7 object-contain" />

        <div className="mb-6">
          <h2 className="text-xl font-bold text-miski-forest">Bienvenido de vuelta</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ingresa tus credenciales para continuar</p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-gray-400 mt-6">
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

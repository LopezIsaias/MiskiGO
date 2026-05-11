import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>
      <LoginForm />
      <p className="text-center text-sm text-gray-500 mt-6">
        ¿Eres proveedor o cliente?{' '}
        <Link href="/register" className="text-green-600 font-medium hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </div>
  )
}

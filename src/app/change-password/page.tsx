import { ChangePasswordForm } from '@/components/auth/change-password-form'

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Miski GO</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de gestión</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Cambiar contraseña</h2>
          <p className="text-sm text-gray-500 mb-6">
            Debes establecer una nueva contraseña antes de continuar.
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  )
}

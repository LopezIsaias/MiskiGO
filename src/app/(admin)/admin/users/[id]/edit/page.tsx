import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserForm } from '@/components/admin/user-form'
import { ResetPasswordForm } from '@/components/admin/reset-password-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!user) notFound()
  if (user.role === 'superadmin') redirect('/admin/users')

  return (
    <div>
      <h1 className="text-xl font-bold text-miski-forest mb-6">Editar usuario</h1>
      <UserForm user={user} />
      <div className="max-w-lg mt-0">
        <ResetPasswordForm userId={id} />
      </div>
    </div>
  )
}

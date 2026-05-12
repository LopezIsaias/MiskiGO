import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { error: authError } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const adminClient = createAdminClient()
  await adminClient
    .from('users')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}

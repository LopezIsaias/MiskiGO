import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserSchema } from '@/lib/validations/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (data?.role !== 'superadmin') return null
  return { supabase, userId: user.id }
}

export async function GET() {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { supabase } = ctx
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, dni, role, status, must_change_password, created_at')
    .in('role', ['operator', 'delivery'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { full_name, dni, email, phone, role, password } = parsed.data
  const { supabase, userId } = ctx
  const adminClient = createAdminClient()

  // Check DNI conflict
  const { data: existing } = await supabase
    .from('users')
    .select('id, role, email, full_name')
    .eq('dni', dni)
    .maybeSingle()

  if (existing) {
    if (existing.role === 'customer') {
      return NextResponse.json(
        {
          conflict: 'dni_customer',
          existing_user_id: existing.id,
          existing_email: existing.email,
          existing_name: existing.full_name,
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `El DNI ya está registrado como ${existing.role}` },
      { status: 409 },
    )
  }

  // Create auth user (trigger creates public.users row automatically)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, dni, phone: phone || null, role },
  })

  if (authError) {
    const isEmailDupe = authError.message.toLowerCase().includes('already registered')
    if (isEmailDupe) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const newUserId = authData.user.id

  // Set must_change_password = true (trigger has already created the row)
  const { error: updateError } = await adminClient
    .from('users')
    .update({ must_change_password: true })
    .eq('id', newUserId)

  if (updateError) {
    await adminClient.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Error al configurar usuario' }, { status: 500 })
  }

  // Audit log
  await adminClient.from('audit_log').insert({
    user_id: userId,
    role_at_time: 'superadmin',
    action: AUDIT_ACTIONS.USER_CREATED,
    module: AUDIT_MODULES.USERS,
    entity_type: 'user',
    entity_id: newUserId,
    new_value: { full_name, email, dni, role },
  })

  return NextResponse.json({ id: newUserId, full_name, email, role }, { status: 201 })
}

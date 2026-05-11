import { type NextRequest, NextResponse } from 'next/server'
import { registerApiSchema } from '@/lib/validations/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request inválido' }, { status: 400 })
  }

  const parsed = registerApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { role, full_name, email, phone, dni, ruc, region_id, password } = parsed.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('users')
    .select('role')
    .eq('dni', dni)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'DNI ya registrado', existingRole: existing.role },
      { status: 409 },
    )
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    const alreadyExists = authError?.message.includes('already registered')
    return NextResponse.json(
      { error: alreadyExists ? 'Email ya registrado' : 'Error al crear cuenta' },
      { status: alreadyExists ? 409 : 500 },
    )
  }

  const { error: profileError } = await admin.from('users').insert({
    id: authData.user.id,
    email,
    full_name,
    phone: phone ?? null,
    dni,
    ruc: ruc ?? null,
    region_id,
    role,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

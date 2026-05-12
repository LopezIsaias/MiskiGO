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

  // Pre-chequear DNI antes de crear el auth user (evita auth user huérfano)
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

  // Crear auth user con los datos de perfil en user_metadata.
  // El trigger handle_new_auth_user() los leerá de raw_user_meta_data
  // y creará automáticamente la fila en public.users (atómico).
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone: phone ?? '', dni, ruc: ruc ?? '', region_id, role },
  })

  if (authError || !authData.user) {
    const alreadyExists = authError?.message.includes('already registered')
    return NextResponse.json(
      { error: alreadyExists ? 'Email ya registrado' : 'Error al crear cuenta' },
      { status: alreadyExists ? 409 : 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

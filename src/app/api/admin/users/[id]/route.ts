import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateUserSchema } from '@/lib/validations/admin'
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/constants'
import { z } from 'zod'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (data?.role !== 'superadmin') return null
  return { supabase, userId: user.id }
}

// PUT: update full_name, phone, and optionally email (customer/supplier)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { full_name, phone, email } = parsed.data
  const { supabase } = ctx
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('users')
    .update({ full_name, phone: phone || null, updated_at: now })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (email) {
    const { data: existing } = await supabase
      .from('users')
      .select('email')
      .eq('id', id)
      .maybeSingle()

    if (email !== existing?.email) {
      const adminClient = createAdminClient()
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, { email })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
      const { error: emailError } = await adminClient.from('users').update({ email }).eq('id', id)
      if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('toggle_status') }),
  z.object({ action: z.literal('reset_password'), password: z.string().min(8, 'Mínimo 8 caracteres') }),
  z.object({
    action: z.literal('convert_role'),
    role: z.enum(['operator', 'delivery']),
    full_name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
])

// PATCH: toggle_status | reset_password | convert_role
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSuperadmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { supabase, userId } = ctx
  const adminClient = createAdminClient()
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local'

  if (parsed.data.action === 'toggle_status') {
    const { data: user } = await supabase
      .from('users')
      .select('status, full_name, role')
      .eq('id', id)
      .maybeSingle()

    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await adminClient.from('audit_log').insert({
      user_id: userId,
      role_at_time: 'superadmin',
      action: newStatus === 'suspended' ? AUDIT_ACTIONS.ACCOUNT_SUSPENDED : AUDIT_ACTIONS.ACCOUNT_REACTIVATED,
      module: AUDIT_MODULES.USERS,
      entity_type: 'user',
      entity_id: id,
      ip_address: ip,
      previous_value: { status: user.status },
      new_value: { status: newStatus },
    })

    return NextResponse.json({ status: newStatus })
  }

  if (parsed.data.action === 'reset_password') {
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      password: parsed.data.password,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    const { error } = await adminClient
      .from('users')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await adminClient.from('audit_log').insert({
      user_id: userId,
      role_at_time: 'superadmin',
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      module: AUDIT_MODULES.USERS,
      entity_type: 'user',
      entity_id: id,
      ip_address: ip,
    })

    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'convert_role') {
    const { role, full_name, email, phone } = parsed.data

    const { data: existingUser } = await supabase
      .from('users')
      .select('role, full_name, email')
      .eq('id', id)
      .maybeSingle()

    if (!existingUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (existingUser.role !== 'customer') {
      return NextResponse.json({ error: 'Solo se puede convertir cuentas de clientes' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('users')
      .update({
        role,
        must_change_password: true,
        updated_at: new Date().toISOString(),
        ...(full_name ? { full_name } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update email in auth.users if it changed
    if (email && email !== existingUser.email) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, { email })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
      await adminClient.from('users').update({ email }).eq('id', id)
    }

    await adminClient.from('audit_log').insert({
      user_id: userId,
      role_at_time: 'superadmin',
      action: AUDIT_ACTIONS.ROLE_CONVERTED,
      module: AUDIT_MODULES.USERS,
      entity_type: 'user',
      entity_id: id,
      ip_address: ip,
      previous_value: { role: existingUser.role },
      new_value: { role, ...(full_name ? { full_name } : {}), ...(email ? { email } : {}) },
    })

    return NextResponse.json({ success: true, role })
  }
}

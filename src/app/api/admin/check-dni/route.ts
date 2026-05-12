import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (data?.role !== 'superadmin') return null
  return supabase
}

export async function GET(request: NextRequest) {
  const supabase = await requireSuperadmin()
  if (!supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dni = request.nextUrl.searchParams.get('dni')
  if (!dni || !/^\d{8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  const { data } = await supabase
    .from('users')
    .select('id, role, full_name, email, phone')
    .eq('dni', dni)
    .maybeSingle()

  if (!data) return NextResponse.json({ exists: false })

  return NextResponse.json({
    exists: true,
    role: data.role,
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
  })
}

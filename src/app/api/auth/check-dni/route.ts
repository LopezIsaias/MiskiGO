import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const dni = request.nextUrl.searchParams.get('dni')

  if (!dni || !/^\d{8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role')
    .eq('dni', dni)
    .maybeSingle()

  return NextResponse.json(data ? { exists: true, role: data.role } : { exists: false })
}

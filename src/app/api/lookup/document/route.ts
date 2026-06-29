import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Consulta DNI/RUC en apisperu para autocompletar el comprobante en checkout.
// Server-side: mantiene el token fuera del cliente y evita CORS. Requiere sesión
// (no es un proxy abierto). Si la API falla o no encuentra, devuelve 404/502 y el
// cliente deja que el usuario escriba el nombre a mano — nunca bloquea el checkout.
const BASE = 'https://dniruc.apisperu.com/api/v1'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = process.env.APISPERU_TOKEN
  if (!token) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'dni' | 'ruc'
  const number = (searchParams.get('number') ?? '').trim()

  const isDni = type === 'dni' && /^\d{8}$/.test(number)
  const isRuc = type === 'ruc' && /^\d{11}$/.test(number)
  if (!isDni && !isRuc) {
    return NextResponse.json({ error: 'Documento inválido' }, { status: 422 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${BASE}/${type}/${number}?token=${token}`, {
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el documento' }, { status: 502 })
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  const data = (await upstream.json()) as Record<string, unknown>

  const name = isDni
    ? [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .join(' ')
        .trim()
    : typeof data.razonSocial === 'string'
      ? data.razonSocial.trim()
      : ''

  if (!name) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  return NextResponse.json({ name })
}

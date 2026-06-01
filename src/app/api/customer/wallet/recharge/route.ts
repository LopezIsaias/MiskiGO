import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  amount:        z.number().positive().max(10000),
  method:        z.enum(['yape', 'transfer']),
  proofUrl:      z.string().url(),
  photoMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, status, wallet_balance')
    .eq('id', user.id)
    .maybeSingle()

  if (!['customer', 'superadmin'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 422 })
  }

  const { amount, method, proofUrl, photoMetadata } = parsed.data
  const balanceBefore = Number(profile?.wallet_balance ?? 0)
  const now = new Date().toISOString()

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('wallet_transactions')
    .insert({
      user_id:        user.id,
      type:           'recharge',
      amount,
      balance_before: balanceBefore,
      balance_after:  balanceBefore + amount,
      proof_url:      proofUrl,
      photo_metadata: (photoMetadata ?? null) as never,
      status:         'pending',
      notes:          method === 'yape' ? 'Recarga vía Yape' : 'Recarga vía transferencia',
    })

  if (error) {
    return NextResponse.json({ error: 'Error al registrar la recarga' }, { status: 500 })
  }

  // Stale photo check
  const dateStr = photoMetadata?.DateTimeOriginal as string | undefined
  if (dateStr) {
    const taken = new Date(dateStr)
    const diffHours = (Date.now() - taken.getTime()) / (1000 * 60 * 60)
    if (diffHours > 2) {
      const { data: operators } = await adminClient
        .from('users')
        .select('id')
        .in('role', ['operator', 'superadmin'])
        .eq('status', 'active')
        .limit(5)
      if (operators && operators.length > 0) {
        await adminClient.from('notifications').insert(
          operators.map((op: { id: string }) => ({
            recipient_id:   op.id,
            type:           'stale_photo_warning',
            channel:        'in_app',
            title:          'Foto posiblemente no tomada en el momento del evento',
            body:           `Un comprobante de recarga incluye una foto tomada el ${taken.toLocaleString('es-PE')}. Verificar autenticidad.`,
            reference_type: 'wallet_transaction',
            reference_id:   null,
            status:         'sent',
            sent_at:        now,
          }))
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}

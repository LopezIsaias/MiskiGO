import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Solo usar en rutas de servidor. NUNCA exponer SUPABASE_SERVICE_ROLE_KEY al cliente.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

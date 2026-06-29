import type { createAdminClient } from './admin'

// ponytail: MVP de región única (San Martín). region_id ya existe en todo el schema,
// así que escalar a multi-región luego no se rompe; por ahora "la región" = la única
// activa. Si hubiera varias, toma la primera por nombre (determinista). Upgrade path:
// cuando exista region_operator, resolver por la región del usuario en vez de esta.
export async function getActiveRegionId(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await admin
    .from('regions')
    .select('id')
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

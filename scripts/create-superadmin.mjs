/**
 * Crea o repara el usuario superadmin en Supabase Auth.
 * Uso: node --env-file=.env.local scripts/create-superadmin.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPERADMIN_EMAIL    = 'admin@miskigo.com'
const SUPERADMIN_PASSWORD = 'MiskiAdmin2026!'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Busca el usuario por email listando los existentes
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })

if (listError) {
  console.error('No se pudo listar usuarios:', listError.message)
  process.exit(1)
}

const existing = list.users.find(u => u.email === SUPERADMIN_EMAIL)

if (existing) {
  // Repara la contraseña usando el Admin API (genera el hash correctamente)
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    existing.id,
    { password: SUPERADMIN_PASSWORD, email_confirm: true },
  )

  if (updateError) {
    console.error('Error al actualizar contraseña:', updateError.message)
    process.exit(1)
  }

  console.log('✓ Contraseña del superadmin reparada.')
  console.log('  UUID:    ', updated.user.id)
  console.log('  Email:   ', SUPERADMIN_EMAIL)
  console.log('  Password:', SUPERADMIN_PASSWORD)
  console.log('\n⚠  Cambia la contraseña en producción: Supabase Dashboard → Authentication → Users')
  process.exit(0)
}

// No existe — lo crea. El trigger handle_new_auth_user creará public.users.
console.log('Superadmin no encontrado. Creando...')
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: SUPERADMIN_EMAIL,
  password: SUPERADMIN_PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: 'Superadmin Miski GO', role: 'superadmin' },
})

if (createError) {
  console.error('Error al crear superadmin:', createError.message)
  process.exit(1)
}

console.log('✓ Superadmin creado.')
console.log('  UUID:    ', created.user.id)
console.log('  Email:   ', SUPERADMIN_EMAIL)
console.log('  Password:', SUPERADMIN_PASSWORD)

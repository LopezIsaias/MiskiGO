// Genera .env.test.local con las credenciales de Supabase local.
// Requiere haber corrido `npx supabase start`.
// Uso: npm run db:env
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

let raw
try {
  raw = execSync('npx supabase status -o env', { encoding: 'utf8' })
} catch (err) {
  console.error('No se pudo leer el estado de Supabase. ¿Corriste "npx supabase start"?')
  console.error(err.message)
  process.exit(1)
}

const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?\s*$/)
  if (m) env[m[1]] = m[2]
}

const url     = env.API_URL ?? 'http://127.0.0.1:54321'
const anon    = env.ANON_KEY
const service = env.SERVICE_ROLE_KEY

if (!anon || !service) {
  console.error('No se encontraron ANON_KEY / SERVICE_ROLE_KEY en el estado de Supabase.')
  process.exit(1)
}

const contents =
  `# Generado por scripts/gen-test-env.mjs — credenciales de Supabase LOCAL.\n` +
  `# NO subir a git. NO usar credenciales de producción aquí.\n` +
  `SUPABASE_TEST_URL=${url}\n` +
  `SUPABASE_TEST_ANON_KEY=${anon}\n` +
  `SUPABASE_TEST_SERVICE_ROLE_KEY=${service}\n`

writeFileSync('.env.test.local', contents, 'utf8')
console.log('.env.test.local generado. Ya puedes correr: npm run test:integration')

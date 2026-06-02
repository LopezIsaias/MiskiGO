import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

// Carga .env.test.local (si existe) sin depender de dotenv.
// Formato: KEY=value por línea; ignora comentarios (#) y líneas vacías.
function loadTestEnv(): Record<string, string> {
  const path = fileURLToPath(new URL('./.env.test.local', import.meta.url))
  const env: Record<string, string> = {}
  if (!existsSync(path)) return env
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    env: loadTestEnv(),
    // DB compartida: evitar carreras entre archivos.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

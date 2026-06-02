import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Solo unit tests. La integración vive en tests/integration y corre con su propia config.
    include: ['src/**/*.test.ts', 'tests/*.test.ts'],
    globals: true,
  },
})

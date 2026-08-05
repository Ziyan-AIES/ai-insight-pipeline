import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'netlify/functions/**/*.mjs'],
      exclude: ['src/main.tsx', 'src/demoData.ts'],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 25,
        lines: 30,
      },
    },
  },
})

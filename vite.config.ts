import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/folio/',
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
})

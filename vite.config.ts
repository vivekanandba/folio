import { defineConfig } from 'vite'

// Project Pages URL: https://<user>.github.io/folio/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/folio/',
})

import { defineConfig } from 'vite'
import react       from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // ── Vitest configuration ─────────────────────────────────────────────────
  test: {
    environment: 'jsdom',      // Simulate browser DOM
    globals:     true,         // Use describe/it/expect without imports
    setupFiles:  ['./src/test/setup.js'],
    include:     ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude:     ['e2e/**', '**/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov', 'html'],
      exclude:   ['node_modules/', 'src/test/', 'src/data/', 'dist/', 'e2e/'],
      thresholds: {
        statements: 70,
        branches:   55,
        functions:  70,
        lines:      70,
      },
    },
  },

  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api':     { target: 'http://backend:5000', changeOrigin: true },
      '/uploads': { target: 'http://backend:5000', changeOrigin: true },
    },
  },
})
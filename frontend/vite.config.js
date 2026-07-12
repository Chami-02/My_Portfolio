import { defineConfig } from 'vite'
import react       from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: true,   // Required for Docker port broadcasting
    port: 5173,

    proxy: {
      // Any request starting with /api is forwarded to the backend container
      '/api': {
        target:      'http://backend:5000',  // 'backend' = Docker service name in docker-compose.yml
        changeOrigin: true,
        // rewrite: (path) => path  // No rewriting needed — /api/projects stays /api/projects
      },
      // Forward uploaded file requests to backend as well
      '/uploads': {
        target:      'http://backend:5000',
        changeOrigin: true,
      },
    },
  },
})
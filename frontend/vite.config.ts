import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ports 5173 and 8000 are used by other course folders, so this project sits on 5183/8010.
// /api and /media are proxied to FastAPI so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly: Vite defaults to ::1 only, which tools probing
    // 127.0.0.1 (and the in-app preview) cannot reach.
    host: '127.0.0.1',
    port: 5183,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8010', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8010', changeOrigin: true },
    },
  },
})

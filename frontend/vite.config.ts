import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The backend port is configurable so the proxy follows wherever uvicorn runs.
// Default is 8000 (the canonical `uvicorn main:app --port 8000`); a local override
// lives in frontend/.env.local (git-ignored) when 8000 is occupied on this machine.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const target = env.VITE_API_TARGET || `http://127.0.0.1:${env.BACKEND_PORT || '8000'}`
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1', // Vite 8 binds ::1 only by default; tools probe 127.0.0.1
      port: 5183,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/media': { target, changeOrigin: true },
      },
    },
  }
})

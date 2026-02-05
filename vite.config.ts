import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/expo-push': {
        target: 'https://exp.host/--/api/v2/push/send',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/expo-push/, '')
      }
    }
  }
})

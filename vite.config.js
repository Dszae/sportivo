import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Whenever our app asks for /api, Vite secretly routes it to streamed.pk
      '/api': {
        target: 'https://streamed.pk',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
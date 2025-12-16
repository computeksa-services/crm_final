import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for assets so it works on any subdirectory/VPS
  server: {
    proxy: {
      '/api': {
        target: 'https://service.computeksa.com/webhook',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
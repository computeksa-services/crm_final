import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Ruta base absoluta para que React Router funcione correctamente
  server: {
    port: 5173,
    strictPort: false,
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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
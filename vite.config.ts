import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
      host: 'localhost',
      port: 3000,
      protocol: 'ws'
    },
    proxy: {
      '/api': {
        target: `${process.env.VITE_WEBHOOK_URL || 'https://gateway.computeksa.com'}/webhook`,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'crm.computeksa.com',
      '.computeksa.com'
    ]
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
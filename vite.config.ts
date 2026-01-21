import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  if (!env.VITE_WEBHOOK_URL) {
    throw new Error('❌ VITE_WEBHOOK_URL no está configurada en las variables de entorno. Por favor, configúrala en el archivo .env antes de ejecutar la aplicación.');
  }
  
  const baseUrl = env.VITE_WEBHOOK_URL

  return {
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
          // Forward to whatever is in VITE_WEBHOOK_URL; if it already includes '/webhook', keep it there.
          target: `${baseUrl}`,
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
  }
})

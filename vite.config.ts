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
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return null;
            
            // Estrategia simple: separar solo librerías muy pesadas que son independientes
            // Dejar que Rollup agrupe automáticamente las dependencias
            
            // 1. Excel - completamente independiente
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            
            // 2. Editores - independientes entre sí
            if (id.includes('react-quill')) {
              return 'vendor-quill';
            }
            if (id.includes('jodit')) {
              return 'vendor-jodit';
            }
            
            // 3. FullCalendar - independiente
            if (id.includes('@fullcalendar')) {
              return 'vendor-calendar';
            }
            
            // 4. Charts - independiente de React core
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            
            // Dejar que Rollup agrupe React y todo lo demás automáticamente
            // Esto evita ciclos de dependencia
          }
        }
      }
    }
  }
})

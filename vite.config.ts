import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  if (!env.VITE_WEBHOOK_URL) {
    throw new Error('❌ VITE_WEBHOOK_URL no está configurada en las variables de entorno. Por favor, configúrala en el archivo .env antes de ejecutar la aplicación.');
  }
  
  const baseUrl = env.VITE_WEBHOOK_URL

  // Reemplaza los accesos a import.meta.env.VITE_* por una lectura en tiempo
  // de ejecucion desde window.__APP_CONFIG__ (generado por docker-entrypoint.sh).
  // Asi una unica imagen sirve para cualquier entorno sin recompilar.
  // esbuild solo admite nombres de entidad (identificador o miembro), por eso
// se accede como window.__APP_CONFIG__.<CLAVE> y no con una expresion.
  const runtimeConfigExpr = (key: string) => `window.__APP_CONFIG__.${key}`;

  return {
    plugins: [react()],
    base: '/',
    define: {
      'import.meta.env.VITE_WEBHOOK_URL': runtimeConfigExpr('VITE_WEBHOOK_URL'),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': runtimeConfigExpr('VITE_GOOGLE_CLIENT_ID'),
      'import.meta.env.VITE_MICROSOFT_CLIENT_ID': runtimeConfigExpr('VITE_MICROSOFT_CLIENT_ID'),
      'import.meta.env.VITE_REDIRECT_URI': runtimeConfigExpr('VITE_REDIRECT_URI'),
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
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

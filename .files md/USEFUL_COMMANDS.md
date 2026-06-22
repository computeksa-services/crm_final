# 🛠️ Comandos y Scripts Útiles

## 🔍 Buscar Archivos Pendientes

### En VS Code
```
Ctrl+Shift+F (Find in Files)
Buscar: VITE_WEBHOOK_URL
Excluir: node_modules, .git
```

Esto mostrará todos los archivos que aún usan la URL legacy.

### En PowerShell
```powershell
# Buscar todos los fetch pendientes
grep -r "VITE_WEBHOOK_URL" pages/ --include="*.tsx" | grep -v ".bak"

# Buscar en específicos
grep -r "fetch(" pages/Deal*.tsx
grep -r "fetch(" pages/Quote*.tsx
grep -r "fetch(" pages/Financial*.tsx
```

## 🧪 Verificación Rápida

### Script para DevTools Console

```javascript
// Copiar todo esto y pegar en Console (F12)

console.clear();
console.log('=== GATEWAY VERIFICATION ===\n');

const appToken = localStorage.getItem('appToken');
const user = JSON.parse(localStorage.getItem('user') || '{}');

console.log('✓ appToken:', appToken ? 'EXISTE' : '❌ FALTA');
console.log('✓ Usuario:', user?.id_user ? 'EXISTE' : '❌ FALTA');
console.log('✓ ID Tenant:', user?.id_tenant ? user.id_tenant : '❌ FALTA');

// Ver token
if (appToken) {
  console.log('\nToken Preview:', appToken.substring(0, 50) + '...');
}

// Simular petición
if (appToken) {
  console.log('\n✓ Token listo para usar en Authorization header');
} else {
  console.log('\n❌ No hay token. Haz login primero.');
}
```

## 🔄 Testing de Endpoints

### Probar un endpoint manualmente

```javascript
// En DevTools Console

const token = localStorage.getItem('appToken');

// Test Tenants
fetch('https://gateway.computeksa.com/api/tenants?id_user=YOUR_ID', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e));
```

## 📝 Patrones de Búsqueda y Reemplazo

### VSCode Find & Replace

#### Patrón 1: Reemplazar imports
```
Find:
import { useAuth } from '../contexts/AuthContext';

Replace:
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';
```

#### Patrón 2: Reemplazar fetch simple GET
```
Find:
fetch(`\$\{import.meta.env.VITE_WEBHOOK_URL\}/api/([a-z/]+)\?(.+)`);

Replace:
apiFetch(buildUrl(GATEWAY_CONFIG.API.$1, { $2 }));
```

#### Patrón 3: Reemplazar fetch con body
```
Find:
fetch(`\$\{import.meta.env.VITE_WEBHOOK_URL\}/api/([a-z/]+)`, \{\s*method: 'POST',\s*headers: \{[^}]*\},\s*body: JSON.stringify\(([^)]+)\)

Replace:
apiFetch(GATEWAY_CONFIG.API.$1, {
  method: 'POST',
  body: JSON.stringify($2)
});
```

## 🧬 Snippets VSCode

Agregar a `.vscode/extensions.json`:

```json
{
  "apiCall": {
    "scope": "typescript,typescriptreact",
    "prefix": "apicall",
    "body": [
      "import { apiFetch } from '../services/apiClient';",
      "import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';",
      "",
      "const response = await apiFetch(",
      "  buildUrl(GATEWAY_CONFIG.API.$1, { $2 }),",
      "  { method: '$3' }",
      ");",
      "",
      "if (!response.ok) throw new Error('Error');",
      "const data = await response.json();",
      "$0"
    ],
    "description": "Gateway API call template"
  }
}
```

## 🚀 Commands útiles

### Verificar que no hay errores

```powershell
# En la carpeta del proyecto
npm run build

# O si usas TypeScript
npx tsc --noEmit
```

### Buscar "TODO" pendientes

```powershell
grep -r "TODO\|FIXME\|XXX" src/ --include="*.ts" --include="*.tsx"
```

### Listar archivos que usan VITE_WEBHOOK_URL

```powershell
grep -l "VITE_WEBHOOK_URL" pages/*.tsx components/*.tsx services/*.ts | Sort-Object
```

## 📊 Estadísticas del Proyecto

```powershell
# Contar líneas de código
Get-ChildItem -Path "src/" -Include "*.ts", "*.tsx" | 
  Measure-Object -Property Length -Sum | 
  Select-Object @{Name="Lines";Expression={[int]($_.Sum / 50)}}

# Contar archivos
(Get-ChildItem -Path "src/" -Include "*.ts", "*.tsx" | Measure-Object).Count

# Archivos modificados
git status --short
```

## 🔐 Testing de Seguridad

### Verificar que los tokens no se exponen

```bash
# Buscar donde se loguea el token
grep -r "console.log.*token" src/
grep -r "alert.*token" src/
grep -r "document.write.*token" src/
```

### Verificar CORS

```javascript
// En DevTools Console
fetch('https://gateway.computeksa.com/api/tenants', {
  method: 'OPTIONS',
  headers: {
    'Access-Control-Request-Headers': 'authorization'
  }
})
.then(r => console.log('CORS Headers:', r.headers))
.catch(e => console.error('CORS Error:', e));
```

## 🐛 Debugging

### Habilitar logs detallados

Agregar a `services/apiClient.ts`:

```typescript
const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) console.log('[apiFetch]', ...args);
}
```

### Interceptar respuestas

```javascript
// En DevTools
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Request:', args[0], args[1]);
  return originalFetch(...args)
    .then(r => {
      console.log('Response:', r.status, r.statusText);
      return r;
    });
};
```

## 📋 Checklist de Implementación

Para cada nuevo archivo que migres:

```
☐ Agregar imports de apiClient y gatewayConfig
☐ Buscar todos los fetch()
☐ Reemplazar por apiFetch()
☐ Reemplazar URLs por GATEWAY_CONFIG
☐ Usar buildUrl() para parámetros
☐ Verificar que no hay errores de compilación
☐ Probar en browser
☐ Verificar Network tab (Authorization header)
☐ Verificar que URLs usan https://gateway.computeksa.com
☐ Actualizar documentación si es necesario
☐ Hacer commit con mensaje claro
```

## 🎯 Flujo de Trabajo Recomendado

### Día 1: Verificación
```
1. Ejecutar GATEWAY_VERIFICATION_SCRIPT.js
2. Verificar todos los ✓
3. Probar login/logout
4. Probar CompaniesList (tenants)
```

### Día 2: Deals
```
1. Leer DEALS_MIGRATION_GUIDE.md
2. Migrar DealsList.tsx
3. Migrar DealDetail.tsx
4. Migrar DealCreate.tsx
5. Testing manual completo
```

### Día 3-5: Quotes, Financials, etc.
```
Seguir el mismo patrón que Deals
```

## 💾 Git Workflow

```bash
# Rama para tenants (ya hecho)
git checkout -b feature/gateway-integration-tenants

# Rama para deals
git checkout -b feature/gateway-integration-deals

# Commits claros
git commit -m "feat: migrate deals to gateway API"
git commit -m "docs: update deals migration documentation"

# Pull request
git push origin feature/gateway-integration-deals
```

## 📞 Troubleshooting Scripts

### Si el token desaparece

```javascript
// Verificar qué pasó
console.log('appToken:', localStorage.getItem('appToken'));
console.log('Debería tener un 401 en Network');

// Limpiar y hacer login de nuevo
localStorage.clear();
location.href = '/login';
```

### Si las URLs son incorrectas

```javascript
// Verificar configuración
import { GATEWAY_CONFIG } from './services/gatewayConfig';
console.log('Base URL:', GATEWAY_CONFIG.BASE_URL);
console.log('Tenants:', GATEWAY_CONFIG.API.TENANTS.LIST);
```

### Si los headers faltan

```javascript
// Verificar en Network tab
// Click en una request
// Headers → Request Headers
// Debe tener: Authorization: Bearer [token]
```

---

**Documento:** Comandos y Scripts Útiles  
**Versión:** 1.0  
**Fecha:** Enero 2026

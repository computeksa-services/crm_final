# Guía de Migración: Autenticación con Gateway

## 📋 Resumen de Cambios

Se ha implementado un nuevo flujo de autenticación que intercambia el token de OAuth (Google/Microsoft) por un token de aplicación (appToken) emitido por nuestro Gateway. Este token debe incluirse en todas las peticiones API.

## ✅ Archivos Ya Actualizados

### 1. **services/authService.ts** (NUEVO)
- Servicio para intercambiar tokens con el Gateway
- Métodos para guardar/obtener/eliminar el appToken

### 2. **services/apiClient.ts** (NUEVO)
- Cliente HTTP con interceptor automático
- Agrega el header `Authorization: Bearer [appToken]` a todas las peticiones
- Maneja automáticamente errores 401 (token expirado)

### 3. **contexts/AuthContext.tsx**
- Actualizado para usar `authService`
- Guarda el appToken en localStorage como 'appToken'
- Mantiene compatibilidad con token legacy

### 4. **pages/AuthCallbackPage.tsx**
- Implementa el flujo completo:
  1. Recibe código OAuth del proveedor
  2. Obtiene token OAuth del backend
  3. Intercambia token OAuth por appToken del Gateway
  4. Guarda appToken y datos de usuario

### 5. **services/financials.service.ts**
- Actualizado para usar `apiFetch` en lugar de `fetch`

### 6. **pages/Calendar.tsx**
- Todas las llamadas fetch actualizadas a `apiFetch`

## 🔧 Archivos Pendientes de Actualización

Los siguientes archivos tienen llamadas `fetch()` que necesitan actualizarse:

### Páginas de Deals
- `pages/DealsList.tsx` (4 llamadas)
- `pages/DealDetail.tsx` (2 llamadas)
- `pages/DealCreate.tsx` (1 llamada)

### Páginas de Quotes
- `pages/QuoteCreate.tsx` (4 llamadas)
- `pages/QuoteDetail.tsx` (21 llamadas)
- `pages/QuotesList.tsx` (verificar)

### Páginas de Financials
- `pages/FinancialCreate.tsx` (5 llamadas)
- `pages/FinancialDetail.tsx` (8 llamadas)
- `pages/FinancialForm.tsx` (6 llamadas)
- `pages/FinancialsList.tsx` (verificar)

### Páginas de Clientes y Contactos
- `pages/CompaniesList.tsx` (verificar)
- `pages/ClientCompaniesList.tsx` (verificar)
- `pages/ClientCompanyDetail.tsx` (verificar)
- `pages/ClientContactsList.tsx` (verificar)
- `pages/ClientContactDetail.tsx` (verificar)

### Otras Páginas
- `pages/UserProfile.tsx` (3 llamadas)
- `pages/UsersList.tsx` (verificar)
- `pages/ProductsList.tsx` (verificar)
- `pages/Dashboard.tsx` (verificar)
- `pages/SettingsPage.tsx` (verificar)

### Componentes
- Revisar todos los componentes en `components/` que hagan llamadas API

## 📝 Cómo Actualizar Cada Archivo

### Paso 1: Importar apiFetch

Al inicio del archivo, agregar:

\`\`\`typescript
import { apiFetch } from '../services/apiClient';
\`\`\`

### Paso 2: Reemplazar fetch por apiFetch

**ANTES:**
\`\`\`typescript
const response = await fetch(\`\${import.meta.env.VITE_WEBHOOK_URL}/api/deals\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
\`\`\`

**DESPUÉS:**
\`\`\`typescript
const response = await apiFetch(\`\${import.meta.env.VITE_WEBHOOK_URL}/api/deals\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
\`\`\`

### Paso 3: Eliminar headers Authorization manuales

Si algún archivo tiene headers de autorización manuales, eliminarlos:

**ANTES:**
\`\`\`typescript
const token = localStorage.getItem('token');
const response = await fetch(url, {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});
\`\`\`

**DESPUÉS:**
\`\`\`typescript
const response = await apiFetch(url, {
  headers: {
    'Content-Type': 'application/json'
  }
});
\`\`\`

## 🔍 Buscar Archivos Pendientes

Para encontrar todos los archivos que necesitan actualización, busca:

1. **En VSCode:**
   - Buscar: \`fetch(\\\`\${import.meta.env.VITE_WEBHOOK_URL}\`
   - En: Todo el workspace
   - Excluir: \`node_modules\`

2. **Desde terminal:**
   \`\`\`powershell
   grep -r "fetch(\\\`\\$\{import.meta.env.VITE_WEBHOOK_URL\}" pages/ components/
   \`\`\`

## ✨ Helpers Disponibles

El archivo `services/apiClient.ts` proporciona helpers para diferentes métodos HTTP:

\`\`\`typescript
import { apiGet, apiPost, apiPut, apiDelete, apiFetch } from '../services/apiClient';

// GET simple
const response = await apiGet(\`\${API_URL}/api/deals\`);

// POST con body
const response = await apiPost(\`\${API_URL}/api/deals\`, { name: 'Deal' });

// PUT con body
const response = await apiPut(\`\${API_URL}/api/deals/update\`, { id: 1, name: 'Updated' });

// DELETE
const response = await apiDelete(\`\${API_URL}/api/deals/1\`);

// Para casos más complejos (multipart, custom headers, etc.)
const response = await apiFetch(\`\${API_URL}/api/upload\`, {
  method: 'POST',
  body: formData
});
\`\`\`

## 🔐 Flujo de Autenticación

### Diagrama del Flujo

\`\`\`
Usuario → OAuth (Google/Microsoft) → AuthCallbackPage
                                           ↓
                                 1. Obtiene OAuth Token
                                           ↓
                                 2. POST a Gateway
                                    /auth/login
                                    { token, provider }
                                           ↓
                                 3. Gateway responde
                                    { token: appToken }
                                           ↓
                                 4. Guarda appToken
                                           ↓
                                 5. Todas las APIs usan
                                    Authorization: Bearer [appToken]
\`\`\`

### Almacenamiento

- **appToken**: `localStorage.getItem('appToken')` (nuevo sistema)
- **token**: `localStorage.getItem('token')` (legacy, compatibilidad temporal)
- **user**: `localStorage.getItem('user')` (objeto User)

## 🚨 Manejo de Errores

El `apiClient` maneja automáticamente:

- **401 Unauthorized**: Limpia tokens y redirige a `/login`
- **Otros errores**: Los propaga para manejo manual

## ✅ Testing

Para probar que la migración funciona:

1. **Logout completo**:
   \`\`\`javascript
   localStorage.clear();
   window.location.href = '/login';
   \`\`\`

2. **Login nuevamente** con Google/Microsoft

3. **Verificar en DevTools → Network**:
   - Todas las peticiones deben tener header: \`Authorization: Bearer [token]\`
   - El token debe ser el appToken del Gateway

4. **Verificar en DevTools → Console**:
   - Ver logs de AuthCallbackPage
   - Confirmar que se obtiene appToken del Gateway

5. **Verificar en DevTools → Application → LocalStorage**:
   - Debe existir \`appToken\`
   - Debe existir \`user\`

## 📦 Archivos Creados

\`\`\`
services/
  ├── authService.ts      # Servicio de autenticación con Gateway
  └── apiClient.ts        # Cliente HTTP con interceptor
\`\`\`

## 🎯 Próximos Pasos

1. ✅ Completar migración de todos los archivos listados
2. ⚠️ Eliminar código legacy cuando todo funcione
3. ✅ Actualizar tests si existen
4. ✅ Documentar endpoints del Gateway
5. ✅ Considerar refresh token si es necesario

## 💡 Consejos

- Actualiza un archivo a la vez
- Prueba cada cambio antes de continuar
- Usa multi_replace si tienes muchos cambios similares
- Mantén compatibilidad temporal con token legacy
- Revisa componentes compartidos primero

## 🐛 Troubleshooting

### Error: "Network Error" o "401 Unauthorized"
- Verificar que el appToken esté en localStorage
- Verificar que el Gateway esté respondiendo
- Verificar formato del header Authorization

### Error: "appToken undefined"
- El login puede no haberse completado correctamente
- Verificar flujo en AuthCallbackPage
- Verificar respuesta del Gateway en Network tab

### Error: "Cannot read property 'token'"
- Verificar estructura de respuesta del Gateway
- Revisar logs en AuthCallbackPage

---

**Fecha de creación**: Enero 2026  
**Versión**: 1.0  
**Estado**: Parcialmente implementado

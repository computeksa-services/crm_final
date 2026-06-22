# Configuración del Gateway - Verificación e Implementación

## ✅ Cambios Realizados

### 1. URLs del Gateway Centralizadas
**Archivo:** `services/gatewayConfig.ts`
- URL base: `https://gateway.computeksa.com`
- Auth endpoint: `/auth/login`
- Todos los endpoints de APIs bajo `/api/...`

### 2. Autenticación (Login)
**Archivo:** `services/authService.ts`
- Función: `exchangeToken(oauthToken, provider)`
- Endpoint: `POST https://gateway.computeksa.com/auth/login`
- Body: `{ "token": "[OAuth Token]", "provider": "google" | "microsoft" }`
- Response: `{ "token": "[appToken]", ... }`
- El appToken se guarda en `localStorage.appToken`

### 3. Cliente HTTP con Interceptor
**Archivo:** `services/apiClient.ts`
- Función: `apiFetch(url, options)`
- Automáticamente agrega header: `Authorization: Bearer [appToken]`
- Maneja errores 401 y redirige al login
- Helpers: `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()`

### 4. Archivos Actualizados para Tenants

#### ✅ `pages/CompaniesList.tsx`
- Lista de tenants: `GET /api/tenants?id_user=...`
- Crear tenant: `POST /api/tenants`
- Actualizar: `POST /api/tenants/update`
- Eliminar: `POST /api/tenants/delete`

#### ✅ `pages/UserProfile.tsx`
- Detalle tenant: `GET /api/tenants/detail?id_tenant=...`
- Email corporativo: `POST /api/tenants/email/corporative`
- Eliminar email: `POST /api/tenants/email/corporative/delete`

#### ✅ `pages/UserProfile_new.tsx`
- Mismo como UserProfile.tsx

#### ✅ `pages/AuthCallbackPage.tsx`
- Obtiene detalle del tenant después de login

#### ✅ `components/Layout.tsx`
- Carga nombre del tenant para mostrar en sidebar

#### ✅ `components/pages_marketing/CampaignWizard.tsx`
- Carga datos del tenant para marketing

## 🔄 Flujo de Autenticación

```
1. Usuario hace login con Google/Microsoft
   ↓
2. OAuth provider devuelve código
   ↓
3. AuthCallbackPage recibe el código
   ↓
4. Backend intercambia código por OAuth Token
   POST /api/auth/callback
   Response: { "token": "[OAuth Token]", "user": {...} }
   ↓
5. authService.exchangeToken(oauthToken, provider)
   POST https://gateway.computeksa.com/auth/login
   Body: { "token": "[OAuth Token]", "provider": "google" | "microsoft" }
   ↓
6. Gateway valida y devuelve appToken
   Response: { "token": "[appToken]" }
   ↓
7. appToken se guarda en localStorage.appToken
   ↓
8. Todas las peticiones futuras incluyen:
   Authorization: Bearer [appToken]
```

## 📋 Checklist de Verificación

### URLs Correctas
- [ ] Login: `https://gateway.computeksa.com/auth/login`
- [ ] Tenants: `https://gateway.computeksa.com/api/tenants`
- [ ] Detalle tenant: `https://gateway.computeksa.com/api/tenants/detail`
- [ ] Email settings: `https://gateway.computeksa.com/api/tenants/email/corporative`

### Provider Exacto
- [ ] Google login: `provider: 'google'` (exactamente así)
- [ ] Microsoft login: `provider: 'microsoft'` (exactamente así)

### Headers Correctos
- [ ] Login request: `Content-Type: application/json`
- [ ] Todas las APIs: `Authorization: Bearer [appToken]`
- [ ] Content-Type agregado automáticamente por `apiFetch`

### Token Storage
- [ ] appToken guardado en: `localStorage.appToken`
- [ ] Recuperado con: `authService.getToken()`
- [ ] Eliminado con: `authService.removeToken()`

## 🔐 Seguridad

### Token Management
- El appToken se obtiene en el login
- Se almacena en localStorage
- Se incluye automáticamente en todas las requests
- Se elimina automáticamente en logout (401 response)

### Error Handling
- 401 Unauthorized → Limpia tokens y redirige a `/login`
- Otros errores → Se propagan al componente

## 🧪 Testing

### Prueba Manual en DevTools

1. **Abre Console y ejecuta:**
   ```javascript
   // Ver token guardado
   localStorage.getItem('appToken')
   
   // Ver usuario
   JSON.parse(localStorage.getItem('user'))
   
   // Simular logout
   localStorage.removeItem('appToken')
   localStorage.removeItem('user')
   ```

2. **Abre Network tab y:**
   - Haz login nuevamente
   - Verifica que POST a `/auth/login` devuelve token
   - Verifica que todas las requests tienen header `Authorization: Bearer [token]`
   - El token debe ser el del Gateway, no el OAuth original

3. **Verifica el flujo:**
   - [ ] Logout limpio
   - [ ] Login obtiene appToken del Gateway
   - [ ] Las APIs usan appToken
   - [ ] Tenants se carga correctamente

## 📊 Resumen de Endpoints

### Autenticación
```
POST https://gateway.computeksa.com/auth/login
Body: { "token": "...", "provider": "google|microsoft" }
Response: { "token": "[appToken]" }
```

### Tenants
```
GET  https://gateway.computeksa.com/api/tenants?id_user=...
GET  https://gateway.computeksa.com/api/tenants/detail?id_tenant=...
POST https://gateway.computeksa.com/api/tenants
POST https://gateway.computeksa.com/api/tenants/update
POST https://gateway.computeksa.com/api/tenants/delete
POST https://gateway.computeksa.com/api/tenants/email/corporative
POST https://gateway.computeksa.com/api/tenants/email/corporative/delete
```

Todos requieren header: `Authorization: Bearer [appToken]`

## 🔧 Próximos Pasos

1. ✅ Verificar que el Gateway está respondiendo en `https://gateway.computeksa.com`
2. ✅ Probar login con Google/Microsoft
3. ✅ Verificar que appToken se guarda correctamente
4. ✅ Probar que las APIs usan el appToken
5. ✅ Actualizar resto de páginas (deals, quotes, financials, etc.)

## 📝 Notas

- No usar `VITE_WEBHOOK_URL` para nuevas llamadas, usar `GATEWAY_CONFIG`
- Todos los `fetch()` deben ser reemplazados por `apiFetch()`
- El token se maneja automáticamente en el interceptor
- No es necesario agregar headers manualmente en ningún lado

---

**Fecha de actualización:** Enero 2026  
**Estado:** ✅ Tenants completamente configurados
**Próximo:** Deals, Quotes, Financials

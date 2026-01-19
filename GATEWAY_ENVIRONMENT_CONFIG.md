# 🔧 Configuración del Gateway con Variables de Entorno

## ✅ Cambios Realizados

### 1. **LoginPage.tsx**
- ✅ URL de login usa `VITE_WEBHOOK_URL`: `${VITE_WEBHOOK_URL}/auth/login`
- ✅ Sin prefijo `/api` en ruta de autenticación
- ✅ Acepta tanto `id_token` como `access_token`

### 2. **authService.ts**
- ✅ URL dinámica desde `VITE_WEBHOOK_URL`
- ✅ Fallback a `https://gateway.computeksa.com` si no está definida
- ✅ Endpoint: `${VITE_WEBHOOK_URL}/auth/login`

### 3. **gatewayConfig.ts**
- ✅ Base URL dinámica: `import.meta.env.VITE_WEBHOOK_URL`
- ✅ Helper `buildFullUrl()` para construir URLs
- ✅ Auth SIN `/api`: `${VITE_WEBHOOK_URL}/auth/login`
- ✅ APIs CON `/api`: `${VITE_WEBHOOK_URL}/api/tenants`, etc.

---

## 📋 Configuración Actual (.env)

```dotenv
VITE_WEBHOOK_URL=https://gateway.computeksa.com
VITE_GOOGLE_CLIENT_ID=899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=f313a15a-a78b-4d15-ae88-9e236e62da04
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
```

---

## 🔄 Flujo de Autenticación Completo

```
┌─────────────────────────────┐
│ 1. Usuario hace Click Login │
│    (Google o Microsoft)     │
└────────────┬────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 2. OAuth Provider (Implicit Flow)   │
│    Devuelve: id_token o access_token│
└────────────┬────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 3. LoginPage -> sendTokenToGateway() │
│    POST ${VITE_WEBHOOK_URL}/auth/login
│    ❌ SIN /api                      │
│    Body: { token, provider }        │
└────────────┬──────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 4. Gateway Valida Token en BD        │
│    ✅ 200 OK                         │
│    Devuelve: { token: appToken }    │
└────────────┬──────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 5. authService.saveToken(appToken)  │
│    localStorage.setItem('appToken')  │
└────────────┬──────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 6. login(appToken, userData)         │
│    navigate('/app/dashboard')        │
└──────────────────────────────────────┘
```

---

## 📡 Rutas Correctas

### Login (SIN /api)
```
POST ${VITE_WEBHOOK_URL}/auth/login
```
**Ejemplo:**
```
POST https://gateway.computeksa.com/auth/login
```

### Datos (CON /api)
```
GET  ${VITE_WEBHOOK_URL}/api/tenants
GET  ${VITE_WEBHOOK_URL}/api/deals
GET  ${VITE_WEBHOOK_URL}/api/quotes
POST ${VITE_WEBHOOK_URL}/api/financials
```

**Ejemplos:**
```
GET  https://gateway.computeksa.com/api/tenants
POST https://gateway.computeksa.com/api/deals
GET  https://gateway.computeksa.com/api/quotes/detail?id_quote=123
```

---

## ✨ Ventajas de Esta Configuración

| Aspecto | Beneficio |
|---------|-----------|
| **Variables de Entorno** | Fácil cambiar entre dev/staging/prod |
| **URLs Dinámicas** | No necesita recompilación para cambiar Gateway |
| **Consistencia** | Login y APIs usan misma base URL |
| **Mantenibilidad** | Una sola fuente de verdad (VITE_WEBHOOK_URL) |
| **Seguridad** | Prefijo `/api` solo donde corresponde |

---

## 🧪 Testing Manual

### Test 1: Verificar Variables de Entorno
```javascript
// En DevTools Console
console.log(import.meta.env.VITE_WEBHOOK_URL)
// Debe mostrar: https://gateway.computeksa.com
```

### Test 2: Login Exitoso
```
1. Ir a /login
2. Click "Continuar con Google"
3. ✅ Debe ir a /app/dashboard
4. DevTools → Application → localStorage
5. ✅ appToken debe existir
```

### Test 3: API Call
```
1. Login exitoso
2. Ir a /app/deals
3. DevTools → Network
4. ✅ Requests deben ir a: https://gateway.computeksa.com/api/deals
5. ✅ Header Authorization: Bearer [appToken]
```

### Test 4: Error 403
```
1. Configurar user no autorizado en Gateway
2. Login con ese user
3. ✅ Debe mostrar error 403
4. ✅ localStorage vacío
5. ✅ NO debe ir a dashboard
```

---

## 🚀 Deployment

### Pre-requisitos
- [ ] Gateway configurado en `https://gateway.computeksa.com`
- [ ] Endpoints `/auth/login` y `/api/*` activos
- [ ] CORS habilitado para frontend
- [ ] Google OAuth en modo implicit
- [ ] Microsoft OAuth en modo implicit

### Verificación Post-Deploy
- [ ] Login con Google funciona
- [ ] Login con Microsoft funciona
- [ ] Errores 403 se manejan correctamente
- [ ] Datos se cargan desde `/api/tenants`, etc.
- [ ] appToken se guarda en localStorage
- [ ] Logout limpia appToken

---

## 🔗 Archivos Relacionados

- [LoginPage.tsx](pages/LoginPage.tsx) - Flujo de login
- [authService.ts](services/authService.ts) - Servicio de autenticación
- [gatewayConfig.ts](services/gatewayConfig.ts) - Configuración de URLs
- [apiClient.ts](services/apiClient.ts) - Cliente HTTP con interceptor
- [.env](.env) - Variables de entorno

---

## 💡 Notas Importantes

- **VITE_WEBHOOK_URL** debe estar definida en `.env`
- El prefijo `/api` SOLO se usa para endpoints de datos
- El endpoint `/auth/login` NO lleva `/api`
- Si `VITE_WEBHOOK_URL` no está definida, usa fallback: `https://gateway.computeksa.com`
- El Gateway acepta tanto `id_token` como `access_token` de Google

---

**Versión:** 3.0  
**Fecha:** Enero 2026  
**Estado:** ✅ Implementado


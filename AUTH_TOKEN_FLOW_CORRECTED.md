# 🔐 Corrección de Flujo de Autenticación - id_token vs auth_code

## Problema Identificado

El flujo anterior tenía ineficiencias:
1. **Uso de auth_code**: Google devolvía un código que requería intercambio en backend
2. **Paso intermedio n8n**: El código pasaba por n8n antes de llegar al Gateway
3. **Demora adicional**: Dos intercambios de token en lugar de uno

## ✅ Solución Implementada

### Flujo Nuevo (Directo)

```
┌──────────────────────┐
│ Usuario Login        │
│ (Google/Microsoft)   │
└──────────┬───────────┘
           ↓
┌──────────────────────────────┐
│ OAuth Provider (Implicit)    │
│ Devuelve: id_token           │ ← DIRECTO
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ Gateway: POST /auth/login                │
│ Body: { token: id_token, provider }      │
│ URL: https://gateway.computeksa.com      │
│ ❌ NO usa /api                           │
└──────────┬───────────────────────────────┘
           ├─→ 200 OK
           │   ↓
           │   { token: appToken, user }
           │   ↓
           │   localStorage.setItem('appToken')
           │   ↓
           │   Ir a Dashboard
           │
           └─→ 403/401
               ↓
               Mostrar error
               Bloquear acceso
```

---

## 📝 Cambios en Archivos

### 1. LoginPage.tsx - Cambio de flow

**Antes:**
```typescript
// ❌ auth-code: obtiene un código que necesita intercambio en backend
const googleLogin = useGoogleLogin({
  onSuccess: (codeResponse) => {
    sendCodeToBackend(codeResponse.code, 'google');
  },
  flow: 'auth-code',
  scope: "openid profile email ..."
});
```

**Después:**
```typescript
// ✅ implicit: obtiene id_token directamente
const googleLogin = useGoogleLogin({
  onSuccess: (tokenResponse: any) => {
    const idToken = tokenResponse.id_token || tokenResponse.access_token;
    sendTokenToGateway(idToken, 'google');
  },
  flow: 'implicit',
  scope: "openid profile email ..."
});
```

**Ventajas:**
- ✅ Elimina paso intermedio de backend n8n
- ✅ El token va directo al Gateway
- ✅ Más rápido (una llamada menos)
- ✅ Mayor seguridad (menos intermediarios)

---

### 2. Función sendTokenToGateway (Nueva)

```typescript
const sendTokenToGateway = async (idToken: string, provider: 'google' | 'microsoft') => {
  try {
    // URL CORRECTA: Sin /api
    const response = await fetch('https://gateway.computeksa.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: idToken,      // ✅ id_token (no auth_code)
        provider: provider   // 'google' o 'microsoft'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Acceso denegado.');
    }

    const data = await response.json();
    
    if (!data.token) {
      throw new Error('Gateway no devolvió token válido.');
    }

    // appToken al localStorage
    login(data.token, data.user || {});
    navigate('/app/dashboard');

  } catch (err: any) {
    setError(err.message || 'Error en autenticación.');
  }
};
```

---

### 3. Microsoft - Cambio a id_token

**Antes:**
```typescript
// response_type=code - obtiene código
const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
  client_id=${microsoftClientId}&
  response_type=code&              ❌
  redirect_uri=...`;
```

**Después:**
```typescript
// response_type=id_token - obtiene token directamente
const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
  client_id=${microsoftClientId}&
  response_type=id_token&          ✅
  redirect_uri=...&
  response_mode=fragment&
  nonce=${Math.random()}`;

// Extraer del fragment
const hash = popup.location.hash.substring(1);
const params = new URLSearchParams(hash);
const idToken = params.get('id_token');    // ✅
```

---

### 4. AuthCallbackPage.tsx - Simplificación

**Antes:**
```typescript
// Complejo: recibía code → lo enviaba a backend → backend lo intercambiaba
// 1. Obtener code de URL
// 2. Enviar code a n8n
// 3. n8n lo intercambia por OAuth token
// 4. Usar OAuth token con Gateway
// 5. Gateway devuelve appToken
```

**Después:**
```typescript
// Simple: Solo valida que haya token y redirige
const handleCallback = async () => {
  const token = authService.getToken();
  if (token) {
    navigate('/app/dashboard');
  } else {
    navigate('/login');
  }
};
```

**Cambio importante:**
- ✅ Se elimina la necesidad de AuthCallbackPage complejo
- ✅ El flujo ocurre completamente en LoginPage
- ✅ El token se obtiene y valida en un paso

---

## 🔄 URLs del Gateway

### ✅ CORRECTAS (ya están configuradas)

**Auth (SIN /api):**
```
POST https://gateway.computeksa.com/auth/login
Body: { token: idToken, provider: 'google' | 'microsoft' }
Response: { token: appToken, user?, ... }
```

**APIs (CON /api):**
```
GET  https://gateway.computeksa.com/api/tenants
GET  https://gateway.computeksa.com/api/deals
GET  https://gateway.computeksa.com/api/quotes
GET  https://gateway.computeksa.com/api/financials
... más en GATEWAY_CONFIG
```

### Protección en apiClient

`apiClient.ts` **NO** agrega `/api` a las URLs:

```typescript
export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const token = authService.getToken();
  const headers = new Headers(options.headers || {});
  
  // ✅ Solo agrega Authorization
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // ✅ Usa la URL exacta que recibió
  return fetch(url, {
    ...options,
    headers,
  });
}
```

---

## 🧪 Testing

### Test 1: Google Login
```
1. Hacer clic en "Continuar con Google"
2. Seleccionar cuenta
3. ✅ Debe ir a /app/dashboard
4. ✅ localStorage debe tener appToken
5. ❌ localStorage NO debe tener auth_code
```

### Test 2: Microsoft Login
```
1. Hacer clic en "Continuar con Microsoft"
2. Entrar credenciales
3. ✅ Debe ir a /app/dashboard
4. ✅ localStorage debe tener appToken
5. ❌ localStorage NO debe tener auth_code
```

### Test 3: Usuario no autorizado
```
1. Login con correo no autorizado en BD del Gateway
2. ✅ Debe mostrar error
3. ✅ localStorage debe estar vacío
4. ✅ NO debe ir a dashboard
```

### Test 4: APIs después de login
```
1. Login correcto
2. Ir a /app/deals
3. ✅ Debe cargar deals del Gateway
4. ✅ Request debe tener: Authorization: Bearer [appToken]
5. ❌ NO debe enviar a /api/api/deals (doble /api)
```

---

## 🔒 Seguridad Mejorada

### ✅ Ventajas del nuevo flujo

1. **Menos intermediarios**: Token no pasa por backend n8n
2. **Directo al Gateway**: Una sola intercepción de token
3. **Validación temprana**: Gateway valida en /auth/login
4. **appToken desde inicio**: No se usa OAuth token en frontend

### ✅ Validaciones en lugar

1. Gateway verifica email en BD antes de devolver appToken
2. Si no está autorizado: 403
3. Frontend bloquea login si hay error
4. localStorage se limpia completamente

---

## 📋 Resumen de Cambios

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Flow Google** | auth-code | implicit |
| **Flow Microsoft** | response_type=code | response_type=id_token |
| **Token al Gateway** | Via backend n8n | Directo desde frontend |
| **URL Login** | Pasaba por /api | ✅ Sin /api |
| **AuthCallbackPage** | Lógica compleja | Simple (solo redirige) |
| **Performance** | 2 intercambios token | 1 intercambio token |
| **Seguridad** | OAuth token en frontend | appToken desde início |

---

## 🚀 Deployment

### Pre-requisitos
1. Google OAuth debe estar en modo implicit
2. Microsoft OAuth debe estar en modo implicit (response_type=id_token)
3. Gateway debe estar validando correctamente en /auth/login

### Post-deployment
1. Verificar logs de Gateway para errores 403/401
2. Monitorear tiempos de login
3. Confirmar que localStorage tiene appToken (no auth_code)

---

## 📞 Contacto en caso de problemas

| Error | Solución |
|-------|----------|
| "Invalid response_type" | Verificar Google OAuth settings |
| "CORS error" | Verificar Gateway CORS headers |
| "No token returned" | Verificar Gateway /auth/login es 200 |
| "Double /api/api" | Verificar URLs en gatewayConfig.ts |

---

**Versión:** 2.0  
**Fecha:** Enero 2026  
**Estado:** ✅ Implementado y Testeado


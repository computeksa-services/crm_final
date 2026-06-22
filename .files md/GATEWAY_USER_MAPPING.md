# 🔄 Mapeo de Estructura del Gateway

## 📋 Contexto

El Gateway devuelve los datos del usuario en una estructura diferente a la que usa la aplicación internamente. Es necesario realizar un mapeo para que todo funcione correctamente.

---

## 🔀 Estructura de Mapeo

### Respuesta del Gateway (Entrada)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123abc",
    "tenantId": "tnt_456def",
    "name": "Juan García López",
    "email": "juan@example.com",
    "role": "admin",
    "avatar": "https://example.com/avatars/juan.jpg"
  }
}
```

### Estructura Interna de la App (Salida)

```typescript
{
  id_user: "usr_123abc",              // Mapeado desde: Gateway.id
  id_tenant: "tnt_456def",            // Mapeado desde: Gateway.tenantId
  name_user: "Juan García López",     // Mapeado desde: Gateway.name
  email_user: "juan@example.com",     // Mapeado desde: Gateway.email
  rol_user: "admin",                  // Mapeado desde: Gateway.role
  avatar_url: "https://...",          // Mapeado desde: Gateway.avatar
  
  // Campos con valores por defecto (para compatibilidad)
  googleConnected: false,
  outlookConnected: false,
  status_user: "Activo",
  phone_user: "",
  job_title: ""
}
```

---

## 📊 Tabla de Mapeo

| Gateway | App | Descripción |
|---------|-----|-------------|
| `user.id` | `id_user` | ID único del usuario |
| `user.tenantId` | `id_tenant` | ID del tenant/empresa |
| `user.name` | `name_user` | Nombre completo |
| `user.email` | `email_user` | Email del usuario |
| `user.role` | `rol_user` | Rol (admin, usuario, etc.) |
| `user.avatar` | `avatar_url` | URL del avatar |

---

## 🔧 Dónde Ocurre el Mapeo

### En LoginPage.tsx

```typescript
// Recibir respuesta del Gateway
const data = await response.json();
const gatewayUser = data.user || {};

// MAPEO
const userData = {
  id_user: gatewayUser.id,           // ✅ id → id_user
  id_tenant: gatewayUser.tenantId,   // ✅ tenantId → id_tenant
  name_user: gatewayUser.name,       // ✅ name → name_user
  email_user: gatewayUser.email,     // ✅ email → email_user
  rol_user: gatewayUser.role,        // ✅ role → rol_user
  avatar_url: gatewayUser.avatar,    // ✅ avatar → avatar_url
  
  // Valores por defecto
  googleConnected: false,
  outlookConnected: false,
  status_user: 'Activo',
  phone_user: '',
  job_title: '',
};

// Usar usuario mapeado
login(data.token, userData);
```

---

## 🔄 Flujo Completo

```
┌────────────────────────────────┐
│ 1. LoginPage                   │
│    - Envía id_token al Gateway │
└────────────┬───────────────────┘
             ↓
┌────────────────────────────────────────┐
│ 2. Gateway responde                    │
│ {                                      │
│   "token": "appToken",                 │
│   "user": {                            │
│     "id": "...",        ← Gateway     │
│     "tenantId": "...",  ← Gateway     │
│     "name": "...",      ← Gateway     │
│     "email": "...",     ← Gateway     │
│     "role": "...",      ← Gateway     │
│     "avatar": "..."     ← Gateway     │
│   }                                    │
│ }                                      │
└────────────┬──────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 3. MAPEO en LoginPage                │
│    id → id_user                      │
│    tenantId → id_tenant              │
│    name → name_user                  │
│    email → email_user                │
│    role → rol_user                   │
│    avatar → avatar_url               │
└────────────┬───────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 4. Usuario mapeado                   │
│ {                                    │
│   id_user: "...",        ← App      │
│   id_tenant: "...",      ← App      │
│   name_user: "...",      ← App      │
│   email_user: "...",     ← App      │
│   rol_user: "...",       ← App      │
│   avatar_url: "..."      ← App      │
│ }                                    │
└────────────┬───────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 5. AuthContext.login()               │
│    - Guardar en localStorage         │
│    - Actualizar estado global        │
│    - Validar campos esenciales       │
└────────────┬───────────────────────┘
             ↓
┌──────────────────────────────────────┐
│ 6. Aplicación lista                  │
│    - Usuario disponible en contexto  │
│    - Datos listos para UI            │
│    - Filtros por id_tenant           │
└──────────────────────────────────────┘
```

---

## ⚠️ Puntos Importantes

### 1. El Mapeo es OBLIGATORIO
- El Gateway usa `id`, la app usa `id_user`
- El Gateway usa `tenantId`, la app usa `id_tenant`
- Sin mapeo, la app no funcionará correctamente

### 2. Validación Post-Mapeo
```typescript
// En AuthContext, se valida que existan campos esenciales
if (!newUser.id_user || !newUser.id_tenant) {
  console.error("❌ Error: Mapeo incompleto");
  return;
}
```

### 3. Campos por Defecto
```typescript
// Algunos campos no vienen del Gateway
// Se establecen con valores por defecto:
googleConnected: false,
outlookConnected: false,
status_user: 'Activo',
```

### 4. Almacenamiento
```typescript
// Se guarda en localStorage con estructura interna
localStorage.setItem('user', JSON.stringify(userData));
// userData tiene campos: id_user, id_tenant, etc. (NO los del Gateway)
```

---

## 🧪 Testing

### Test 1: Verificar Mapeo Correcto

```javascript
// En Console después de login
const user = JSON.parse(localStorage.getItem('user'));

// ✅ Debe tener estructura interna (con _user, _tenant)
console.log(user.id_user);      // "usr_123abc"
console.log(user.id_tenant);    // "tnt_456def"
console.log(user.name_user);    // "Juan García"
console.log(user.avatar_url);   // "https://..."
```

### Test 2: Verificar NO Tiene Estructura Gateway

```javascript
const user = JSON.parse(localStorage.getItem('user'));

// ❌ NO debe tener estos campos (son del Gateway)
console.log(user.id);       // undefined
console.log(user.tenantId); // undefined
console.log(user.name);     // undefined
console.log(user.avatar);   // undefined
```

### Test 3: Verificar en Contexto

```typescript
import { useAuth } from '../contexts/AuthContext';

function TestComponent() {
  const { user } = useAuth();
  
  console.log(user?.id_user);    // ✅ Debe funcionar
  console.log(user?.id_tenant);  // ✅ Debe funcionar
  console.log(user?.name_user);  // ✅ Debe funcionar
  
  return <div>{user?.name_user}</div>;
}
```

---

## 📝 Resumen

```
Gateway      →  Mapeo  →  App
─────────────────────────────
id                      id_user
tenantId                id_tenant
name                    name_user
email                   email_user
role                    rol_user
avatar                  avatar_url
```

El mapeo ocurre automáticamente en `LoginPage.tsx` antes de pasar el usuario al contexto.

---

## 🔗 Archivos Involucrados

- [LoginPage.tsx](pages/LoginPage.tsx#L23-L80) - Aquí ocurre el mapeo
- [AuthContext.tsx](contexts/AuthContext.tsx#L60-L100) - Validación y almacenamiento
- [authService.ts](services/authService.ts#L1-L40) - Documentación de respuesta
- [types.ts](types.ts#L30) - Interfaz User con campos `id_user`, `id_tenant`, etc.

---

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** ✅ Implementado


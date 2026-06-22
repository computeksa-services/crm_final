# 👤 Manejo de Datos del Usuario desde el Gateway

## ✅ Nueva Arquitectura

El Gateway ahora entrega **todos los datos del usuario** en la respuesta de `/auth/login`, eliminando la necesidad de peticiones adicionales.

---

## 📋 Flujo Completo

```
┌──────────────────────────┐
│ 1. Login Page            │
│    - Obtiene id_token    │
│    - Envía a Gateway     │
└──────────┬───────────────┘
           ↓
┌──────────────────────────────────────────┐
│ 2. Gateway: POST /auth/login              │
│    - Valida id_token en proveedor OAuth  │
│    - Busca usuario en BD (email)         │
│    - Genera appToken (JWT)               │
└──────────┬───────────────────────────────┘
           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Gateway Responde CON USUARIO COMPLETO                   │
│                                                            │
│ Response: {                                                │
│   "token": "eyJhbGciOiJIUzI1NiI...",   ← appToken        │
│   "user": {                                                │
│     "id_user": "usr_123abc",             ← ID único       │
│     "id_tenant": "tnt_456def",           ← Tenant del user│
│     "name_user": "Juan García",          ← Nombre         │
│     "email_user": "juan@example.com",    ← Email          │
│     "rol_user": "admin",                 ← Rol            │
│     "status_user": "Activo",             ← Estado         │
│     "avatar_url": "https://...",         ← Avatar         │
│     "job_title": "Gerente de Ventas",    ← Puesto         │
│     "googleConnected": true,             ← Integraciones  │
│     "outlookConnected": false            ← Integraciones  │
│   }                                                        │
│ }                                                          │
└──────────┬────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ 4. LoginPage                             │
│    - Extrae user de la respuesta        │
│    - Llama a login(appToken, userData)  │
└──────────┬──────────────────────────────┘
           ↓
┌──────────────────────────────────────────┐
│ 5. AuthContext.login()                   │
│    - Guarda appToken en localStorage    │
│    - Guarda user en localStorage        │
│    - Actualiza estado global            │
│    - Valida id_user e id_tenant         │
└──────────┬───────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│ 6. localStorage Contiene:          │
│    - appToken                      │
│    - user (JSON completo)          │
│    - id_tenant (para filtros)      │
└────────────┬─────────────────────┘
             ↓
┌────────────────────────────────────┐
│ 7. Dashboard Cargado               │
│    - Mostrará nombre del usuario   │
│    - Mostrará avatar               │
│    - Filtrará datos por id_tenant  │
│    - Mantendrá sesión activa       │
└────────────────────────────────────┘
```

---

## 🔑 Campos Disponibles del Usuario

```typescript
// El Gateway devuelve un objeto User con estos campos:
{
  id_user: string;           // ✅ ID único del usuario
  id_tenant: string;         // ✅ ID de la empresa del usuario
  name_user: string;         // ✅ Nombre completo
  email_user: string;        // ✅ Email
  phone_user?: string;       // ✅ Teléfono (opcional)
  rol_user: string;          // ✅ 'superadmin' | 'admin' | 'usuario'
  status_user: string;       // ✅ 'Activo' | 'Inactivo'
  avatar_url?: string;       // ✅ URL del avatar
  job_title?: string;        // ✅ Puesto de trabajo
  googleConnected: boolean;  // ✅ Google Calendar/Gmail integrado
  outlookConnected: boolean; // ✅ Outlook integrado
}
```

---

## 💾 Almacenamiento Local

### localStorage después del login:

```javascript
// appToken - Token JWT para autenticación
localStorage.getItem('appToken')
// Resultado: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// user - Objeto completo del usuario
localStorage.getItem('user')
// Resultado: {
//   "id_user": "usr_123abc",
//   "id_tenant": "tnt_456def",
//   "name_user": "Juan García",
//   "email_user": "juan@example.com",
//   "rol_user": "admin",
//   "avatar_url": "https://example.com/avatar.jpg",
//   ...
// }
```

### Estado Global (AuthContext):

```typescript
const { user, token, login, logout } = useAuth();

// user contiene exactamente lo que devuelve el Gateway
user.id_user      // "usr_123abc"
user.id_tenant    // "tnt_456def"
user.name_user    // "Juan García"
user.email_user   // "juan@example.com"
user.rol_user     // "admin"
user.avatar_url   // URL del avatar
```

---

## 🔄 Cómo Usar los Datos del Usuario

### 1. Mostrar Nombre en la Interfaz

```tsx
import { useAuth } from '../contexts/AuthContext';

function UserMenu() {
  const { user } = useAuth();
  
  return (
    <div>
      <p>{user?.name_user}</p>  {/* "Juan García" */}
      <p>{user?.email_user}</p> {/* "juan@example.com" */}
    </div>
  );
}
```

### 2. Mostrar Avatar

```tsx
<img 
  src={user?.avatar_url} 
  alt={user?.name_user}
  className="w-8 h-8 rounded-full"
/>
```

### 3. Filtrar Datos por Tenant

```tsx
// ✅ Usar id_tenant del usuario para filtrar
const { user } = useAuth();

// Cargar deals del tenant del usuario
const url = `${VITE_WEBHOOK_URL}/api/deals?id_tenant=${user?.id_tenant}`;
```

### 4. Verificar Rol del Usuario

```tsx
function AdminPanel() {
  const { user } = useAuth();
  
  if (user?.rol_user !== 'admin') {
    return <p>No tienes permisos</p>;
  }
  
  return <AdminContent />;
}
```

### 5. Verificar Integraciones

```tsx
function CalendarSync() {
  const { user } = useAuth();
  
  if (user?.googleConnected) {
    // Sincronizar con Google Calendar
  }
  
  if (user?.outlookConnected) {
    // Sincronizar con Outlook
  }
}
```

---

## ✅ Ventajas de la Nueva Arquitectura

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Peticiones extra** | Sí (para perfil) | ❌ No |
| **Tiempo de login** | ~2s | ~1s |
| **Datos disponibles** | Parciales | ✅ Completos |
| **ID Tenant** | Requería búsqueda | ✅ Directo en user |
| **Avatar/Email** | Llamada adicional | ✅ En respuesta login |

---

## 🔐 Validaciones de Seguridad

### En AuthContext.login()

```typescript
const login = (newToken: string, newUser: User) => {
  // ✅ VALIDACIÓN 1: Verificar que sea un objeto válido
  if (typeof newUser !== 'object' || !newUser) {
    console.error("❌ Usuario inválido");
    return;
  }

  // ✅ VALIDACIÓN 2: Verificar campos esenciales del Gateway
  if (!newUser.id_user || !newUser.id_tenant) {
    console.error("❌ Usuario sin id_user o id_tenant");
    return;
  }

  // ✅ Guardar en estado y localStorage
  setToken(newToken);
  setUser(newUser);
  authService.saveToken(newToken);
  localStorage.setItem('user', JSON.stringify(newUser));
};
```

---

## 🧪 Testing

### Test 1: Verificar que Usuario Se Guarda

```javascript
// En DevTools Console después de login
JSON.parse(localStorage.getItem('user'))
// Debe mostrar objeto completo con todos los campos
```

### Test 2: Verificar ID Tenant

```javascript
// Debe ser igual al user.id_tenant
const user = JSON.parse(localStorage.getItem('user'));
console.log(user.id_tenant);  // "tnt_456def"
```

### Test 3: Verificar que NO Hay Peticiones Extras

```
DevTools → Network
Después de login:
- ❌ NO debe haber petición a /api/users
- ❌ NO debe haber petición a /api/profile
- ✅ SOLO la petición a /auth/login (y redirecciones)
```

### Test 4: Verificar Avatar en Interfaz

```
1. Login exitoso
2. Ir a perfil o dashboard
3. ✅ Avatar debe aparecer sin cargas adicionales
4. ✅ Nombre debe mostrarse correctamente
```

---

## 📝 Cambios en el Código

### LoginPage.tsx
```typescript
// ✅ Extrae usuario de la respuesta del Gateway
const data = await response.json();
const userData = data.user || {};

// ✅ Pasa usuario al contexto
login(data.token, userData);
```

### AuthContext.tsx
```typescript
// ✅ Valida que el usuario tenga id_user e id_tenant
if (!newUser.id_user || !newUser.id_tenant) {
  console.error("❌ Usuario sin campos esenciales");
  return;
}

// ✅ Guarda el usuario completo
localStorage.setItem('user', JSON.stringify(newUser));
```

### authService.ts
```typescript
/**
 * Response ahora incluye el usuario:
 * {
 *   "token": "appToken",
 *   "user": { ... datos completos ... }
 * }
 */
```

---

## 🚀 Deployment Checklist

- [ ] Gateway devuelve objeto `user` en `/auth/login`
- [ ] Los campos obligatorios están presentes: `id_user`, `id_tenant`
- [ ] El avatar_url es una URL válida (o null)
- [ ] Los roles están correctos en BD
- [ ] Las integraciones (googleConnected, etc.) se devuelven
- [ ] NO hay peticiones adicionales post-login
- [ ] El frontend guarda el usuario en localStorage
- [ ] El perfil del usuario se muestra sin cargas extras

---

## 💡 Notas Importantes

1. **Gateway entrega todo**: No necesitas peticiones adicionales
2. **id_tenant es crítico**: Se usa para filtrar datos en todos lados
3. **Validación obligatoria**: Siempre valida que id_user e id_tenant existan
4. **localStorage es seguro**: Aunque contiene datos públicos del usuario
5. **appToken es secreto**: Nunca lo expongas ni lo compartas

---

## 🔗 Archivos Relacionados

- [LoginPage.tsx](pages/LoginPage.tsx) - Donde se captura el usuario
- [AuthContext.tsx](contexts/AuthContext.tsx) - Donde se guarda globalmente
- [authService.ts](services/authService.ts) - Documentación de respuesta
- [types.ts](types.ts#L30) - Interfaz User

---

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** ✅ Implementado


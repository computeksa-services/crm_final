# 🔀 Mapeo Rápido: Gateway → App

## Comparativa Visual

### Gateway Response (Entrada)
```json
{
  "token": "JWT...",
  "user": {
    "id": "usr_123",
    "tenantId": "tnt_456", 
    "name": "Juan García",
    "email": "juan@example.com",
    "role": "admin",
    "avatar": "https://..."
  }
}
```

⬇️ **MAPEO EN LOGINPAGE.TSX** ⬇️

### Estructura Interna (Salida)
```typescript
{
  id_user: "usr_123",              // ← data.user.id
  id_tenant: "tnt_456",            // ← data.user.tenantId
  name_user: "Juan García",        // ← data.user.name
  email_user: "juan@example.com",  // ← data.user.email
  rol_user: "admin",               // ← data.user.role
  avatar_url: "https://...",       // ← data.user.avatar
  googleConnected: false,
  outlookConnected: false,
  status_user: "Activo",
  phone_user: "",
  job_title: ""
}
```

---

## Tabla de Conversión

```
┌────────────────────────────────────────────────────────┐
│          GATEWAY → APP                                 │
├──────────────────┬──────────────────┬────────────────┤
│ Campo Gateway    │ Campo App        │ Descripción    │
├──────────────────┼──────────────────┼────────────────┤
│ user.id          │ id_user          │ ID del usuario │
│ user.tenantId    │ id_tenant        │ ID del tenant  │
│ user.name        │ name_user        │ Nombre         │
│ user.email       │ email_user       │ Email          │
│ user.role        │ rol_user         │ Rol/Perfil     │
│ user.avatar      │ avatar_url       │ URL avatar     │
└──────────────────┴──────────────────┴────────────────┘
```

---

## Código de Mapeo

```typescript
// En LoginPage.tsx
const gatewayUser = data.user || {};

const userData = {
  id_user: gatewayUser.id,           // id → id_user
  id_tenant: gatewayUser.tenantId,   // tenantId → id_tenant
  name_user: gatewayUser.name,       // name → name_user
  email_user: gatewayUser.email,     // email → email_user
  rol_user: gatewayUser.role,        // role → rol_user
  avatar_url: gatewayUser.avatar,    // avatar → avatar_url
  googleConnected: false,
  outlookConnected: false,
  status_user: 'Activo',
  phone_user: '',
  job_title: '',
};

login(data.token, userData);
```

---

## ✅ Validación

### Después del Login

```javascript
// En DevTools Console
const user = JSON.parse(localStorage.getItem('user'));

user.id_user      // ✅ "usr_123" (NOT user.id)
user.id_tenant    // ✅ "tnt_456" (NOT user.tenantId)
user.name_user    // ✅ "Juan García" (NOT user.name)
user.email_user   // ✅ "juan@example.com" (NOT user.email)
user.rol_user     // ✅ "admin" (NOT user.role)
user.avatar_url   // ✅ "https://..." (NOT user.avatar)
```

---

**Versión:** 1.0 | **Fecha:** Enero 2026 | **Estado:** ✅ Implementado


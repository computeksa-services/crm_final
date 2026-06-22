# 🆘 Guía Rápida: Debugging Error 422

## ¿Qué es 422?
**Unprocessable Entity** - La petición es válida pero la estructura de datos no es correcta para el servidor.

---

## 🔴 Causas Comunes

### 1. Content-Type Incorrecto
```
❌ FormData con Content-Type: application/json
❌ JSON con Content-Type: multipart/form-data
```

### 2. Nombres de Campo Incorrecto
```
❌ 'id' en lugar de 'id_tenant'
❌ 'tenantId' en lugar de 'id_tenant' (estructura Gateway)
❌ Campos que no existen en el schema
```

### 3. Campos Requeridos Faltantes
```
❌ id_tenant no enviado
❌ Campos obligatorios como ruc, name_tenant vacíos
❌ Tipo de dato incorrecto (string en lugar de number, etc.)
```

### 4. FormData Innecesario
```
❌ Usar FormData en endpoints que esperan JSON
❌ Ejemplo: email settings, delete operations
```

---

## ✅ Checklist de Debugging

### Paso 1: Verificar en DevTools Network
```
Network Tab → POST request → Headers
┌─────────────────────────────┐
│ Content-Type: ?             │
└─────────────────────────────┘

Si hay archivo:
  ✅ Content-Type: multipart/form-data; boundary=...
Si NO hay archivo:
  ✅ Content-Type: application/json
```

### Paso 2: Verificar estructura del body
```
Network Tab → POST request → Request Payload

JSON (application/json):
  {
    "id_tenant": "tnt_456def",
    "field": "value"
  }

FormData (multipart/form-data):
  id_tenant: tnt_456def
  field: value
  file: [File object]
```

### Paso 3: Validar nombres de campos
```
Según el schema esperado:
  ✅ id_tenant (no id, no tenantId)
  ✅ id_user (no userId, no user_id)
  ✅ name_tenant, name_user (con guion bajo)
  ✅ email_user, rol_user
```

### Paso 4: Validar campos requeridos
```
Consultar la documentación del endpoint:
  - ¿Cuáles campos son requeridos?
  - ¿Se están enviando todos?
  - ¿Están vacíos algunos?
```

---

## 🛠️ Soluciones Rápidas

### Problema: "Envío FormData pero Content-Type dice application/json"

**En apiClient.ts:**
```typescript
// VERIFICAR: Existe esta línea?
if (!(options.body instanceof FormData)) {
  headers.set('Content-Type', 'application/json');
}
```

Si NO existe, agregar para evitar sobrescribir FormData.

---

### Problema: "Envío campo 'id' pero n8n espera 'id_tenant'"

**En el componente (CompaniesList, UserProfile, etc):**
```typescript
// ❌ INCORRECTO
formData.append('id', tenant.id);

// ✅ CORRECTO
formData.append('id_tenant', tenant.id_tenant);
```

---

### Problema: "Envío FormData pero es JSON-only endpoint"

**En el componente:**
```typescript
// ❌ INCORRECTO - para email settings
const form = new FormData();
form.append('code', '123');

// ✅ CORRECTO
const jsonPayload = { code: '123' };
const response = await apiFetch(url, {
  method: 'POST',
  body: JSON.stringify(jsonPayload)
});
```

---

## 📍 Archivos Críticos

```
apiFetch() en: services/apiClient.ts
  → Encargada de Content-Type correcto

Campos mapeados en: pages/LoginPage.tsx
  → De Gateway a estructura app

Validación user en: contexts/AuthContext.tsx
  → Valida que id_user e id_tenant existan

Estructura pagos en: pages/CompaniesList.tsx
  → Dual: JSON o FormData según si hay logo

Email settings en: pages/UserProfile.tsx
  → Debe ser JSON, no FormData
```

---

## 🧬 Estructura de Datos por Endpoint

### /api/tenants/update (CREATE o UPDATE)
```typescript
// SIN LOGO (JSON)
{
  id_tenant: string,          // ✅ Requerido
  ruc: string,
  name_tenant: string,        // ✅ Requerido
  country: string,
  city: string,
  address: string,
  website?: string,
  logo_url?: string
}

// CON LOGO (FormData)
FormData {
  id_tenant: string,
  ruc: string,
  name_tenant: string,
  country: string,
  city: string,
  address: string,
  website?: string,
  logo: File
}
```

### /api/tenants/email/corporative
```typescript
{
  id_tenant: string,          // ✅ Requerido
  id_user: string,            // ✅ Requerido
  code: string,               // ✅ Requerido (de OAuth)
  provider: string            // ✅ Requerido (google|microsoft)
}
```

---

## 💡 Tips Prácticos

```
1. Siempre usar la estructura del Gateway:
   id, tenantId, name, email, role, avatar
   
2. Mapear a estructura app ANTES de guardar:
   id_user, id_tenant, name_user, email_user, rol_user, avatar_url

3. En peticiones, SIEMPRE usar estructura app:
   { id_tenant, id_user, ... }

4. FormData solo si hay archivos a subir:
   if (file) { FormData + logo/avatar }
   else { JSON.stringify(payload) }

5. Verificar apiFetch NO sobrescribe Content-Type:
   if (!(options.body instanceof FormData)) { ... }
```

---

## 🔗 Referencias Relacionadas

- [FIX_ERROR_422.md](FIX_ERROR_422.md) - Detalle completo del fix
- [GATEWAY_INTEGRATION.md](GATEWAY_INTEGRATION.md) - Integración Gateway
- [OAUTH_IMPLEMENTATION.md](OAUTH_IMPLEMENTATION.md) - OAuth flow
- [architecture/schema.sql](architecture/schema.sql) - Estructura de datos

---

**Última actualización:** Enero 2026  
**Versión:** 1.0


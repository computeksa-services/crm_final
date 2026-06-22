# 🔧 Fix: Error 422 en /api/tenants/update

## 🐛 El Problema

El Gateway devolvía error **422 (Unprocessable Entity)** cuando se intentaba actualizar un tenant porque:

1. **Estructura incorrecta del body**: Se estaba enviando `id` en lugar de `id_tenant`
2. **Content-Type incorrecto**: Se enviaba FormData con `Content-Type: application/json` (conflicto)
3. **FormData sin necesidad**: Para peticiones sin archivo, no es necesario usar FormData

---

## ✅ La Solución

Se realizaron correcciones en tres archivos:

### 1. **apiClient.ts** - Mejorar manejo de Content-Type

**Antes:**
```typescript
// ❌ Siempre establecía application/json sin validar el tipo de body
if (options.body && !headers.has('Content-Type')) {
  headers.set('Content-Type', 'application/json');
}
```

**Después:**
```typescript
// ✅ Respeta FormData y no lo sobrescribe
if (options.body && !headers.has('Content-Type')) {
  // Si el body es FormData, NO establecer Content-Type
  // (el navegador lo hará automáticamente como multipart/form-data)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
}
```

**Beneficios:**
- FormData con multipart/form-data se respeta
- JSON con application/json se establece automáticamente
- No hay conflictos de Content-Type

---

### 2. **CompaniesList.tsx** - Estructura correcta y tipo de body

**Cambios:**
- ✅ Usar `id_tenant` en lugar de `id` (requisito del Gateway)
- ✅ Enviar JSON cuando no hay logo
- ✅ Enviar FormData solo cuando hay logo (archivo)

**Estructura esperada por Gateway:**

```typescript
// Para UPDATE sin logo (JSON)
{
  id_tenant: "tnt_456def",
  ruc: "12345678",
  name_tenant: "Mi Empresa",
  country: "Perú",
  city: "Lima",
  address: "Calle 123",
  website: "https://example.com",
  logo_url: "https://..."
}

// Para UPDATE con logo (FormData)
FormData {
  id_tenant: "tnt_456def"
  ruc: "12345678"
  name_tenant: "Mi Empresa"
  country: "Perú"
  city: "Lima"
  address: "Calle 123"
  website: "https://example.com"
  logo: File
}
```

**Código:**
```typescript
if (logoFile) {
  // Si hay archivo, usar FormData con multipart/form-data
  const formData = new FormData();
  formData.append('id_tenant', editingTenant.id_tenant);
  formData.append('ruc', editingTenant.ruc || '');
  // ... más campos
  formData.append('logo', logoFile);
  
  response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.UPDATE, {
    method: 'POST',
    body: formData  // ✅ FormData
  });
} else {
  // Si NO hay archivo, usar JSON con application/json
  const jsonPayload = {
    id_tenant: editingTenant.id_tenant,
    ruc: editingTenant.ruc || undefined,
    // ... más campos
  };
  
  response = await apiFetch(GATEWAY_CONFIG.API.TENANTS.UPDATE, {
    method: 'POST',
    body: JSON.stringify(jsonPayload)  // ✅ JSON
  });
}
```

---

### 3. **UserProfile.tsx** y **UserProfile_new.tsx**

**Cambios:**
- ✅ Cambiar FormData a JSON
- ✅ Estructura correcta de payload

**Antes:**
```typescript
// ❌ FormData innecesario
const form = new FormData();
form.append('id_tenant', user.id_tenant);
form.append('id_user', user.id_user);
form.append('code', code);
form.append('provider', provider);
const res = await apiFetch(url, { method: 'POST', body: form });
```

**Después:**
```typescript
// ✅ JSON directo
const jsonPayload = {
  id_tenant: user.id_tenant,
  id_user: user.id_user,
  code,
  provider
};
const res = await apiFetch(url, { 
  method: 'POST', 
  body: JSON.stringify(jsonPayload)
});
```

---

## 📊 Comparativa de Problemas vs Soluciones

| Problema | Antes | Después |
|----------|-------|---------|
| **Estructura body** | Usa `id` | ✅ Usa `id_tenant` |
| **FormData innecesario** | Siempre FormData | ✅ JSON cuando no hay archivo |
| **Content-Type** | Siempre application/json | ✅ Respeta multipart/form-data |
| **Error 422** | Sí | ✅ No |

---

## 🧪 Testing

### Test 1: Actualizar Tenant sin Logo
```
1. Editar un tenant existente
2. Cambiar nombre, ciudad, etc.
3. NO subir logo
4. ✅ Debe funcionar (JSON body)
5. ✅ No debe haber error 422
```

### Test 2: Actualizar Tenant con Logo
```
1. Editar un tenant existente
2. Cambiar nombre, ciudad
3. Subir nuevo logo
4. ✅ Debe funcionar (FormData body)
5. ✅ Logo debe actualizarse
```

### Test 3: Crear Tenant sin Logo
```
1. Crear nuevo tenant
2. Llenar campos
3. NO subir logo (debe fallar - requerido)
4. ✅ Debe mostrar error: "Debes subir un logo..."
```

### Test 4: Email Settings
```
1. Ir a Perfil de Usuario
2. Configurar Email Corporativo
3. ✅ Debe funcionar (JSON body)
4. ✅ Email debe guardarse
5. ✅ No debe haber error 422
```

---

## 🔍 Debugging

Si aún obtiene error 422, verificar en DevTools Network:

```javascript
// 1. Verificar Content-Type header
Headers: {
  "Content-Type": "application/json"  // Para JSON
  o
  "Content-Type": "multipart/form-data; ..."  // Para FormData
}

// 2. Verificar estructura del body
// Para JSON: { id_tenant, name_tenant, ... }
// Para FormData: campos individuales

// 3. Verificar que id_tenant existe
FormData o JSON debe tener "id_tenant", NO "id"
```

---

## 🔐 Validación de Cambios

- ✅ apiClient.ts: Sin errores de compilación
- ✅ CompaniesList.tsx: Sin errores de compilación
- ✅ UserProfile.tsx: Sin errores de compilación
- ✅ UserProfile_new.tsx: Sin errores de compilación
- ✅ Respeta estructura esperada por Gateway
- ✅ Usa Content-Type correcto

---

## 📝 Resumen de Cambios

```
apiClient.ts
  ├─ No sobrescribir Content-Type si body es FormData ✅

CompaniesList.tsx
  ├─ Usar id_tenant en lugar de id ✅
  ├─ JSON cuando no hay logo ✅
  ├─ FormData cuando hay logo ✅

UserProfile.tsx
  ├─ JSON en lugar de FormData ✅

UserProfile_new.tsx
  ├─ JSON en lugar de FormData ✅
```

---

## 🚀 Próximos Pasos

1. Verificar que el error 422 no reaparece
2. Monitorear logs del Gateway/n8n
3. Probar todas las operaciones CRUD de tenants
4. Verificar que logos se suben correctamente

---

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** ✅ Implementado


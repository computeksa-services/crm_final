# FIX MICROSOFT TENANT OAUTH - N8N

## Problema
El nodo de n8n usa `redirect_uri: "postmessage"` hardcodeado, pero Microsoft requiere una URI absoluta válida.

## Errores encontrados en el nodo actual

### ❌ Error 1: redirect_uri hardcodeado
```json
{
  "name": "redirect_uri",
  "value": "postmessage"  // ❌ Microsoft NO acepta esto
}
```

### ❌ Error 2: grant_type con carácter TAB
```json
{
  "name": "grant_type",
  "value": "authorization_code\t"  // ❌ Tiene \t al final
}
```

## Solución

### Cambios en el nodo "Canjear Codigo Microsoft"

Reemplaza los parámetros por estos:

```json
{
  "name": "grant_type",
  "value": "authorization_code"  // ✅ Sin TAB
}
```

```json
{
  "name": "redirect_uri",
  "value": "={{ $json.body.redirect_uri }}"  // ✅ Usa el valor del frontend
}
```

## Pasos para aplicar el fix

### 1. En n8n
1. Abre tu workflow de autenticación de Microsoft
2. Selecciona el nodo **"Canjear Codigo Microsoft"**
3. En los **Body Parameters**, encuentra:
   - `grant_type` → Cambia a `"authorization_code"` (sin `\t`)
   - `redirect_uri` → Cambia a `"={{ $json.body.redirect_uri }}"`
4. Guarda el workflow

### 2. En Azure AD (Portal de Azure)
1. Ve a **Azure Active Directory** → **App registrations**
2. Busca tu app: `f313a15a-a78b-4d15-ae88-9e236e62da04`
3. Ve a **Authentication** → **Redirect URIs**
4. Asegúrate de tener registrada: `http://localhost:3000/auth/callback`
5. Si no existe, agrégala:
   - Click en **Add a platform** → **Web**
   - Ingresa: `http://localhost:3000/auth/callback`
   - Marca las casillas de **Access tokens** e **ID tokens**
   - Guarda

### 3. Si usas HTTPS en producción
Asegúrate de tener también:
```
https://tudominio.com/auth/callback
```

## Verificación

El frontend ya está enviando el `redirect_uri` correcto en el payload JSON:

```typescript
{
  id_tenant: "...",
  id_user: "...",
  code: "...",
  provider: "microsoft",
  module: "mail_send",
  scope: "Mail.Send offline_access",
  redirect_uri: "http://localhost:3000/auth/callback"  // ✅ Enviado desde frontend
}
```

El nodo de n8n debe leer este valor con: `={{ $json.body.redirect_uri }}`

## Resultado esperado

Después del fix:
- ✅ No más error `AADSTS90102`
- ✅ Token de Microsoft se canjea correctamente
- ✅ No te saca de la sesión
- ✅ Toggle corporativo se activa automáticamente

## Archivo de referencia

El nodo correcto completo está en: `N8N_MICROSOFT_TENANT_NODE_FIX.json`

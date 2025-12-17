# Configuración n8n para Flujo OAuth Popup

## 🔄 Cambio Importante: De Redirect a Popup

El flujo ahora usa **popup OAuth** con `@react-oauth/google`, lo que significa:
- Google abre un popup
- El usuario autoriza
- Google cierra el popup y devuelve el `code` directamente al frontend
- El frontend envía el `code` a n8n con `redirect_uri: "postmessage"`

## ⚙️ Configuración del Nodo n8n "Canjear Código"

### Actualiza estos parámetros en tu nodo HTTP Request:

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://oauth2.googleapis.com/token",
    "sendBody": true,
    "contentType": "form-urlencoded",
    "bodyParameters": {
      "parameters": [
        {
          "name": "grant_type",
          "value": "authorization_code"
        },
        {
          "name": "client_id",
          "value": "899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com"
        },
        {
          "name": "client_secret",
          "value": "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"
        },
        {
          "name": "redirect_uri",
          "value": "postmessage"
        },
        {
          "name": "code",
          "value": "={{ $json.body.code }}"
        }
      ]
    }
  }
}
```

### ⚠️ Valor Crítico

```
redirect_uri: "postmessage"
```

**NO** uses:
- ❌ `http://localhost:5173/auth/callback`
- ❌ `https://service.computeksa.com/webhook/api/auth/callback`
- ❌ `https://service.computeksa.com/auth/callback`

**Usa SOLO**:
- ✅ `"postmessage"` (literal, sin http://)

## 📋 Scopes Solicitados

El frontend ahora solicita estos permisos:
```
openid profile email 
https://www.googleapis.com/auth/calendar 
https://www.googleapis.com/auth/gmail.send
```

Esto permite:
- ✅ Leer perfil del usuario (email, nombre, foto)
- ✅ Acceder a Google Calendar (crear, leer, editar eventos)
- ✅ Enviar correos desde Gmail

## 🔍 Flujo Completo

```
1. Usuario hace clic en "Continuar con Google"
   ↓
2. Se abre popup de Google con permisos solicitados
   ↓
3. Usuario acepta permisos (ve: Calendar + Gmail)
   ↓
4. Popup se cierra, frontend recibe code
   ↓
5. Frontend envía a n8n:
   POST https://service.computeksa.com/webhook/api/auth/callback
   {
     "code": "4/0ATX87lP...",
     "redirect_uri": "postmessage"
   }
   ↓
6. n8n intercambia code por token con Google
   POST https://oauth2.googleapis.com/token
   {
     "grant_type": "authorization_code",
     "client_id": "...",
     "client_secret": "...",
     "redirect_uri": "postmessage",  ← CLAVE
     "code": "4/0ATX87lP..."
   }
   ↓
7. Google devuelve:
   {
     "access_token": "ya29.a0AfH6...",
     "refresh_token": "1//0gPKJ...",
     "expires_in": 3599,
     "scope": "openid profile email calendar gmail.send",
     "token_type": "Bearer",
     "id_token": "eyJhbGc..."
   }
   ↓
8. n8n debe decodificar id_token (JWT) para obtener usuario
   {
     "sub": "1234567890",
     "email": "user@gmail.com",
     "name": "Usuario Demo",
     "picture": "https://..."
   }
   ↓
9. n8n debe:
   - Guardar access_token y refresh_token en base de datos
   - Crear/actualizar usuario
   - Devolver al frontend:
   {
     "user": {
       "id_user": "...",
       "email": "user@gmail.com",
       "name_user": "Usuario Demo",
       "rol_user": "admin",
       "id_tenant": "...",
       "access_token": "ya29.a0AfH6...",  ← IMPORTANTE
       "refresh_token": "1//0gPKJ..."     ← IMPORTANTE
     }
   }
   ↓
10. Frontend guarda usuario en localStorage
    Redirige a /dashboard
```

## 🗄️ Almacenamiento de Tokens

Los tokens deben guardarse en la base de datos para usar las APIs:

```sql
-- Sugerencia de estructura
ALTER TABLE users ADD COLUMN google_access_token TEXT;
ALTER TABLE users ADD COLUMN google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN google_token_expires TIMESTAMP;
```

## 🔐 Uso de los Tokens

### Para Calendar API
```http
GET https://www.googleapis.com/calendar/v3/calendars/primary/events
Authorization: Bearer ya29.a0AfH6...
```

### Para Gmail API
```http
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Authorization: Bearer ya29.a0AfH6...
Content-Type: application/json

{
  "raw": "base64_encoded_email"
}
```

## 🔄 Refresh Token

Cuando el `access_token` expire (después de ~1 hora):

```http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id=899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com
&client_secret=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
&refresh_token=1//0gPKJ...
```

## 🧪 Pruebas

1. Inicia el servidor:
```bash
npm run dev
```

2. Abre http://localhost:5173/login

3. Haz clic en "Continuar con Google"

4. Verifica que el popup muestre:
   - ✅ "Acceder a Google Calendar"
   - ✅ "Enviar correos en tu nombre"

5. Revisa la consola del navegador:
   - Debe mostrar: `Google Code Recibido: {code: "4/0ATX..."}`

6. Verifica el POST a n8n incluye:
```json
{
  "code": "4/0ATX87lP...",
  "redirect_uri": "postmessage"
}
```

7. Si falla con error 400 "redirect_uri_mismatch":
   - ❌ n8n está usando el redirect_uri incorrecto
   - ✅ Debe ser exactamente: `"postmessage"`

## 📝 Google Console Configuration

En https://console.cloud.google.com/apis/credentials:

### Authorized JavaScript origins
```
http://localhost:5173
https://service.computeksa.com
```

### Authorized redirect URIs
Para el flujo popup, NO necesitas agregar redirect URIs específicas.
Solo los origins son necesarios.

Si Google pide al menos una redirect URI, agrega:
```
http://localhost:5173
https://service.computeksa.com
```

## ❓ Troubleshooting

### Error: "redirect_uri_mismatch"
- Verifica que n8n use `redirect_uri: "postmessage"`
- NO uses URLs reales en el parámetro redirect_uri del token exchange

### Error: "invalid_scope"
- Verifica que los scopes estén habilitados en Google Console
- Ve a "OAuth consent screen" → "Scopes"
- Agrega manualmente:
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/gmail.send`

### El popup se cierra sin devolver code
- Verifica que VITE_GOOGLE_CLIENT_ID esté configurado
- Reinicia el servidor Vite después de cambiar .env
- Revisa errores en la consola del popup (F12 antes de que se cierre)

### Backend retorna "invalid_grant"
- El code ya fue usado (cada code solo se puede usar una vez)
- El code expiró (duran ~10 minutos)
- Pide un nuevo code intentando login de nuevo

---

**Fecha de actualización**: Diciembre 2025
**Estado**: Configuración para flujo popup con Calendar y Gmail

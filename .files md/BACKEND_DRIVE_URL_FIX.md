# Ajuste del Backend para URLs de Google Drive

## 🎯 Objetivo
Que el backend devuelva URLs de Google Drive en el formato correcto para que funcionen directamente en `<img>` sin procesamiento adicional en el frontend.

## 📋 Cambio Necesario en N8N

### ❌ Actualmente guardas:
```
https://drive.google.com/file/d/1y069nHxZxia_WSs6qp6Piv7syjTiGac1/view?usp=drivesdk
```

### ✅ Debes guardar:
```
https://drive.google.com/uc?export=view&id=1y069nHxZxia_WSs6qp6Piv7syjTiGac1
```

---

## 🔧 Solución en N8N

### Opción 1: Set Node (MÁS SIMPLE)

Después del nodo de Google Drive, agrega un **Set Node**:

```
Set Node
├─ Mode: Manual Mapping
└─ Fields to Set:
    ├─ logo_url: https://drive.google.com/uc?export=view&id={{$json.id}}
    └─ (mantener otros campos necesarios)
```

### Opción 2: Code Node (MÁS CONTROL)

Después del nodo de Google Drive, agrega un **Code Node**:

```javascript
// Obtener el FILE_ID de la respuesta de Google Drive
const fileId = $input.item.json.id;

// Construir la URL en el formato correcto
const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

// Devolver todos los datos con la URL correcta
return {
  ...($input.item.json),
  logo_url: imageUrl
};
```

---

## 📝 Workflow Completo Recomendado

```
1. Webhook Trigger
   - Method: POST
   - Tipo: multipart/form-data
   ↓
2. IF Node: ¿Hay archivo 'logo'?
   - Condición: {{$binary.logo}} existe
   ↓ SI
3. Google Drive Upload
   - Binary Property: logo
   - Parent Folder: [TU_FOLDER_ID]
   - Share: Yes (hacer público)
   ↓
4. Set Node: Construir URL
   - logo_url: https://drive.google.com/uc?export=view&id={{$json.id}}
   - (otros campos del form)
   ↓
5. PostgreSQL: Insert/Update Tenant
   - logo_url: {{$json.logo_url}}
   ↓
6. Respond to Webhook
   - Response: {{$json}}
   ↓ NO (en el IF)
7. Set Node: Sin cambio de logo
   - logo_url: {{$json.body.logo_url}} (mantener existente)
   ↓
8. PostgreSQL: Update Tenant
   - (otros campos, sin logo_url)
   ↓
9. Respond to Webhook
```

---

## ✅ Validación

Para verificar que funciona correctamente:

1. **Sube una imagen** desde el frontend
2. **Verifica en la base de datos** que la URL tiene el formato:
   ```
   https://drive.google.com/uc?export=view&id=...
   ```
3. **Copia la URL** y pégala en el navegador
4. **Debe mostrarse la imagen** directamente (no descargarla)

---

## 🚨 Importante: Permisos de Google Drive

El archivo DEBE ser público. En el nodo de Google Drive en N8N:

```
Google Drive Node
├─ Operation: Upload
└─ Options:
    ├─ Share: YES ✅
    └─ Share Type: anyone
```

O agregar un nodo adicional:

```
Google Drive Node
├─ Operation: Share
├─ File ID: {{$json.id}}
└─ Options:
    ├─ Role: reader
    └─ Type: anyone
```

---

## 🎁 Beneficios

Una vez implementado:
- ✅ Frontend más simple y rápido
- ✅ URLs correctas desde la fuente
- ✅ No requiere conversión en el cliente
- ✅ Más fácil de debuggear
- ✅ Mejor performance

---

## 💡 Ejemplo Real

**Tu URL actual:**
```
https://drive.google.com/file/d/1y069nHxZxia_WSs6qp6Piv7syjTiGac1/view?usp=drivesdk
```

**Debe convertirse a:**
```
https://drive.google.com/uc?export=view&id=1y069nHxZxia_WSs6qp6Piv7syjTiGac1
```

**Extraer FILE_ID:** `1y069nHxZxia_WSs6qp6Piv7syjTiGac1`

**En Set Node:**
```
https://drive.google.com/uc?export=view&id=1y069nHxZxia_WSs6qp6Piv7syjTiGac1
```

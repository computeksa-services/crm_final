# Configuración de URLs de Google Drive para Imágenes

## Solución Actual
Las imágenes se suben a **Google Drive** y solo guardamos la **URL** en la base de datos.

## ⚠️ Importante: Formato de URL

### ❌ URL que devuelve el backend actualmente (NO funciona en `<img>`)
```
https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
```

### ✅ URL que DEBE devolver el backend (Funciona en `<img>`)
```
https://drive.google.com/uc?export=view&id=FILE_ID
```

### 🔧 RECOMENDACIÓN
**Ajusta el backend para devolver directamente el formato correcto.** Esto evita procesamiento innecesario en el frontend.

## Configuración del Backend (N8N)

Tu workflow de N8N debe:

1. **Recibir el FormData** con el archivo de imagen
2. **Subir a Google Drive** usando el nodo de Google Drive
3. **Hacer el archivo público** (importante para que se pueda ver sin autenticación)
4. **Extraer el FILE_ID** de la respuesta
5. **Guardar en la base de datos** la URL en formato correcto:
   ```
   https://drive.google.com/uc?export=view&id={FILE_ID}
   ```

### Ejemplo de Workflow N8N

```
1. Webhook Trigger
   ↓
2. Split Binary Data (extraer el archivo 'logo')
   ↓
3. Google Drive Node
   - Action: Upload
   - Options:
     * Share: true (hacer público)
     * Parent Folder: ID de tu carpeta en Drive
   ↓
4. Code Node (⚠️ IMPORTANTE: Convertir URL al formato correcto)
   ```javascript
   // Extraer el FILE_ID de la respuesta de Google Drive
   const fileId = $input.item.json.id;
   
   // Construir la URL en formato correcto para imágenes
   const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
   
   // IMPORTANTE: No guardes la URL que viene de Drive (file/d/ID/view)
   // Siempre construye esta URL con el formato uc?export=view&id=
   
   return { 
     ...($input.item.json),
     logo_url: imageUrl  // Esta es la URL que se guarda en la BD
   };
   ```
   ↓
5. PostgreSQL Node
   - Operation: Update/Insert
   - Fields: { logo_url: {{$json.logo_url}} }
```

### ⚙️ Alternativa Simple en N8N

Si prefieres no usar Code Node, puedes construir la URL directamente con Set Node:

```
Set Node:
- Name: logo_url
- Value: https://drive.google.com/uc?export=view&id={{$json.id}}
```

## Permisos de Google Drive

**IMPORTANTE:** El archivo debe ser público para que funcione sin autenticación.

En el nodo de Google Drive en N8N:
- Activar opción "Share" 
- O usar un paso adicional para hacer el archivo público:
  ```
  Google Drive Node → Share File → Anyone with the link can view
  ```

## Frontend: Conversión Temporal

⚠️ **El frontend actualmente convierte las URLs automáticamente**, pero esto es TEMPORAL:

```typescript
// Si recibes: https://drive.google.com/file/d/ABC123/view?usp=drivesdk
// Se extrae el FILE_ID y se convierte a: https://drive.google.com/uc?export=view&id=ABC123
```

### 🎯 Mejor Solución: Ajustar el Backend

En lugar de convertir en el frontend, es mejor que el backend devuelva directamente el formato correcto:

**Backend (N8N) debe guardar:**
```
https://drive.google.com/uc?export=view&id={FILE_ID}
```

**No guardar:**
```
https://drive.google.com/file/d/{FILE_ID}/view?usp=drivesdk
```

**Ventajas:**
- ✅ Menos procesamiento en el frontend
- ✅ Una sola fuente de verdad
- ✅ Más eficiente
- ✅ Más fácil de mantener

## Testing

Para probar que una URL funciona:

```bash
# Probar en el navegador
https://drive.google.com/uc?export=view&id=TU_FILE_ID

# Si se descarga en lugar de mostrarse, el archivo no es público
# Solución: Hacer el archivo público en Google Drive
```

## Troubleshooting

### La imagen no carga
- ✅ Verificar que la URL esté en formato correcto
- ✅ Verificar que el archivo sea público en Google Drive
- ✅ Verificar que el FILE_ID sea correcto
- ✅ Ver errores en la consola del navegador (F12)

### Aparece icono de "imagen rota"
- El archivo probablemente no es público
- Hacer clic derecho en Drive → Compartir → Cualquiera con el enlace puede ver

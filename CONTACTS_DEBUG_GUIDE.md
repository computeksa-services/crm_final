# Guía de Debugging - Contactos y Equipo

## 🔧 Cambios Realizados

He arreglado 3 problemas principales en `FinancialCreate.tsx`:

### 1. **Contactos de Empresa No Aparecen**
**Problema:** El filtrado estaba buscando el campo equivocado
**Solución:** Ahora intenta filtrar por múltiples campos posibles:
- `id_client_company`
- `id_company`
- `company_id`
- `id_contact`

**Cómo verificar:**
1. Abre la consola (F12)
2. Selecciona una empresa en el dropdown
3. Busca logs que digan:
   ```
   🔍 Filtrando contactos: {...}
   ✅ Contactos filtrados: [...]
   ```
4. Si la lista filtrada está vacía, el problema es que el API retorna datos con estructura diferente

---

### 2. **Equipo Sin Correo**
**Problema:** El mapeo de datos del equipo no incluía todos los campos de email posibles
**Solución:** Ahora el mapeo busca en:
- `email`
- `email_user`
- Fallback: campo vacío con "(sin email)"

**Cómo verificar:**
1. En la consola, busca:
   ```
   👥 Equipo cargado: [...]
   👥 Equipo mapeado: [...]
   ```
2. Cada miembro debe tener `email` poblado

---

### 3. **No Permite Seleccionar Varios**
**Problema:** El identificador único del checkbox era incorrecto (solo usaba email)
**Problemas de la versión anterior:**
- Si dos contactos de diferentes tipos tenían el mismo email, se deshabilitaba uno
- Los keys del DOM no eran únicos

**Solución implementada:**
- Keys únicos: `contact-${id}-${idx}`, `team-member-${id}-${idx}`
- Comparación única: `${type}-${id}-${email}`
- Ahora puedes seleccionar a Juan como contacto Y como miembro del equipo sin conflictos

---

## 📊 Estructura de Datos Esperada

### Contactos del API (`/api/clients/contacts`)
```json
[
  {
    "id_contact": "contact_123",
    "id_client_company": "company_456",
    "name": "Juan Pérez",
    "email": "juan@empresa.com",
    "position": "Gerente",
    "is_main": true
  }
]
```

**Campos que busca el código:**
- `id_contact` o `id` (identificador)
- `id_client_company`, `id_company`, o `company_id` (relación con empresa)
- `name`, `first_name`, o `name_contact` (nombre)
- `email` o `email_contact` (correo electrónico)

### Equipo del API (`/api/users`)
```json
[
  {
    "id_user": "user_789",
    "name_user": "María García",
    "email": "maria@company.com"
  }
]
```

**Campos que busca el código:**
- `id_user` o `id` (identificador)
- `name_user` o `name` (nombre)
- `email` o `email_user` (correo)

---

## 🐛 Cómo Debuggear Si Aún No Funciona

### Paso 1: Verificar los logs en consola
1. Abre DevTools (F12)
2. Haz refresh (F5)
3. Busca estos logs:
   ```
   📋 Contactos cargados: [...]
   👥 Equipo cargado: [...]
   👥 Equipo mapeado: [...]
   ```

### Paso 2: Ver estructura real de los datos
Copia en la consola:
```javascript
// Para ver contactos cargados
copy(JSON.stringify(document.__contactos, null, 2))

// Para ver equipo cargado
copy(JSON.stringify(document.__equipo, null, 2))
```

### Paso 3: Añadir más logs si es necesario
Si aún no funciona, avísame y podemos añadir:
```javascript
window.__contactos = contactsList;
window.__equipo = mappedTeam;
```

Esto te permitirá ver exactamente qué datos está recibiendo el componente.

---

## ✅ Validaciones Ahora Incluyen

### Para Contactos de Empresa:
- ✓ Filtrado correcto por empresa
- ✓ Email mostrado correctamente
- ✓ Nombre completo mostrado
- ✓ Checkbox funciona para seleccionar/deseleccionar
- ✓ Puedes seleccionar múltiples contactos

### Para Equipo:
- ✓ Carga del API `/api/users`
- ✓ Email mostrado (si existe)
- ✓ Fallback a "(sin email)" si no existe
- ✓ Checkbox funciona para seleccionar/deseleccionar
- ✓ Puedes seleccionar múltiples miembros

### Para Externos:
- ✓ Input email + nombre
- ✓ Botón + para agregar
- ✓ Validación: requiere email y nombre
- ✓ Se agrega correctamente a seleccionados

---

## 📱 UI Cambios

**Antes:**
```
Mi Equipo
☑ Juan
☑ María
```

**Después:**
```
Mi Equipo (5)
☑ Juan (juan@empresa.com)
☑ María (maria@empresa.com)
☑ Carlos (sin email)
☑ Ana (ana@empresa.com)
☑ Pedro (sin email)
```

---

## 🎯 Siguientes Pasos

Si algo aún no funciona:
1. **Abre DevTools (F12)**
2. **Selecciona una empresa**
3. **Copia los 3 logs que aparecen**
4. **Comparte conmigo:**
   - Los logs que ves
   - La estructura real de los datos (si puedes copiarla)
   - Qué paso exacto no funciona

Eso me permitirá ajustar el filtrado para tu API específico.

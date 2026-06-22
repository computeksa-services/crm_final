#!/usr/bin/env bash
# TESTING GUIDE - Marketing Center Actualizado
# Archivo: TEST_ADVANCED_FILTERS.md

---

## 🧪 GUÍA DE TESTING

**Objetivo:** Validar que los filtros avanzados de Marketing Center funcionan correctamente con:
1. IDs relacionales para Categoría y País
2. Nuevos filtros de Historial de Compra

---

## ✅ TEST 1: Verificar que el Modal Carga Correctamente

### Pasos:
1. Navegar a **Marketing Center → Audiencias**
2. Crear o abrir una lista existente
3. Clickear tab **"Agregar Contactos"**
4. Clickear botón **"Más Filtros"**

### Esperado:
```
✅ Sección "Filtros Avanzados" se expande
✅ Aparecen campos: Categoría, Industria, Cargo, Ciudad, País, Etiquetas
✅ Se cargan opciones en los dropdowns (sin errores en consola)
✅ Aparece NUEVA sección "🛒 Historial de Compra" con:
   - Productos Comprados (checkboxes)
   - Estado de Venta (checkboxes)
   - Período (input numérico)
```

### Validar en Console:
```javascript
// Abrir DevTools (F12)
// En Console, revisar que NO hay errores como:
// ❌ "Cannot read property 'products' of undefined"
// ❌ "Cannot read property 'quoteStatuses' of undefined"

// Ver el estado actual:
// (Solo si está disponible en React DevTools)
// filterOptions.products debería ser un array
// filterOptions.quoteStatuses debería ser un array
```

---

## ✅ TEST 2: Seleccionar Filtros de Categoría y País

### Pasos:
1. En **"Categoría Empresa"** → Seleccionar "B2B"
2. En **"País"** → Seleccionar "Ecuador"
3. Observar DevTools Network tab

### Esperado en Payload:
```json
{
  "id_company_type": "ctype_b2b",  // ID, NO "B2B"
  "id_country": "EC",              // ID, NO "Ecuador"
  "city": "",
  "tags_ids": [],
  "bought_product_ids": [],
  "winning_status_ids": [],
  "purchase_period_days": undefined
}
```

### Validar:
```javascript
// En DevTools → Network → POST /api/marketing/contacts/search
// Abrir "Payload" y verificar:
✅ "id_company_type": "ctype_..." (string, not null)
✅ "id_country": "EC" (string, not null)
❌ NO debe contener "company_category" (deprecated)
❌ NO debe contener "country" (deprecated)
```

---

## ✅ TEST 3: Seleccionar Etiquetas (Ahora son IDs)

### Pasos:
1. En **"Etiquetas Empresa"** → Seleccionar "VIP" y "Partner"
2. Revisar Network tab

### Esperado en Payload:
```json
{
  "tags_ids": ["clab_01", "clab_02"]  // Array de IDs, NO de strings
}
```

### Validar:
```javascript
// En DevTools → Network → POST /api/marketing/contacts/search
✅ tags_ids es un array de strings
✅ Cada elemento es un ID único (ej: "clab_01")
❌ NO debe contener "company_tags" (deprecated)
```

---

## ✅ TEST 4: Usar Nuevos Filtros de Historial de Compra

### 4A. Productos Comprados
**Pasos:**
1. Clickear checkboxes en **"Productos Comprados"**
   - ✓ "Software de Gestión"
   - ✓ "Servicio de Consultoría"
2. Revisar Network

**Esperado:**
```json
{
  "bought_product_ids": ["prod_045", "prod_089"]
}
```

### 4B. Estado de Venta
**Pasos:**
1. Clickear checkboxes en **"Estado de Venta"**
   - ✓ "Ganada"
   - ✓ "Facturada"
2. Revisar Network

**Esperado:**
```json
{
  "winning_status_ids": ["qstat_won_01", "qstat_inv_02"]
}
```

### 4C. Período de Compra
**Pasos:**
1. En input **"Período"** → Ingresar `90`
2. Revisar Network

**Esperado:**
```json
{
  "purchase_period_days": 90  // number, no string
}
```

---

## ✅ TEST 5: Filtro Combinado (Caso Real)

### Escenario:
> Buscar contactos que:
> - Trabajen en empresas B2B
> - En la industria "Software"
> - Ubicados en Ecuador
> - Con etiqueta "VIP"
> - Que compraron "Producto A"
> - En los últimos 180 días
> - Con estado de venta "Ganada"

### Pasos:
1. **Categoría Empresa:** Seleccionar "B2B"
2. **Industria:** Seleccionar "Software"
3. **País:** Seleccionar "Ecuador"
4. **Etiquetas:** Marcar ✓ "VIP"
5. **Productos Comprados:** Marcar ✓ "Producto A"
6. **Período:** Ingresar `180`
7. **Estado de Venta:** Marcar ✓ "Ganada"

### Esperado en Payload:
```json
{
  "id_tenant": "tenant_123",
  "id_company_type": "ctype_b2b",
  "industry": "software",
  "id_country": "EC",
  "tags_ids": ["clab_vip"],
  "bought_product_ids": ["prod_001"],
  "purchase_period_days": 180,
  "winning_status_ids": ["qstat_won_01"]
}
```

### Resultado esperado:
- 📊 Mostrar X contactos que coinciden con TODOS los criterios
- ✅ Permitir seleccionar contactos para agregar a la lista

---

## ✅ TEST 6: Botón "Limpiar Filtros"

### Pasos:
1. Seleccionar varios filtros (como Test 5)
2. Clickear **"🗑️ Limpiar Filtros"**

### Esperado:
```javascript
// Todos los campos deben resetearse:
filters = {
  search: '',
  id_company: '',
  id_company_type: '',        // vacío
  tags_ids: [],               // array vacío
  position: '',
  city: '',
  id_country: '',             // vacío (no "country")
  industry: '',
  bought_product_ids: [],     // array vacío
  winning_status_ids: [],     // array vacío
  purchase_period_days: null  // null (no 0)
}
```

### Validar:
```javascript
// En DevTools → Network → Última solicitud
// Debe estar vacía o con valores por defecto:
✅ Todos los filtros optionales son undefined o arrays vacíos
```

---

## 🐛 TEST 7: Validar No Hay Errores en Console

### Abrir DevTools (F12) → Pestana "Console"

### ❌ Errores que NO deberían aparecer:
```
✗ "Cannot read property 'products' of undefined"
✗ "Cannot read property 'quoteStatuses' of undefined"
✗ "company_tags is not defined"
✗ "country is not defined"
✗ "company_category is not defined"
✗ TypeError in setFilters()
```

### ✅ Errores que SON aceptables:
```
→ Network errors si el backend no está implementado
→ Warnings de React sobre keys (si existen)
```

---

## 📈 TEST 8: Verificar Debounce Funciona

### Pasos:
1. Abrir **DevTools → Network → XHR/Fetch**
2. En filtro **"Búsqueda"** → Escribir rápidamente: `test test test`
3. Observar Network

### Esperado:
```
❌ NO debe haber 9 solicitudes (una por cada keystroke)
✅ Debe haber 1 solicitud después de 500ms de inactividad

El debounce evita:
- Sobrecargar el servidor
- Resultados incompletos
- Latencia visual
```

### Validar:
```javascript
// En Network tab:
// Contar solicitudes POST a /api/marketing/contacts/search
// Debería haber solo 1 (no 9)
```

---

## 🔄 TEST 9: Verificar Campos Deprecated Han Sido Removidos

### En Network → POST /api/marketing/contacts/search Payload:

```javascript
// ❌ Estos campos NO deben aparecer:
"company_category"    // Cambió a "id_company_type"
"country"            // Cambió a "id_country"
"company_tags"       // Cambió a "tags_ids"

// ✅ Estos campos DEBEN aparecer:
"id_company_type"
"id_country"
"tags_ids"
"bought_product_ids"    // NUEVO
"winning_status_ids"    // NUEVO
"purchase_period_days"  // NUEVO
```

---

## 📋 TEST 10: Caso Especial - Arrays Vacíos vs Undefined

### Pasos:
1. NO seleccionar nada en "Productos Comprados"
2. NO seleccionar nada en "Estado de Venta"
3. Enviar búsqueda (presionar Enter en búsqueda u otro filtro)

### Esperado en Payload:
```json
{
  "bought_product_ids": [],    // Array vacío, NOT undefined
  "winning_status_ids": [],    // Array vacío, NOT undefined
  "purchase_period_days": undefined  // undefined si no está seteado
}
```

### Validar:
```javascript
// En console:
// Arrays vacíos se serializan como "[]"
// undefined se omite del JSON serializado

// Payload correcto:
{
  "bought_product_ids": [],
  "winning_status_ids": []
  // purchase_period_days no aparece si es undefined
}
```

---

## 📊 CHECKLIST DE TESTING

```
INTERFAZ:
 ☐ Modal abre correctamente
 ☐ Sección "Más Filtros" se expande/colapsa
 ☐ Nueva sección "Historial de Compra" visible
 ☐ Checkboxes funcionales en Productos y Estados
 ☐ Input numérico para Período aceptaValidación

DATOS:
 ☐ filterOptions.categories cargadas
 ☐ filterOptions.tags cargadas
 ☐ filterOptions.countries cargadas
 ☐ filterOptions.cities cargadas
 ☐ filterOptions.industries cargadas
 ☐ filterOptions.products cargadas (NUEVO)
 ☐ filterOptions.quoteStatuses cargadas (NUEVO)

PAYLOAD:
 ☐ id_company_type envía ID (no texto)
 ☐ id_country envía ID (no texto)
 ☐ tags_ids envía array de IDs
 ☐ bought_product_ids envía array correcto
 ☐ winning_status_ids envía array correcto
 ☐ purchase_period_days envía número correcto

ESTADO:
 ☐ Filtros se guardan en estado correctamente
 ☐ Botón "Limpiar Filtros" reseteapropiadmente
 ☐ Debounce funciona (500ms)

ERRORES:
 ☐ No hay TypeScript errors
 ☐ No hay undefined references
 ☐ No hay deprecated fields en payload
 ☐ Console limpia de errores
```

---

## 🎬 VIDEO TESTING (Paso a Paso)

```bash
1. Abrir Modal de Audiencia
   → Tab "Agregar Contactos"
   → Clickear "Más Filtros"

2. Llenar Filtro Demográfico:
   → Categoría: B2B
   → País: Ecuador
   → Etiquetas: VIP, Partner

3. Llenar Filtro de Compra:
   → Productos: Software de Gestión
   → Estado: Ganada
   → Período: 90

4. Abrir DevTools (F12)
   → Network tab
   → Buscar solicitud POST
   → Verificar Payload tiene:
      {
        "id_company_type": "ctype_b2b",
        "id_country": "EC",
        "tags_ids": ["clab_01", "clab_02"],
        "bought_product_ids": ["prod_001"],
        "winning_status_ids": ["qstat_won_01"],
        "purchase_period_days": 90
      }

5. Clickear "Limpiar Filtros"
   → Verificar que todos se resetean

6. Resultado:
   ✅ Si el payload es correcto → Frontend está listo
   ❌ Si hay errores → Revisar console
```

---

## 🚀 SI TODO PASA TESTING

```bash
✅ Frontend implementado correctamente
✅ IDs relacionales funcionales
✅ Nuevos filtros de Cross-Selling funcionales
✅ Payload estructura correcta

PRÓXIMO PASO: Backend debe implementar:
□ Actualizar /api/marketing/tools/filter-options para incluir:
  - products
  - quoteStatuses

□ Actualizar /api/marketing/contacts/search para procesar:
  - bought_product_ids
  - winning_status_ids
  - purchase_period_days
```

---

## 🔗 ARCHIVOS RELACIONADOS

- **Modal:** [AudienceMembersModal.tsx](components/marketing_center/audiences/AudienceMembersModal.tsx)
- **Documentación:** [MARKETING_CENTER_UPDATES.md](MARKETING_CENTER_UPDATES.md)
- **Quick Ref:** [CHANGES_QUICK_REFERENCE.md](CHANGES_QUICK_REFERENCE.md)

---

**Última Actualización:** Enero 22, 2026  
**Estado:** ✅ LISTO PARA TESTING COMPLETO

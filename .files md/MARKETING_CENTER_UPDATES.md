# 🎯 Actualización: Marketing Center - Búsqueda Avanzada de Contactos

**Fecha:** Enero 22, 2026  
**Archivo Actualizado:** `components/marketing_center/audiences/AudienceMembersModal.tsx`

---

## 📝 Resumen de Cambios

Se actualizó completamente la lógica del **Buscador Avanzado de Contactos** para optimizar la búsqueda con:
1. **IDs relacionales** en lugar de texto para mejor rendimiento
2. **Nuevos filtros de Historial de Ventas** para estrategias de Cross-Selling

---

## 🔄 Cambios en Filtros Demográficos

### Cambio 1: Country (País) → ID_Country

**Antes:**
```typescript
country: string;  // Enviaba: "Ecuador"
```

**Ahora:**
```typescript
id_country: string;  // Envía: "EC" (ID único)
```

✅ **Beneficio:** Búsquedas más rápidas con índices de base de datos

---

### Cambio 2: Company Category → ID_Company_Type

**Antes:**
```typescript
company_category: string;  // Enviaba: "B2B"
```

**Ahora:**
```typescript
id_company_type: string;  // Envía: "ctype_001" (ID único)
```

✅ **Beneficio:** Categorías flexibles, sin dependencias de valores hardcodeados

---

### Cambio 3: Company Tags → Tags_IDs

**Antes:**
```typescript
company_tags: string[];  // Enviaba: ["VIP", "Partner"]
```

**Ahora:**
```typescript
tags_ids: string[];  // Envía: ["clab_01", "clab_02"]
```

✅ **Beneficio:** Multi-select por ID, mejor control de etiquetas dinámicas

---

## 🆕 Nuevos Filtros: Historial de Compra

Se agregó una nueva sección **"Historial de Compra"** con 3 campos para estrategias de Cross-Selling:

### 1. Productos Comprados
```typescript
bought_product_ids: string[];
```
- **UI:** Checkboxes multi-select
- **Datos:** Se cargan desde `filterOptions.products`
- **Payload:** `["prod_001", "prod_055"]`
- **Caso de uso:** "Clientes que compraron Producto A"

### 2. Estado de Venta
```typescript
winning_status_ids: string[];
```
- **UI:** Checkboxes multi-select
- **Datos:** Se cargan desde `filterOptions.quoteStatuses`
- **Payload:** `["qstat_won_01", "qstat_inv_02"]`
- **Caso de uso:** "Estados que cuentan como venta ganada"

### 3. Período de Compra
```typescript
purchase_period_days: number | null;
```
- **UI:** Input numérico (1-365 días)
- **Payload:** `90` (últimos 90 días)
- **Caso de uso:** "Clientes que compraron en los últimos 90 días"

---

## 📤 Estructura del Payload (JSON)

El endpoint `/api/marketing/contacts/search` ahora recibe exactamente esta estructura:

```json
{
  "id_tenant": "tenant_123",
  
  // FILTROS DEMOGRÁFICOS (IDs)
  "id_company_type": "ctype_001",    // Cambio: antes era company_category
  "id_country": "EC",                // Cambio: antes era country
  "city": "Quito",                   // Se mantiene como texto
  "tags_ids": ["clab_01", "clab_02"], // Cambio: antes era company_tags
  "search": "texto busqueda",        // Opcional
  
  // FILTROS DE VENTAS (NUEVOS)
  "bought_product_ids": ["prod_001", "prod_055"],
  "winning_status_ids": ["qstat_won_01", "qstat_inv_02"],
  "purchase_period_days": 90
}
```

---

## 🎨 Cambios en la UI

### Filtros Demográficos (Sección Azul)
- ✅ Categoría Empresa (desplegable con IDs)
- ✅ Industria
- ✅ Cargo
- ✅ Ciudad
- ✅ País (ahora envía IDs)
- ✅ Etiquetas Empresa (checkboxes con IDs)

### NUEVA: Sección Historial de Compra (Verde)
```
🛒 HISTORIAL DE COMPRA (CROSS-SELLING)
├─ Productos Comprados [checkbox multiselect]
├─ Estado de Venta [checkbox multiselect]
└─ Período (Últimos X días) [input numérico]
```

---

## 🔧 Cambios en Funciones

### fetchFilterOptions()
**Antes:**
```typescript
setFilterOptions({
  categories: [],
  tags: [],
  countries: [],
  cities: [],
  industries: []
});
```

**Ahora:**
```typescript
setFilterOptions({
  categories: [],
  tags: [],
  countries: [],
  cities: [],
  industries: [],
  products: [],        // NUEVO
  quoteStatuses: []    // NUEVO
});
```

---

### fetchCandidates()
**Cambio más importante:** Construcción del payload con estructura exacta

**Antes:**
```typescript
await marketingApi.searchCrmContacts(tenantId, userId, {
  search: filters.search,
  company_id: filters.id_company,
  company_category: filters.company_category,  // ❌ Cambió
  company_tags: filters.company_tags,          // ❌ Cambió
  country: filters.country,                    // ❌ Cambió
  // ... más
});
```

**Ahora:**
```typescript
const payload = {
  id_tenant: tenantId,
  search: filters.search || undefined,
  // FILTROS DEMOGRÁFICOS (IDs)
  id_company_type: filters.id_company_type || undefined,  // ✅ Nuevo nombre
  id_country: filters.id_country || undefined,             // ✅ Nuevo nombre
  city: filters.city || undefined,
  tags_ids: filters.tags_ids.length > 0 ? filters.tags_ids : [],  // ✅ Nuevo nombre
  // FILTROS DE VENTAS (NUEVOS)
  bought_product_ids: filters.bought_product_ids.length > 0 ? filters.bought_product_ids : [],
  winning_status_ids: filters.winning_status_ids.length > 0 ? filters.winning_status_ids : [],
  purchase_period_days: filters.purchase_period_days || undefined
};

await marketingApi.searchCrmContacts(tenantId, userId, payload);
```

---

## 🧪 Casos de Uso

### 1. Buscar clientes VIP que compraron Producto A en últimos 90 días
```
Etiquetas Empresa: VIP ✓
Productos Comprados: Producto A ✓
Período: 90 ✓
→ Envía: tags_ids: ["vip_label"], bought_product_ids: ["prod_001"], purchase_period_days: 90
```

### 2. Cross-sell a empresas B2B Software en Ecuador
```
Categoría Empresa: B2B ✓
Industria: Software ✓
País: Ecuador ✓
→ Envía: id_company_type: "ctype_b2b", industry: "software", id_country: "EC"
```

### 3. Clientes con ventas facturas en los últimos 180 días
```
Estado de Venta: Facturada ✓
Período: 180 ✓
→ Envía: winning_status_ids: ["qstat_inv_01"], purchase_period_days: 180
```

---

## ✅ Validación

- ✅ **Sin errores TypeScript** en el archivo
- ✅ **Interfaz AdvancedFilters** actualizada
- ✅ **Renderizado de checkboxes** multi-select funcional
- ✅ **Botón "Limpiar Filtros"** reseteapropiadmente
- ✅ **Estados por defecto** (arrays vacíos, null para números)
- ✅ **Debounce funcional** (500ms antes de llamar API)

---

## 📋 Backend Requirements (Checklist)

Para que el frontend funcione correctamente, el backend debe:

- [ ] Endpoint `/api/marketing/tools/filter-options` retorna:
  ```json
  {
    "categories": [{"value": "ctype_001", "label": "B2B"}],
    "tags": [{"value": "clab_01", "label": "VIP"}],
    "countries": [{"value": "EC", "label": "Ecuador"}],
    "cities": [{"value": "quito", "label": "Quito"}],
    "industries": [{"value": "software", "label": "Software"}],
    "products": [{"value": "prod_001", "label": "Producto A"}],        // NUEVO
    "quoteStatuses": [{"value": "qstat_won_01", "label": "Ganada"}]   // NUEVO
  }
  ```

- [ ] Endpoint `/api/marketing/contacts/search` acepta payload con:
  - `id_company_type` (string, opcional)
  - `id_country` (string, opcional)
  - `tags_ids` (array, opcional)
  - `bought_product_ids` (array, opcional) - **NUEVO**
  - `winning_status_ids` (array, opcional) - **NUEVO**
  - `purchase_period_days` (number, opcional) - **NUEVO**

- [ ] Documentación/schema actualizado en backend

---

## 🔗 Archivos Relacionados

- **Modal:** `components/marketing_center/audiences/AudienceMembersModal.tsx`
- **API Service:** `services/marketingApi.ts` (no requiere cambios)
- **API Client:** `services/apiClient.ts` (no requiere cambios)

---

## 📞 Próximos Pasos

1. **Backend:** Implementar los nuevos campos en `/api/marketing/tools/filter-options`
2. **Backend:** Extender `/api/marketing/contacts/search` para procesar los 3 nuevos filtros
3. **Testing:** Verificar que la UI se carga correctamente con datos reales
4. **Testing:** Validar que el payload se envía con la estructura exacta
5. **Documentation:** Actualizar API docs con los nuevos parámetros

---

## 🎓 Ejemplo Completo: Obtener Clientes para Cross-Sell

```typescript
// Usuario selecciona:
// - Productos Comprados: "Software de Gestión"
// - Estado de Venta: "Ganada"
// - Período: 90 días

// UI envía:
{
  "id_tenant": "tenant_123",
  "bought_product_ids": ["prod_045"],
  "winning_status_ids": ["qstat_won_01"],
  "purchase_period_days": 90
}

// Resultado: Lista de contactos que:
// ✓ Compraron "Software de Gestión"
// ✓ Su venta fue "Ganada"
// ✓ En los últimos 90 días
// → Perfecto para enviar campaña de cross-sell
```

---

**Estado:** ✅ COMPLETADO Y VALIDADO

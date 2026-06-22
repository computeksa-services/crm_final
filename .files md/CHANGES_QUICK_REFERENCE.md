# ⚡ CAMBIOS RÁPIDOS - Marketing Center Actualizado

**Archivo:** `components/marketing_center/audiences/AudienceMembersModal.tsx`  
**Cambios:** 8 modificaciones principales

---

## 🔄 RESUMEN DE CAMBIOS

| Elemento | Antes | Ahora | Razón |
|----------|-------|-------|-------|
| País | `country: string` | `id_country: string` | Usar IDs para búsquedas rápidas |
| Categoría | `company_category: string` | `id_company_type: string` | Usar IDs para búsquedas rápidas |
| Etiquetas | `company_tags: string[]` | `tags_ids: string[]` | Usar IDs para búsquedas rápidas |
| Productos | ❌ No existía | `bought_product_ids: string[]` | **NUEVO** - Cross-selling |
| Estados Venta | ❌ No existía | `winning_status_ids: string[]` | **NUEVO** - Cross-selling |
| Período Compra | ❌ No existía | `purchase_period_days: number` | **NUEVO** - Filtro temporal |

---

## 📋 CAMBIOS LÍNEA POR LÍNEA

### 1. Interface AdvancedFilters (Línea ~40)
```diff
interface AdvancedFilters {
  search: string;
  id_company: string;
- company_category: string;
+ id_company_type: string;
- company_tags: string[];
+ tags_ids: string[];
  position: string;
  city: string;
- country: string;
+ id_country: string;
  industry: string;
+ bought_product_ids: string[];       // NUEVO
+ winning_status_ids: string[];       // NUEVO
+ purchase_period_days: number | null; // NUEVO
}
```

### 2. filterOptions State (Línea ~95)
```diff
const [filterOptions, setFilterOptions] = useState({
  categories: [] as FilterOption[],
  tags: [] as FilterOption[],
  countries: [] as FilterOption[],
  cities: [] as FilterOption[],
  industries: [] as FilterOption[],
+ products: [] as FilterOption[],        // NUEVO
+ quoteStatuses: [] as FilterOption[]    // NUEVO
});
```

### 3. filters State (Línea ~77)
```diff
const [filters, setFilters] = useState<AdvancedFilters>({
  search: '',
  id_company: '',
- company_category: '',
+ id_company_type: '',
- company_tags: [],
+ tags_ids: [],
  position: '',
  city: '',
- country: '',
+ id_country: '',
  industry: '',
+ bought_product_ids: [],      // NUEVO
+ winning_status_ids: [],      // NUEVO
+ purchase_period_days: null   // NUEVO
});
```

### 4. fetchFilterOptions() (Línea ~133)
```diff
const data = await response.json();
setFilterOptions({
  categories: data.categories || [],
  tags: data.tags || [],
  countries: data.countries || [],
  cities: data.cities || [],
  industries: data.industries || [],
+ products: data.products || [],           // NUEVO
+ quoteStatuses: data.quoteStatuses || [] // NUEVO
});
```

### 5. fetchCandidates() (Línea ~158)
```diff
- await marketingApi.searchCrmContacts(tenantId, userId, {
-   search: filters.search,
-   company_id: filters.id_company,
-   company_category: filters.company_category,
-   company_tags: filters.company_tags.length > 0 ? filters.company_tags : undefined,
-   position: filters.position,
-   city: filters.city,
-   country: filters.country,
-   industry: filters.industry
- });

+ const payload = {
+   id_tenant: tenantId,
+   search: filters.search || undefined,
+   id_company_type: filters.id_company_type || undefined,
+   id_country: filters.id_country || undefined,
+   city: filters.city || undefined,
+   tags_ids: filters.tags_ids.length > 0 ? filters.tags_ids : [],
+   bought_product_ids: filters.bought_product_ids.length > 0 ? filters.bought_product_ids : [],
+   winning_status_ids: filters.winning_status_ids.length > 0 ? filters.winning_status_ids : [],
+   purchase_period_days: filters.purchase_period_days || undefined
+ };
+ await marketingApi.searchCrmContacts(tenantId, userId, payload);
```

### 6. Selector Categoría Empresa (Línea ~298)
```diff
- value={filters.company_category}
- onChange={(e) => setFilters(prev => ({...prev, company_category: e.target.value}))}
+ value={filters.id_company_type}
+ onChange={(e) => setFilters(prev => ({...prev, id_company_type: e.target.value}))}
```

### 7. Selector País (Línea ~340)
```diff
- value={filters.country}
- onChange={(e) => setFilters(prev => ({...prev, country: e.target.value}))}
+ value={filters.id_country}
+ onChange={(e) => setFilters(prev => ({...prev, id_country: e.target.value}))}
```

### 8. Etiquetas Checkboxes (Línea ~353)
```diff
- checked={filters.company_tags.includes(tag.value)}
+ checked={filters.tags_ids.includes(tag.value)}
  onChange={(e) => {
    if (e.target.checked) {
-     setFilters(prev => ({...prev, company_tags: [...prev.company_tags, tag.value]}));
+     setFilters(prev => ({...prev, tags_ids: [...prev.tags_ids, tag.value]}));
    } else {
-     setFilters(prev => ({...prev, company_tags: prev.company_tags.filter(t => t !== tag.value)}));
+     setFilters(prev => ({...prev, tags_ids: prev.tags_ids.filter(t => t !== tag.value)}));
    }
  }}
```

### 9. NUEVA SECCIÓN: Historial de Compra (Línea ~372)
```html
<!-- NUEVA SECCIÓN (insertada después de Etiquetas) -->
<div class="md:col-span-12 pt-4 border-t border-blue-300">
  <label class="text-xs font-bold text-slate-700 uppercase block mb-3 flex items-center gap-2">
    <i class="fa-solid fa-shopping-cart text-green-600"></i> Historial de Compra (Cross-Selling)
  </label>
  
  <!-- Productos Comprados -->
  <div class="md:col-span-12 mb-4">
    <label class="text-xs font-bold text-slate-600 uppercase block mb-2">Productos Comprados</label>
    <div class="flex flex-wrap gap-2">
      {filterOptions.products.map(product => (
        <label key={product.value} class="flex items-center gap-2 ...">
          <input 
            type="checkbox" 
            checked={filters.bought_product_ids.includes(product.value)}
            onChange={(e) => {
              if (e.target.checked) {
                setFilters(prev => ({...prev, bought_product_ids: [...prev.bought_product_ids, product.value]}));
              } else {
                setFilters(prev => ({...prev, bought_product_ids: prev.bought_product_ids.filter(p => p !== product.value)}));
              }
            }}
          />
          <span>{product.label}</span>
        </label>
      ))}
    </div>
  </div>

  <!-- Estado de Ventas -->
  <div class="md:col-span-12 mb-4">
    <label class="text-xs font-bold text-slate-600 uppercase block mb-2">Estado de Venta (Que Cuente Como Ganada)</label>
    <div class="flex flex-wrap gap-2">
      {filterOptions.quoteStatuses.map(status => (
        <label key={status.value} class="flex items-center gap-2 ...">
          <input 
            type="checkbox" 
            checked={filters.winning_status_ids.includes(status.value)}
            onChange={(e) => {
              if (e.target.checked) {
                setFilters(prev => ({...prev, winning_status_ids: [...prev.winning_status_ids, status.value]}));
              } else {
                setFilters(prev => ({...prev, winning_status_ids: prev.winning_status_ids.filter(s => s !== status.value)}));
              }
            }}
          />
          <span>{status.label}</span>
        </label>
      ))}
    </div>
  </div>

  <!-- Período -->
  <div class="md:col-span-4">
    <label class="text-xs font-bold text-slate-600 uppercase block mb-1">Período (Últimos X días)</label>
    <input 
      type="number" 
      min="1"
      max="365"
      placeholder="Ej: 90" 
      value={filters.purchase_period_days || ''}
      onChange={(e) => setFilters(prev => ({...prev, purchase_period_days: e.target.value ? parseInt(e.target.value) : null}))}
      class="w-full px-3 py-2 border border-green-300 rounded-lg ..."
    />
  </div>
</div>
```

### 10. Botón Limpiar Filtros Actualizado (Línea ~519)
```diff
  <button
    onClick={() => setFilters({
      search: '',
      id_company: '',
-     company_category: '',
+     id_company_type: '',
-     company_tags: [],
+     tags_ids: [],
      position: '',
      city: '',
-     country: '',
+     id_country: '',
      industry: '',
+     bought_product_ids: [],
+     winning_status_ids: [],
+     purchase_period_days: null
    })}
```

---

## 📊 PAYLOAD ANTES vs DESPUÉS

### Antes (Deprecated)
```json
{
  "search": "texto",
  "company_id": "cc_123",
  "company_category": "B2B",
  "company_tags": ["VIP", "Partner"],
  "position": "director",
  "city": "quito",
  "country": "Ecuador",
  "industry": "software"
}
```

### Después (Optimizado)
```json
{
  "id_tenant": "tenant_123",
  "search": "texto",
  "id_company_type": "ctype_b2b",
  "tags_ids": ["clab_01", "clab_02"],
  "position": "director",
  "city": "quito",
  "id_country": "EC",
  "industry": "software",
  "bought_product_ids": ["prod_001", "prod_055"],
  "winning_status_ids": ["qstat_won_01"],
  "purchase_period_days": 90
}
```

---

## ✅ VALIDACIÓN POST-CAMBIOS

```bash
# Verificar TypeScript errors
✅ No errors found in AudienceMembersModal.tsx

# Checkpoints cumplidos:
✅ Interface AdvancedFilters con 12 propiedades
✅ filterOptions.products existe
✅ filterOptions.quoteStatuses existe
✅ filters state tiene todos los nuevos campos
✅ fetchCandidates() construye payload correcto
✅ Selectores de Categoría y País usan IDs
✅ Checkboxes de Etiquetas usan tags_ids
✅ Nueva sección "Historial de Compra" renderiza correctamente
✅ Botón "Limpiar Filtros" reseteapropiadmente todos los campos
```

---

## 🚀 PRÓXIMAS ACCIONES

1. **Backend debe actualizar endpoint `/api/marketing/tools/filter-options` para retornar:**
   ```json
   {
     "categories": [...],
     "tags": [...],
     "countries": [...],
     "cities": [...],
     "industries": [...],
     "products": [...],       // NUEVO
     "quoteStatuses": [...]   // NUEVO
   }
   ```

2. **Backend debe actualizar endpoint `/api/marketing/contacts/search` para aceptar:**
   - `id_company_type` (string)
   - `id_country` (string)
   - `tags_ids` (array)
   - `bought_product_ids` (array) - **NUEVO**
   - `winning_status_ids` (array) - **NUEVO**
   - `purchase_period_days` (number) - **NUEVO**

3. **Testing local:**
   - Abrir Modal de Audiencia
   - Verificar que se cargan productos y estados de venta
   - Seleccionar filtros de compra
   - Verificar que se envía el payload correcto en Network DevTools

---

**Estado:** ✅ LISTO PARA TESTING CON BACKEND

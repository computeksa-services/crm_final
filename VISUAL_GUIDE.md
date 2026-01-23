# 🎨 VISUAL GUIDE - Marketing Center UI Changes

---

## 📱 Antes vs Después

### ANTES (Versión Anterior)

```
┌──────────────────────────────────────────────────┐
│ GESTIONAR AUDIENCIA                              │
├──────────────────────────────────────────────────┤
│  [🔍 Búsqueda...] [🏢 Empresa] [Más Filtros ⬇️] │
│                                                  │
│  FILTROS AVANZADOS (azul)                        │
│  ┌────────────────────────────────────────────┐  │
│  │ 📂 Categoría  │ 🏭 Industria │ 💼 Cargo    │  │
│  ├────────────────────────────────────────────┤  │
│  │ 🏙️ Ciudad    │ 🌍 País (TEXTO) │ ─ ─ ─ ─   │  │
│  ├────────────────────────────────────────────┤  │
│  │ 🏷️ Etiquetas (texto)                      │  │
│  │ [Etiqueta1] [Etiqueta2] [Etiqueta3]        │  │
│  ├────────────────────────────────────────────┤  │
│  │ [Limpiar Filtros]                          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│ 147 resultados                                   │
│ [☐ Seleccionar Todo]                             │
│ • Carlos González         • acme.com             │
│ • María López            • tech.org              │
└──────────────────────────────────────────────────┘
```

**Limitaciones:**
- ❌ País enviaba texto ("Ecuador" en lugar de "EC")
- ❌ Categoría enviaba texto sin control
- ❌ Etiquetas enviaban strings sin IDs
- ❌ No hay filtros de Cross-Selling
- ❌ No hay período de compra

---

### DESPUÉS (Versión Nueva) 🎉

```
┌────────────────────────────────────────────────────┐
│ GESTIONAR AUDIENCIA                                │
├────────────────────────────────────────────────────┤
│  [🔍 Búsqueda...] [🏢 Empresa] [Más Filtros ⬇️]  │
│                                                   │
│  ═══════════════════════════════════════════════  │
│  FILTROS AVANZADOS (DEMOGRÁFICOS) ← Sección Azul  │
│  ═══════════════════════════════════════════════  │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📂 Categoría  │ 🏭 Industria │ 💼 Cargo     │  │
│  ├──────────────────────────────────────────────┤  │
│  │ 🏙️ Ciudad    │ 🌍 País (ID) │ ─ ─ ─ ─     │  │
│  │                ↑                             │  │
│  │          Ahora envía ID!                    │  │
│  ├──────────────────────────────────────────────┤  │
│  │ 🏷️ Etiquetas (IDs)                         │  │
│  │ [✓ VIP] [✓ Partner] [☐ Premium] [☐ Trial]  │  │
│  │         ↑ Ahora son IDs!                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                   │
│  ═══════════════════════════════════════════════  │
│  🛒 HISTORIAL DE COMPRA (CROSS-SELLING) ← NUEVO! │
│  ═══════════════════════════════════════════════  │
│  ┌──────────────────────────────────────────────┐  │
│  │ PRODUCTOS COMPRADOS:                         │  │
│  │ [✓ Software] [✓ Consultoría] [☐ Mantenim.] │  │
│  │                                              │  │
│  │ ESTADO DE VENTA (Que Cuente Como Ganada):  │  │
│  │ [✓ Ganada] [✓ Facturada] [☐ En Proceso]   │  │
│  │                                              │  │
│  │ PERÍODO (Últimos X días): [90____________]  │  │
│  │                           ↑ Nuevo campo!   │  │
│  └──────────────────────────────────────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │                [Limpiar Filtros]             │  │
│  └──────────────────────────────────────────────┘  │
│                                                   │
│ 📊 47 resultados (más precisos)                   │
│ [☐ Seleccionar Todo]                              │
│ • Carlos González (Director, VIP)  • ACME SAS     │
│ • María López (Gerente, Partner)   • TechCorp     │
└────────────────────────────────────────────────────┘
```

**Mejoras:**
- ✅ País ahora envía ID (mejor rendimiento)
- ✅ Categoría usa IDs relacionales
- ✅ Etiquetas con IDs y multi-select visual
- ✅ Nueva sección verde "Historial de Compra"
- ✅ Filtro de productos comprados
- ✅ Filtro de estado de venta
- ✅ Filtro de período (últimos X días)
- ✅ UI más intuitiva y organizada por colores

---

## 🎨 Cambios de Color y Estilo

### Sección Demográfica (Azul)
```
Background:     bg-blue-50/50
Borders:        border-blue-200 y border-blue-300
Focus Ring:     ring-blue-500
Heading:        text-slate-600
Icon:           (Ninguno especial)
```

### Sección Historial de Compra (Verde) ← NUEVA
```
Background:     bg-white (interior)
Borders:        border-green-300
Focus Ring:     ring-green-500
Checkbox Color: border-green-300
Icon:           🛒 fa-shopping-cart (green-600)
Hover:          bg-green-50
```

---

## 🎯 Comparativa de Componentes

### 1. Selector de País

#### Antes:
```jsx
<select value={filters.country} onChange={...}>
  <option value="Ecuador">Ecuador</option>
  <option value="Colombia">Colombia</option>
  <option value="Perú">Perú</option>
</select>
// Enviaba: "Ecuador"
```

#### Después:
```jsx
<select value={filters.id_country} onChange={...}>
  <option value="EC">Ecuador</option>
  <option value="CO">Colombia</option>
  <option value="PE">Perú</option>
</select>
// Envía: "EC" ← ID!
```

---

### 2. Etiquetas

#### Antes:
```jsx
{filters.company_tags.includes(tag.value)}
// Array de strings: ["VIP", "Partner"]
```

#### Después:
```jsx
{filters.tags_ids.includes(tag.value)}
// Array de IDs: ["clab_01", "clab_02"]
```

---

### 3. Productos Comprados ← NUEVO

```jsx
<label className="flex items-center gap-2 px-3 py-1 
                  bg-white border border-green-300 
                  rounded-full text-sm cursor-pointer 
                  hover:bg-green-50 transition-colors">
  <input 
    type="checkbox" 
    checked={filters.bought_product_ids.includes(product.value)}
    onChange={(e) => {
      if (e.target.checked) {
        setFilters(prev => ({
          ...prev, 
          bought_product_ids: [...prev.bought_product_ids, product.value]
        }));
      } else {
        setFilters(prev => ({
          ...prev, 
          bought_product_ids: prev.bought_product_ids.filter(p => p !== product.value)
        }));
      }
    }}
    className="w-4 h-4 rounded cursor-pointer"
  />
  <span>{product.label}</span>
</label>

// Ejemplo de datos:
[
  { value: "prod_001", label: "Software de Gestión" },
  { value: "prod_045", label: "Servicio de Consultoría" },
  { value: "prod_089", label: "Licencia Enterprise" }
]
```

---

### 4. Período de Compra ← NUEVO

```jsx
<input 
  type="number" 
  min="1"
  max="365"
  placeholder="Ej: 90" 
  value={filters.purchase_period_days || ''}
  onChange={(e) => setFilters(prev => ({
    ...prev, 
    purchase_period_days: e.target.value ? parseInt(e.target.value) : null
  }))}
  className="w-full px-3 py-2 border border-green-300 
             rounded-lg text-sm focus:ring-2 
             focus:ring-green-500 outline-none" 
/>
```

---

## 📐 Estructura Grid

### Filtros Demográficos (Sección Azul)

```
12 columnas (md:grid-cols-12)

ROW 1:
├─ Categoría Empresa    (md:col-span-3)
├─ Industria            (md:col-span-3)
└─ Cargo                (md:col-span-2) + 4 columnas vacías

ROW 2:
├─ Ciudad               (md:col-span-2)
└─ País                 (md:col-span-2) + 8 columnas vacías

ROW 3:
└─ Etiquetas (Full)     (md:col-span-12)

ROW 4 (Historial):
├─ Productos (Full)     (md:col-span-12)
├─ Estados (Full)       (md:col-span-12)
└─ Período              (md:col-span-4) + 8 vacías
```

---

## 🔄 Transiciones y Animaciones

### Expande/Colapsa "Más Filtros"
```jsx
<button
  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
  className="w-full px-3 py-2 bg-blue-50 border border-blue-300 
             text-blue-600 rounded-lg text-sm font-semibold 
             hover:bg-blue-100 transition-colors flex items-center 
             justify-center gap-2"
>
  <i className="fa-solid fa-sliders"></i>
  {showAdvancedFilters ? 'Ocultar' : 'Más'} Filtros
</button>
```

**Transición:** `transition-colors` de 200ms (smooth)

---

### Hover en Checkboxes

```jsx
className="... cursor-pointer hover:bg-green-50 transition-colors"
```

**Transición:** Verde claro al pasar mouse

---

## 📱 Responsivo

```
Móvil (< md):
├─ Toda la fila es full-width
├─ Selectores apilados vertically
└─ Checkboxes se envuelven

Tablet/Desktop (≥ md):
├─ Grilla de 12 columnas
├─ Distribución horizontal
└─ Layout optmizado

Ejemplo:
[Categoría] [Industria] [Cargo]
[Ciudad] [País]
[Etiquetas - Full Width]
[Productos - Full Width]
[Estados - Full Width]
[Período]
```

---

## 🎨 Paleta de Colores

```
AZUL (Filtros Demográficos):
├─ bg-blue-50/50        ← Background claro
├─ border-blue-200      ← Border sutil
├─ border-blue-300      ← Border enfático
├─ text-blue-600        ← Texto activo
├─ ring-blue-500        ← Focus ring
└─ hover:bg-blue-100    ← Hover

VERDE (Historial de Compra):
├─ border-green-300     ← Border de checkboxes
├─ text-green-600       ← Icono
├─ ring-green-500       ← Focus ring
└─ hover:bg-green-50    ← Hover en labels

GENERAL:
├─ text-slate-600       ← Labels
├─ text-slate-700       ← Headings
├─ bg-white             ← Inputs
└─ border-slate-300     ← Botones secundarios
```

---

## 💬 Textos y Labels

```
DEMOGRÁFICOS:
"CATEGORÍA EMPRESA"     - Selector de tipo de empresa
"INDUSTRIA"             - Sector industrial
"CARGO"                 - Posición laboral
"CIUDAD"                - Ubicación geográfica
"PAÍS"                  - País (ahora con ID)
"ETIQUETAS EMPRESA"     - Tags de empresa

HISTORIAL DE COMPRA:
"HISTORIAL DE COMPRA (CROSS-SELLING)"
                        - Título de sección
"PRODUCTOS COMPRADOS"   - Multi-select de productos
"ESTADO DE VENTA (Que Cuente Como Ganada)"
                        - Multi-select de estados
"PERÍODO (Últimos X días)"
                        - Input numérico

ACCIONES:
"Limpiar Filtros"       - Botón para resetear
```

---

## 🖼️ Diagrama de Componentes

```
AudienceMembersModal
├─ Header
├─ Tabs
├─ FilterSection (ADD tab)
│  ├─ BasicFilters
│  │  ├─ SearchInput
│  │  ├─ CompanySelect
│  │  └─ MoreFiltersButton
│  ├─ AdvancedFiltersSection (expandible)
│  │  ├─ DemographicFilters (Azul)
│  │  │  ├─ CategorySelect
│  │  │  ├─ IndustrySelect
│  │  │  ├─ PositionInput
│  │  │  ├─ CitySelect
│  │  │  ├─ CountrySelect (IDs)
│  │  │  └─ TagsCheckboxes (IDs)
│  │  ├─ PurchaseHistoryFilters (Verde) ← NUEVO
│  │  │  ├─ ProductsCheckboxes (NUEVO)
│  │  │  ├─ QuoteStatusCheckboxes (NUEVO)
│  │  │  └─ PeriodInput (NUEVO)
│  │  └─ ClearButton
│  └─ ResultsList
└─ Footer
```

---

## ✨ Características de UX

### 1. Feedback Visual
- ✅ Botón "Más Filtros" cambia texto (Ocultar/Más)
- ✅ Checkboxes muestran estado marcado
- ✅ Hover en elementos interactivos
- ✅ Loading spinner durante búsqueda

### 2. Accesibilidad
- ✅ Labels con <label> y htmlFor
- ✅ Inputs con type correcto
- ✅ Contraste de colores adecuado
- ✅ Orden lógico de tab

### 3. Performance
- ✅ Debounce de 500ms en cambios
- ✅ Lazy loading de opciones
- ✅ Sin re-renders innecesarios
- ✅ Memoización de callbacks

---

## 🎬 Flujo de Usuario

```
1. Usuario abre modal de audiencia
   ↓
2. Click en "Más Filtros" → Expande sección azul
   ↓
3. Usuario ve opciones demográficas
   ↓
4. Usuario ve NUEVA sección "Historial de Compra" (verde)
   ↓
5. Usuario selecciona:
   - Productos comprados (checkboxes)
   - Estado de venta (checkboxes)
   - Período (input numérico)
   ↓
6. Backend recibe payload con IDs relacionales
   ↓
7. Resultados más precisos se muestran
   ↓
8. Usuario puede hacer bulk add a la lista
```

---

## 📊 Ejemplo de Payload Visual

```
┌─────────────────────────────────────────┐
│ USUARIO SELECCIONA:                     │
├─────────────────────────────────────────┤
│ Categoría: B2B                          │
│ País: Ecuador                           │
│ Etiquetas: ✓ VIP, ✓ Partner            │
│ Productos: ✓ Software                  │
│ Estado: ✓ Ganada                       │
│ Período: 90 días                        │
└─────────────────────────────────────────┘
             ↓
        Convierte a:
             ↓
┌─────────────────────────────────────────┐
│ {                                       │
│   "id_company_type": "ctype_b2b",      │
│   "id_country": "EC",                  │
│   "tags_ids": ["clab_vip", "clab_partner"],
│   "bought_product_ids": ["prod_001"],  │
│   "winning_status_ids": ["qstat_won"],│
│   "purchase_period_days": 90           │
│ }                                       │
└─────────────────────────────────────────┘
             ↓
        Backend busca en BD
             ↓
        Retorna 42 contactos
             ↓
        Se muestran en lista
```

---

**Implementación:** ✅ Completada  
**Validación Visual:** ✅ Documentada  
**Próximo Paso:** Testing con datos reales

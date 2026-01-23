# Mejoras del Marketing Center - Filtrado Avanzado de Contactos

## 📋 Resumen de Cambios

Se ha mejorado significativamente la lógica de agregación de contactos en listas de distribución dentro del Marketing Center. Ahora cuenta con filtrado avanzado y mayor variabilidad en la selección y búsqueda de contactos.

---

## ✨ Nuevas Características Implementadas

### 1. **Campos Extendidos de Contacto**
El tipo `Contact` ahora incluye los siguientes campos:
- `id_client_company` - ID de la empresa del contacto
- `city` - Ciudad (mejorado)
- `country` - País (NUEVO)
- `company_category` - Categoría de la empresa (NUEVO)
- `company_tags` - Etiquetas de la empresa (NUEVO, múltiples)
- `company_industry` - Industria de la empresa (NUEVO)

### 2. **Interfaz de Filtros Mejorada**
Nuevo tipo `AdvancedFilters` con:
```typescript
{
  search: string;              // Búsqueda por nombre/email
  id_company: string;          // Filtro por empresa
  company_category: string;    // Filtro por categoría
  company_tags: string[];      // Filtro por etiquetas (múltiple)
  position: string;            // Filtro por cargo
  city: string;                // Filtro por ciudad (separado)
  country: string;             // Filtro por país (NUEVO, separado)
  industry: string;            // Filtro por industria
}
```

### 3. **Sistema de Filtros Básicos + Avanzados**
- **Filtros Básicos** (siempre visibles):
  - Búsqueda por nombre/email
  - Filtro por empresa
  - Botón "Más Filtros" para expandir opciones avanzadas

- **Filtros Avanzados** (expandibles):
  - Categoría de Empresa (dropdown)
  - Industria (dropdown)
  - Cargo (texto)
  - Ciudad (dropdown con opciones disponibles)
  - País (dropdown con opciones disponibles)
  - Etiquetas de Empresa (checkboxes múltiples)
  - Botón "Limpiar Filtros" para resetear todos los valores

### 4. **Opciones Dinámicas de Filtros**
Nuevo endpoint que trae opciones disponibles:
```typescript
fetchFilterOptions() // Obtiene:
- categories[]     // Categorías disponibles
- tags[]           // Etiquetas disponibles
- countries[]      // Países disponibles
- cities[]         // Ciudades disponibles
- industries[]     // Industrias disponibles
```

### 5. **Mejora Visual de Contactos en Lista**
Los contactos ahora muestran:
- Nombre y email
- Empresa (badge gris)
- Cargo (badge azul)
- Ciudad (badge verde con 📍)
- País (badge verde con 🌍)
- Categoría de Empresa (badge púrpura)
- Industria (badge naranja)
- Etiquetas (badges índigo con #)

Ejemplo visual:
```
[Avatar] Juan Pérez
         juan@email.com
         [Empresa A] [Gerente] [📍 Quito] [🌍 Ecuador] [B2B] [Software]
         [#Lead] [#Premium]
```

---

## 🔧 Cambios Técnicos Realizados

### Archivo Modificado: `AudienceMembersModal.tsx`

#### 1. Tipos de Datos Extendidos
```typescript
interface Contact {
  id_contact: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position?: string;
  company_name?: string;
  id_client_company?: string;
  city?: string;
  country?: string;                    // NUEVO
  company_category?: string;           // NUEVO
  company_tags?: string[] | string;    // NUEVO
  company_industry?: string;           // NUEVO
  is_subscribed?: boolean;
}

interface AdvancedFilters {
  search: string;
  id_company: string;
  company_category: string;            // NUEVO
  company_tags: string[];              // NUEVO
  position: string;
  city: string;                        // NUEVO (separado de country)
  country: string;                     // NUEVO
  industry: string;                    // NUEVO
}

interface FilterOption {
  value: string;
  label: string;
}
```

#### 2. Estados Mejorados
```typescript
const [filters, setFilters] = useState<AdvancedFilters>({...});
const [filterOptions, setFilterOptions] = useState({
  categories: [],
  tags: [],
  countries: [],
  cities: [],
  industries: []
});
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
```

#### 3. Nueva Función: `fetchFilterOptions()`
```typescript
const fetchFilterOptions = async () => {
  // Obtiene desde: /api/marketing/tools/filter-options
  // Retorna: categories, tags, countries, cities, industries
};
```

#### 4. Mejora en `fetchCandidates()`
Ahora envía al backend:
```typescript
{
  search: filters.search,
  company_id: filters.id_company,
  company_category: filters.company_category,      // NUEVO
  company_tags: filters.company_tags,              // NUEVO
  position: filters.position,
  city: filters.city,                              // NUEVO
  country: filters.country,                        // NUEVO
  industry: filters.industry                       // NUEVO
}
```

#### 5. UI de Filtros Expandible
- Filtros básicos en una fila
- Botón "Más Filtros" que expande sección de filtros avanzados
- Fondo azul claro para diferenciar filtros avanzados
- Botón "Limpiar Filtros" para resetear todos

#### 6. Visualización Mejorada de Contactos
Ahora muestra todos los campos en badges coloreados:
- Empresa (gris)
- Cargo (azul)
- Ciudad (verde)
- País (verde)
- Categoría (púrpura)
- Industria (naranja)
- Etiquetas (índigo)

---

## 🔌 Endpoints Requeridos (Backend)

El backend debe implementar/actualizar estos endpoints:

### 1. Obtener Opciones de Filtros
```
GET /api/marketing/tools/filter-options?id_tenant={tenantId}

Response:
{
  "categories": [
    {"value": "tech", "label": "Tecnología"},
    {"value": "finance", "label": "Finanzas"}
  ],
  "tags": [
    {"value": "vip", "label": "VIP"},
    {"value": "partner", "label": "Partner"}
  ],
  "countries": [
    {"value": "EC", "label": "Ecuador"},
    {"value": "CO", "label": "Colombia"}
  ],
  "cities": [
    {"value": "quito", "label": "Quito"},
    {"value": "guayaquil", "label": "Guayaquil"}
  ],
  "industries": [
    {"value": "software", "label": "Software"},
    {"value": "retail", "label": "Retail"}
  ]
}
```

### 2. Buscar Contactos (Mejorado)
```
POST /api/marketing/contacts/search

Request:
{
  "id_tenant": "...",
  "id_user": "...",
  "search": "juan",
  "company_id": "...",
  "company_category": "tech",
  "company_tags": ["vip", "partner"],
  "position": "gerente",
  "city": "quito",
  "country": "EC",
  "industry": "software"
}

Response: Contact[]
```

---

## 💡 Casos de Uso Mejorados

### Ejemplo 1: Filtrar por Ubicación Geográfica
**Antes:** Solo podía buscar "Quito/Ecuador" en un campo combinado
**Ahora:** Puede seleccionar Ciudad y País por separado de dropdowns

### Ejemplo 2: Segmentación por Tipo de Empresa
**Antes:** No había manera de filtrar por categoría o industria
**Ahora:** Puede seleccionar Categoría (B2B, B2C, etc) e Industria (Software, Retail, etc)

### Ejemplo 3: Selección por Etiquetas
**Antes:** No se podían filtrar por etiquetas
**Ahora:** Puede seleccionar múltiples etiquetas (VIP, Partner, Premium, etc)

### Ejemplo 4: Búsqueda Refinada
**Antes:** Filtros básicos y limitados
**Ahora:** Combina múltiples criterios: Empresa + Categoría + País + Cargo + Etiquetas

---

## 🎨 Interfaz Visual

### Vista de Filtros Básicos
```
┌─────────────────────────────────────────────────────┐
│ [Buscar nombre o email] [Empresa] [Más Filtros] |
└─────────────────────────────────────────────────────┘
```

### Vista de Filtros Avanzados (Expandida)
```
┌─────────────────────────────────────────────────────┐
│ [Categoría] [Industria] [Cargo] [Ciudad] [País]  |
│ [Etiquetas múltiples...]                           |
│                            [Limpiar Filtros]       |
└─────────────────────────────────────────────────────┘
```

### Vista de Contacto en Lista
```
┌─────────────────────────────────────────────────────┐
│ ☐ [J] Juan Pérez                                   |
│     juan@empresa.com                                |
│     [Empresa] [Gerente] [📍Quito] [🌍Ecuador]   |
│     [B2B] [Software]                                |
│     [#Lead] [#Premium] [#VIP]                       |
└─────────────────────────────────────────────────────┘
```

---

## ✅ Testing Recomendado

1. **Filtros Básicos**
   - [ ] Búsqueda por nombre funciona
   - [ ] Búsqueda por email funciona
   - [ ] Filtro por empresa funciona

2. **Filtros Avanzados**
   - [ ] Expandir/Contraer filtros avanzados
   - [ ] Seleccionar categoría filtra resultados
   - [ ] Seleccionar país filtra resultados
   - [ ] Seleccionar múltiples etiquetas filtra resultados
   - [ ] Limpiar filtros resetea todo

3. **Visualización**
   - [ ] Todos los badges se muestran correctamente
   - [ ] Responsive en móvil y desktop
   - [ ] Los colores de los badges son distinguibles

4. **Rendimiento**
   - [ ] Debounce de 500ms en fetchCandidates funciona
   - [ ] No hay múltiples llamadas simultáneas
   - [ ] Los resultados se actualizan suavemente

---

## 📦 Dependencias

No se agregaron nuevas dependencias. Se utiliza:
- React hooks (useState, useEffect)
- Tailwind CSS (clases existentes)
- FontAwesome (iconos)

---

## 🚀 Próximas Mejoras Sugeridas

1. **Guardar Filtros Favoritos**
   - Guardar combinaciones de filtros frecuentes

2. **Filtros Más Avanzados**
   - Rango de presupuesto
   - Empleados (mínimo/máximo)
   - Antiguedad de la empresa

3. **Exportación**
   - Exportar lista de contactos filtrados a CSV/Excel

4. **Segmentación Inteligente**
   - Sugerencias de segmentos basadas en datos históricos

5. **Pre-visualización**
   - Ver cantidad de contactos antes de agregar

---

## 📝 Notas Importantes

- El componente mantiene backward compatibility
- Los campos nuevos son opcionales en el tipo Contact
- El filtrado es acumulativo (AND lógico)
- Las etiquetas soportan múltiple selección
- Los dropdowns cargan dinámicamente desde el backend

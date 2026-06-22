# Endpoints de CRM y Marketing Center
## Base URL: `${VITE_WEBHOOK_URL}/api`

---

## 📋 ÍNDICE DE ENDPOINTS

1. [Empresas (Client Companies)](#empresas-client-companies)
2. [Contactos (Client Contacts)](#contactos-client-contacts)
3. [Etiquetas (Tags)](#etiquetas-tags)
4. [Categorías](#categorías)
5. [Tipo de Cliente](#tipo-de-cliente)
6. [Marketing - Empresas](#marketing-empresas)
7. [Marketing - Filtros Avanzados](#marketing-filtros-avanzados)
8. [Marketing - Contactos](#marketing-contactos)

---

## 🏢 EMPRESAS (CLIENT COMPANIES)

### GET - Obtener todas las empresas
```
GET /api/clients/companies
```
**Respuesta:**
```json
[
  {
    "id_client_company": "cc_001",
    "id_tenant": "tenant_123",
    "name_company": "Tech Solutions Inc",
    "type_client": "EMPRESA",
    "category": "B2B",
    "industry": "Software",
    "tags": ["VIP", "Partner"],
    "city": "Quito",
    "country": "Ecuador",
    "email": "contact@techsolutions.com",
    "phone": "+593-2-123-4567",
    "website": "https://techsolutions.com",
    "created_at": "2025-01-20T10:30:00Z"
  }
]
```

### GET - Obtener empresa por ID
```
GET /api/clients/companies/{id_client_company}
```

### POST - Crear nueva empresa
```
POST /api/clients/companies

Body:
{
  "id_tenant": "tenant_123",
  "name_company": "Nueva Empresa",
  "type_client": "EMPRESA",
  "category": "B2B",
  "industry": "Software",
  "tags": ["tag1", "tag2"],
  "city": "Quito",
  "country": "Ecuador",
  "email": "info@empresa.com",
  "phone": "+593-2-123-4567"
}
```

### PUT - Actualizar empresa
```
PUT /api/clients/companies/{id_client_company}

Body:
{
  "name_company": "Nombre actualizado",
  "category": "B2C",
  "tags": ["NewTag"],
  "city": "Guayaquil"
}
```

### DELETE - Eliminar empresa
```
DELETE /api/clients/companies/{id_client_company}
```

---

## 👥 CONTACTOS (CLIENT CONTACTS)

### GET - Obtener todos los contactos
```
GET /api/clients/contacts
```
**Respuesta:**
```json
[
  {
    "id_contact": "contact_001",
    "id_tenant": "tenant_123",
    "id_client_company": "cc_001",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@empresa.com",
    "position": "Gerente General",
    "city": "Quito",
    "country": "Ecuador",
    "phone": "+593-9-123-4567",
    "is_subscribed": true,
    "created_at": "2025-01-15T08:00:00Z"
  }
]
```

### GET - Obtener contacto por ID
```
GET /api/clients/contacts/{id_contact}
```

### GET - Obtener contactos por empresa
```
GET /api/clients/contacts?id_client_company={id_client_company}
```

### POST - Crear nuevo contacto
```
POST /api/clients/contacts

Body:
{
  "id_tenant": "tenant_123",
  "id_client_company": "cc_001",
  "first_name": "María",
  "last_name": "López",
  "email": "maria@empresa.com",
  "position": "Directora",
  "city": "Quito",
  "country": "Ecuador",
  "phone": "+593-9-987-6543"
}
```

### PUT - Actualizar contacto
```
PUT /api/clients/contacts/{id_contact}

Body:
{
  "first_name": "María",
  "position": "VP de Ventas",
  "city": "Guayaquil"
}
```

### DELETE - Eliminar contacto
```
DELETE /api/clients/contacts/{id_contact}
```

---

## 🏷️ ETIQUETAS (TAGS)

### GET - Obtener todas las etiquetas
```
GET /api/crm/tags?id_tenant={id_tenant}
```
**Respuesta:**
```json
[
  {
    "id_tag": "tag_001",
    "id_tenant": "tenant_123",
    "name": "VIP",
    "color": "#FF6B6B",
    "description": "Clientes VIP",
    "usage_count": 45
  }
]
```

### GET - Obtener etiquetas por tipo
```
GET /api/crm/tags?id_tenant={id_tenant}&type=company
GET /api/crm/tags?id_tenant={id_tenant}&type=contact
```

### POST - Crear nueva etiqueta
```
POST /api/crm/tags

Body:
{
  "id_tenant": "tenant_123",
  "name": "Premium",
  "color": "#FFD700",
  "description": "Clientes Premium",
  "type": "company"
}
```

### PUT - Actualizar etiqueta
```
PUT /api/crm/tags/{id_tag}

Body:
{
  "name": "Premium Updated",
  "color": "#FFA500",
  "description": "Clientes Premium actualizados"
}
```

### DELETE - Eliminar etiqueta
```
DELETE /api/crm/tags/{id_tag}
```

---

## 📂 CATEGORÍAS

### GET - Obtener todas las categorías
```
GET /api/crm/categories?id_tenant={id_tenant}
```
**Respuesta:**
```json
[
  {
    "id_category": "cat_001",
    "id_tenant": "tenant_123",
    "name": "B2B",
    "type": "company_type",
    "color": "#3498db"
  },
  {
    "id_category": "cat_002",
    "id_tenant": "tenant_123",
    "name": "B2C",
    "type": "company_type",
    "color": "#2ecc71"
  }
]
```

### GET - Obtener categorías por tipo
```
GET /api/crm/categories?id_tenant={id_tenant}&type=company_size
GET /api/crm/categories?id_tenant={id_tenant}&type=industry
```

### POST - Crear nueva categoría
```
POST /api/crm/categories

Body:
{
  "id_tenant": "tenant_123",
  "name": "Enterprise",
  "type": "company_size",
  "color": "#9b59b6"
}
```

---

## 🎯 TIPO DE CLIENTE

### GET - Obtener todos los tipos de cliente
```
GET /api/crm/client-types?id_tenant={id_tenant}
```
**Respuesta:**
```json
[
  {
    "id_client_type": "ct_001",
    "id_tenant": "tenant_123",
    "name": "Empresa",
    "description": "Persona Jurídica"
  },
  {
    "id_client_type": "ct_002",
    "id_tenant": "tenant_123",
    "name": "Persona Natural",
    "description": "Persona Natural"
  }
]
```

### POST - Crear nuevo tipo de cliente
```
POST /api/crm/client-types

Body:
{
  "id_tenant": "tenant_123",
  "name": "Distribuidora",
  "description": "Empresa Distribuidora"
}
```

---

## 📊 MARKETING - EMPRESAS

### GET - Obtener empresas para Marketing
```
GET /api/marketing/tools/companies?id_tenant={id_tenant}
```
**Respuesta:**
```json
[
  {
    "id_client_company": "cc_001",
    "name_company": "Tech Solutions",
    "category": "B2B",
    "tags": ["VIP", "Partner"],
    "industry": "Software",
    "contact_count": 15
  }
]
```

### POST - Crear empresa desde Marketing
```
POST /api/marketing/companies

Body:
{
  "id_tenant": "tenant_123",
  "id_user": "user_123",
  "name_company": "Nueva Empresa",
  "category": "B2B",
  "industry": "Tecnología"
}
```

---

## 🔍 MARKETING - FILTROS AVANZADOS

### GET - Obtener opciones de filtros
```
GET /api/marketing/tools/filter-options?id_tenant={id_tenant}
```
**Respuesta:**
```json
{
  "categories": [
    {"value": "b2b", "label": "B2B"},
    {"value": "b2c", "label": "B2C"},
    {"value": "b2b2c", "label": "B2B2C"}
  ],
  "tags": [
    {"value": "vip", "label": "VIP"},
    {"value": "partner", "label": "Partner"},
    {"value": "prospect", "label": "Prospecto"}
  ],
  "countries": [
    {"value": "EC", "label": "Ecuador"},
    {"value": "CO", "label": "Colombia"},
    {"value": "PE", "label": "Perú"}
  ],
  "cities": [
    {"value": "quito", "label": "Quito"},
    {"value": "guayaquil", "label": "Guayaquil"},
    {"value": "cuenca", "label": "Cuenca"}
  ],
  "industries": [
    {"value": "software", "label": "Software"},
    {"value": "hardware", "label": "Hardware"},
    {"value": "retail", "label": "Retail"}
  ]
}
```

### POST - Crear opción de filtro
```
POST /api/marketing/tools/filter-options

Body:
{
  "id_tenant": "tenant_123",
  "type": "category",
  "value": "new_category",
  "label": "Nueva Categoría"
}
```

---

## 🎪 MARKETING - CONTACTOS

### GET - Buscar contactos en CRM (básico)
```
GET /api/marketing/contacts/search?id_tenant={id_tenant}&id_user={id_user}&search={query}&company_id={id}&position={cargo}&location={ciudad}
```

### POST - Buscar contactos en CRM (avanzado)
```
POST /api/marketing/contacts/search

Body:
{
  "id_tenant": "tenant_123",
  "id_user": "user_123",
  "search": "juan",
  "company_id": "cc_001",
  "company_category": "B2B",
  "company_tags": ["vip", "partner"],
  "position": "gerente",
  "city": "quito",
  "country": "EC",
  "industry": "software"
}

Respuesta:
[
  {
    "id_contact": "contact_001",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@empresa.com",
    "position": "Gerente",
    "company_name": "Tech Solutions",
    "id_client_company": "cc_001",
    "city": "Quito",
    "country": "Ecuador",
    "company_category": "B2B",
    "company_tags": ["VIP"],
    "company_industry": "Software",
    "is_subscribed": true
  }
]
```

### GET - Obtener miembros de una lista
```
GET /api/marketing/lists/{id_list}/members?id_user={id_user}
```

### POST - Agregar contactos a lista
```
POST /api/marketing/lists/{id_list}/members

Body:
{
  "id_user": "user_123",
  "action": "add",
  "contact_ids": ["contact_001", "contact_002", "contact_003"]
}
```

### POST - Remover contactos de lista
```
POST /api/marketing/lists/{id_list}/members

Body:
{
  "id_user": "user_123",
  "action": "remove",
  "contact_ids": ["contact_001"]
}
```

### POST - Desuscribir contactos
```
POST /api/marketing/lists/{id_list}/members

Body:
{
  "id_user": "user_123",
  "action": "unsubscribe",
  "contact_ids": ["contact_001"]
}
```

---

## 📈 EJEMPLOS DE USO EN FRONTEND

### Ejemplo 1: Cargar Empresas para Filtro
```typescript
const response = await apiFetch(
  `${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/tools/companies?id_tenant=${tenantId}`
);
const companies = await response.json();
```

### Ejemplo 2: Cargar Opciones de Filtros
```typescript
const response = await apiFetch(
  `${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/tools/filter-options?id_tenant=${tenantId}`
);
const filterOptions = await response.json();
// Contiene: categories, tags, countries, cities, industries
```

### Ejemplo 3: Buscar Contactos Avanzado
```typescript
const response = await apiFetch(
  `${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/contacts/search`,
  {
    method: 'POST',
    body: JSON.stringify({
      id_tenant: tenantId,
      id_user: userId,
      search: 'juan',
      company_id: 'cc_001',
      company_category: 'B2B',
      company_tags: ['VIP'],
      city: 'Quito',
      country: 'EC'
    })
  }
);
const contacts = await response.json();
```

### Ejemplo 4: Agregar Contactos a Lista
```typescript
const response = await apiFetch(
  `${import.meta.env.VITE_WEBHOOK_URL}/api/marketing/lists/${listId}/members`,
  {
    method: 'POST',
    body: JSON.stringify({
      id_user: userId,
      action: 'add',
      contact_ids: ['contact_001', 'contact_002']
    })
  }
);
```

---

## 🔒 Autenticación

Todos los endpoints requieren:
- Header: `Authorization: Bearer {token}`
- O incluir en query/body: `id_tenant` e `id_user`

---

## 📱 Estado General de Endpoints

| Categoría | Endpoint | Estado | Notas |
|-----------|----------|--------|-------|
| Empresas | GET/POST/PUT/DELETE | ✅ Implementado | |
| Contactos | GET/POST/PUT/DELETE | ✅ Implementado | |
| Etiquetas | GET/POST/PUT/DELETE | ⚠️ Parcial | Validar en backend |
| Categorías | GET/POST | ⚠️ Parcial | Validar en backend |
| Tipo Cliente | GET/POST | ⚠️ Parcial | Validar en backend |
| Marketing Filtros | GET | ✅ Implementado | Nuevo endpoint |
| Marketing Contactos | GET/POST | ✅ Implementado | Mejorado |
| Marketing Listas | POST | ✅ Implementado | Funcional |

---

## 📞 Soporte

Para más información, consulta:
- `services/marketingApi.ts` - Funciones de Marketing
- `services/mockApi.ts` - Datos mock disponibles
- Backend N8N workflows

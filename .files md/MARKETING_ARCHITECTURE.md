# Marketing Center - Arquitectura Técnica

## 📐 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                      APLICACIÓN CRM                             │
│  (React + TypeScript + Tailwind + Vite)                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
        ┌───────────▼────────┐   ┌────────▼─────────┐
        │   AuthContext      │   │  Layout.tsx      │
        │  (Autenticación)   │   │ (Navegación)     │
        └────────────────────┘   └──────────────────┘
                                          │
                                          │
              ┌───────────────────────────┼───────────────────────┐
              │                           │                       │
              │                  ┌────────▼──────────┐            │
              │                  │ MarketingCenter   │            │
              │                  │    (Página)       │            │
              │                  └───────┬───────────┘            │
              │                          │                        │
              │                 ┌────────┴────────┐               │
              │                 │                 │               │
        ┌─────▼─────┐    ┌──────▼────────┐  ┌────▼──────┐       │
        │   Toast   │    │ AudienceList  │  │ Estadísticas
        │(Alerts)   │    │Modal          │  │
        └───────────┘    └───────────────┘  └───────────┘
                               │
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼────────┐   ┌────────▼────────┐
            │ marketingApi   │   │  types.ts       │
            │   (Service)    │   │ (Interfaces)    │
            └────────┬───────┘   └─────────────────┘
                     │
                     │
         ┌───────────┴──────────────┐
         │                          │
    ┌────▼──────┐         ┌────────▼─────┐
    │ n8n APIs  │         │ localStorage │
    │ (Webhook) │         │ (SessionData)│
    └───────────┘         └──────────────┘
```

---

## 🔄 Flujo de Datos Detallado

### 1. Inicialización de la Aplicación
```
User abre /app/marketing
        ↓
ProtectedRoute valida autenticación
        ↓
MarketingCenter renderiza
        ↓
useEffect ejecuta loadLists()
        ↓
loading = true (muestra spinner)
        ↓
marketingApi.getLists(tenant_id, user_id)
        ↓
API responde con MarketingList[]
        ↓
setLists(data)
        ↓
setLoading(false)
        ↓
Tabla renderiza con datos
```

### 2. Crear Nueva Audiencia
```
User clickea "Nueva Audiencia"
        ↓
setIsModalOpen(true)
        ↓
AudienceListModal abre
        ↓
User rellena form:
  - name: string
  - description: string (opcional)
  - visibility: 'PRIVATE' | 'PUBLIC_TENANT'
        ↓
User clickea "Crear Audiencia"
        ↓
handleSubmit valida campos
        ↓
submitting = true (desactiva botón)
        ↓
marketingApi.createList(tenant_id, user_id, payload)
        ↓
API crea audiencia y retorna MarketingList
        ↓
onSuccess callback ejecuta
        ↓
handleListSuccess() agrega a lista
        ↓
Toast muestra confirmación
        ↓
Modal cierra
        ↓
Tabla se actualiza
```

### 3. Eliminar Audiencia
```
User clickea icono papelera
        ↓
window.confirm() pide confirmación
        ↓
Si user confirma:
  ↓
  marketingApi.deleteList(list_id, user_id)
        ↓
  API elimina audiencia
        ↓
  setLists(prev => prev.filter(...))
        ↓
  Toast muestra confirmación
        ↓
  Tabla se actualiza sin esa fila
```

---

## 📋 Estructura de Tipos

```typescript
// MarketingList
{
  list_id: string;           // ID único
  tenant_id: string;         // Tenant del usuario
  name: string;              // Nombre de la audiencia
  description?: string;      // Descripción
  visibility: 'PRIVATE' | 'PUBLIC_TENANT';
  type?: 'STATIC' | 'DYNAMIC';  // Estática o dinámica
  member_count: number;      // Cantidad de contactos
  created_at: string;        // Fecha ISO
  created_by?: string;       // Usuario que creó
  updated_at?: string;       // Última actualización
}

// ListMember
{
  member_id: string;
  contact_id: string;
  list_id: string;
  email?: string;
  name?: string;
  status?: 'ACTIVE' | 'UNSUBSCRIBED';
  added_at: string;
}

// MarketingCampaign
{
  id_campaign: string;
  id_tenant: string;
  id_user: string;
  subject: string;           // Asunto del email
  html_content: string;      // Contenido HTML
  sender_type: 'INDIVIDUAL' | 'CORPORATE';
  status?: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'PAUSED';
  attachments?: [...];
  created_at: string;
  sent_at?: string;
  recipient_count?: number;
  open_count?: number;
  click_count?: number;
}
```

---

## 🔗 Endpoints API n8n

### Listas (Audiencias)

#### GET /webhook/api/marketing/lists
```
Query Params:
  - tenant_id (required)
  - user_id (required)

Response:
  MarketingList[]

Ejemplo curl:
  curl -X GET "http://localhost:5678/webhook/api/marketing/lists?tenant_id=demo_tenant&user_id=user_001"
```

#### POST /webhook/api/marketing/lists
```
Body:
  {
    tenant_id: string;
    user_id: string;
    name: string;
    description?: string;
    visibility: 'PRIVATE' | 'PUBLIC_TENANT';
  }

Response:
  MarketingList

Ejemplo curl:
  curl -X POST "http://localhost:5678/webhook/api/marketing/lists" \
    -H "Content-Type: application/json" \
    -d '{
      "tenant_id": "demo_tenant",
      "user_id": "user_001",
      "name": "Mi Audiencia",
      "description": "Descripción",
      "visibility": "PRIVATE"
    }'
```

#### GET /webhook/api/marketing/lists/members
```
Query Params:
  - list_id (required)

Response:
  ListMember[]
```

#### POST /webhook/api/marketing/lists/manage
```
Body:
  {
    list_id: string;
    contact_ids: string[];
    action: 'add' | 'remove';
  }

Response:
  void (204 No Content)
```

#### DELETE /webhook/api/marketing/lists
```
Body:
  {
    list_id: string;
    user_id: string;
  }

Response:
  void (204 No Content)
```

---

### Campañas

#### GET /webhook/api/marketing/campaigns
```
Query Params:
  - tenant_id (required)

Response:
  MarketingCampaign[]
```

#### GET /webhook/api/marketing/campaigns/detail
```
Query Params:
  - campaign_id (required)

Response:
  MarketingCampaign
```

#### POST /webhook/api/marketing/campaigns/save
```
Body:
  {
    tenant_id: string;
    user_id: string;
    id_campaign?: string;  // Si es edición
    subject: string;
    html_content: string;
    sender_type: 'INDIVIDUAL' | 'CORPORATE';
    attachments?: [{file_name, file_url}];
  }

Response:
  MarketingCampaign
```

#### POST /webhook/api/marketing/campaigns/delete
```
⚠️ OJO: Es POST, no DELETE HTTP method

Body:
  {
    campaign_id: string;
    user_id: string;
  }

Response:
  void (204 No Content)
```

#### POST /webhook/api/marketing/launch
```
Body:
  {
    campaign_id: string;
    user_id: string;
  }

Response:
  void (204 No Content)
```

---

## 🧩 Dependencias e Importaciones

### En MarketingCenter.tsx
```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';  // Auth
import { MarketingList } from '../types';           // Tipos
import Toast from '../components/Toast';            // Componente UI
import AudienceListModal from '../components/AudienceListModal';  // Modal
import { marketingApi } from '../services/marketingApi';  // Service
```

### En AudienceListModal.tsx
```typescript
import React, { useState } from 'react';
import { createPortal } from 'react-dom';           // Portal para modal
import { MarketingList } from '../types';           // Tipos
import Toast from './Toast';                        // Notificaciones
```

### En marketingApi.ts
```typescript
import { MarketingList, ListMember, MarketingCampaign, CampaignTemplate } from '../types';
// Usa fetch nativo (no necesita axios)
```

---

## 🎯 Estados de Componentes

### MarketingCenter
```typescript
state {
  lists: MarketingList[];           // Datos de tabla
  loading: boolean;                 // Cargando
  error: string | null;             // Mensaje de error
  isModalOpen: boolean;             // Modal visible
  toast: {message, type} | null;    // Notificación
  selectedList: MarketingList | null; // Para edición
  showMembersModal: boolean;        // Modal de miembros
}
```

### AudienceListModal
```typescript
state {
  formData: {
    name: string;
    description: string;
    visibility: 'PRIVATE' | 'PUBLIC_TENANT';
  }
  submitting: boolean;              // Enviando form
  toast: {message, type} | null;    // Notificación
}
```

---

## 📊 Tablas de Componentes

### Columnas de MarketingCenter Table
| Columna | Tipo | Render |
|---------|------|--------|
| Nombre | string | Texto + descripción |
| Tipo | enum | Badge coloreado |
| Visibilidad | enum | Icono + texto |
| Miembros | number | Badge azul |
| Creada | ISO date | Formato local |
| Acciones | buttons | Ver, Eliminar |

---

## ⚙️ Configuración Requerida

### .env
```env
VITE_WEBHOOK_URL=https://tu-n8n-instance.com
```

### vite.config.ts (opcional, para proxy)
```typescript
server: {
  proxy: {
    '/api': {
      target: process.env.VITE_WEBHOOK_URL,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '/webhook/api'),
    }
  }
}
```

### tailwind.config.js
```javascript
// Ya debe estar configurado en el proyecto
// Marketing usa estos colores:
// - blue-600: Primario
// - green-100/700: Success
// - red-600: Error
// - slate-*: Grises
```

---

## 🚀 Pasos para Conectar a n8n

1. **Verificar n8n está corriendo**
   ```bash
   curl http://localhost:5678/rest/workflows
   ```

2. **Crear workflows en n8n** para cada endpoint:
   - GET /webhook/api/marketing/lists
   - POST /webhook/api/marketing/lists
   - etc.

3. **Configurar Variables de Entorno**
   ```
   VITE_WEBHOOK_URL=http://localhost:5678
   ```

4. **Cambiar Mock Data a Real** en MarketingCenter.tsx

5. **Probar endpoints** con curl

6. **Verificar TypeScript** compila sin errores

7. **Lanzar aplicación**
   ```bash
   npm run dev
   ```

---

## 🧪 Testing Checklist

- [ ] Compilación sin errores (`npm run dev`)
- [ ] Ruta `/app/marketing` accesible
- [ ] Tabla renderiza con mock data
- [ ] Modal abre/cierra correctamente
- [ ] Validación funciona (nombre obligatorio)
- [ ] Spinner muestra durante submit
- [ ] Toast aparece después de crear
- [ ] Nueva audiencia se agrega a tabla
- [ ] Botón eliminar funciona
- [ ] Responsive en mobile

---

**Última actualización**: 8 de Enero, 2026

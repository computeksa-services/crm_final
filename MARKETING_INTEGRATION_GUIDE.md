# Marketing Center - Guía de Integración

## 1. Conectar a APIs Reales de n8n

### Paso 1: Verificar Configuración de Vite

En `vite.config.ts`, asegurar que tienes el proxy configurado:

```typescript
export default defineConfig({
  // ... resto de config
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_WEBHOOK_URL || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/webhook/api'),
      }
    }
  }
});
```

O si usas directamente URLs completas, asegurar que `VITE_WEBHOOK_URL` esté seteada en `.env`:

```env
VITE_WEBHOOK_URL=https://tu-instancia-n8n.com
```

### Paso 2: Habilitar APIs en MarketingCenter

En `src/pages/MarketingCenter.tsx`, cambiar estas líneas (~85):

```typescript
// ❌ ACTUAL (Mock)
const mockLists: MarketingList[] = [ /* ... */ ];
setLists(mockLists);

// ✅ CAMBIAR A (Real)
try {
  const data = await marketingApi.getLists(tenant_id, user_id);
  setLists(data);
} catch (err) {
  console.error('Error loading lists:', err);
  setError('No se pudieron cargar las audiencias');
  setToast({ message: 'Error al cargar audiencias', type: 'error' });
}
```

### Paso 3: Habilitar Creación de Audiencias

En `src/components/AudienceListModal.tsx`, cambiar el `handleSubmit`:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    setToast({ message: 'El nombre de la audiencia es obligatorio.', type: 'error' });
    return;
  }

  setSubmitting(true);
  try {
    // ✅ USAR API REAL
    const newList = await marketingApi.createList(
      tenant_id,
      user_id,
      {
        name: formData.name,
        description: formData.description,
        visibility: formData.visibility
      }
    );

    setToast({ message: '✅ Audiencia creada exitosamente.', type: 'success' });
    
    if (onSuccess) {
      onSuccess(newList);
    }

    setFormData({ name: '', description: '', visibility: 'PRIVATE' });
    onClose();
  } catch (error) {
    console.error('Error creating list:', error);
    setToast({ message: 'Error al crear la audiencia.', type: 'error' });
  } finally {
    setSubmitting(false);
  }
};
```

---

## 2. Implementar Vista de Miembros de Audiencia

Crear nuevo archivo: `src/pages/AudienceMembersDetail.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MarketingList, ListMember } from '../types';
import Toast from '../components/Toast';
import { marketingApi } from '../services/marketingApi';

const AudienceMembersDetail: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [list, setList] = useState<MarketingList | null>(null);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!listId) return;
        
        const [membersData] = await Promise.all([
          marketingApi.getListMembers(listId),
          // TODO: Obtener datos de la lista si tienes endpoint para eso
        ]);
        
        setMembers(membersData);
      } catch (error) {
        console.error('Error loading members:', error);
        setToast({ message: 'Error al cargar miembros', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [listId]);

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Miembros de Audiencia</h1>
        <button 
          onClick={() => navigate(-1)}
          className="text-slate-600 hover:text-slate-900"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold">Email</th>
              <th className="px-6 py-4 text-left text-sm font-bold">Nombre</th>
              <th className="px-6 py-4 text-left text-sm font-bold">Estado</th>
              <th className="px-6 py-4 text-left text-sm font-bold">Agregado</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.member_id} className="border-b hover:bg-slate-50">
                <td className="px-6 py-4">{member.email}</td>
                <td className="px-6 py-4">{member.name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    member.status === 'ACTIVE' 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(member.added_at).toLocaleDateString('es-ES')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AudienceMembersDetail;
```

---

## 3. Crear Modal para Iniciar Campañas

Crear: `src/components/CampaignLaunchModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MarketingList } from '../types';
import Toast from './Toast';
import { marketingApi } from '../services/marketingApi';

interface CampaignLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  userId: string;
  availableLists: MarketingList[];
  onSuccess?: () => void;
}

const CampaignLaunchModal: React.FC<CampaignLaunchModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  userId,
  availableLists,
  onSuccess,
}) => {
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleLaunch = async () => {
    if (selectedListIds.length === 0) {
      setToast({ message: 'Selecciona al menos una audiencia', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await marketingApi.launchCampaign(campaignId, userId);
      setToast({ message: '✅ Campaña lanzada exitosamente', type: 'success' });
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      setToast({ message: 'Error al lanzar campaña', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">
          Lanzar Campaña
        </h2>

        <div className="mb-6">
          <p className="text-sm text-slate-600 mb-4">
            Selecciona las audiencias a las que deseas enviar esta campaña:
          </p>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableLists.map(list => (
              <label key={list.list_id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedListIds.includes(list.list_id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedListIds([...selectedListIds, list.list_id]);
                    } else {
                      setSelectedListIds(selectedListIds.filter(id => id !== list.list_id));
                    }
                  }}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <p className="font-semibold text-slate-900">{list.name}</p>
                  <p className="text-xs text-slate-600">{list.member_count} miembros</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
            disabled={submitting || selectedListIds.length === 0}
          >
            {submitting ? 'Lanzando...' : 'Lanzar Campaña'}
          </button>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default CampaignLaunchModal;
```

---

## 4. Agregar Importación en App.tsx

```typescript
import MarketingCenter from './pages/MarketingCenter';
import AudienceMembersDetail from './pages/AudienceMembersDetail';  // ← Agregar
```

Y en las rutas:

```tsx
<Route path="marketing" element={<MarketingCenter />} />
<Route path="marketing/audiences/:listId/members" element={<AudienceMembersDetail />} />  {/* ← Agregar */}
```

---

## 5. Performance Tips para Producción

### Paginación en Tabla de Audiencias

```typescript
const [page, setPage] = useState(1);
const ITEMS_PER_PAGE = 10;

const paginatedLists = lists.slice(
  (page - 1) * ITEMS_PER_PAGE,
  page * ITEMS_PER_PAGE
);

const totalPages = Math.ceil(lists.length / ITEMS_PER_PAGE);
```

### Caching de Datos

```typescript
const cacheRef = useRef<{ data: MarketingList[]; timestamp: number } | null>(null);
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const loadListsWithCache = async () => {
  const now = Date.now();
  
  if (cacheRef.current && (now - cacheRef.current.timestamp) < CACHE_DURATION) {
    setLists(cacheRef.current.data);
    return;
  }
  
  const data = await marketingApi.getLists(tenant_id, user_id);
  cacheRef.current = { data, timestamp: now };
  setLists(data);
};
```

### Debouncing para Búsqueda

```typescript
import { useCallback } from 'react';

const [search, setSearch] = useState('');
const searchTimeoutRef = useRef<NodeJS.Timeout>();

const handleSearch = useCallback((value: string) => {
  setSearch(value);
  
  clearTimeout(searchTimeoutRef.current);
  searchTimeoutRef.current = setTimeout(() => {
    // Ejecutar búsqueda
    const filtered = lists.filter(list =>
      list.name.toLowerCase().includes(value.toLowerCase())
    );
    // ...
  }, 300);
}, [lists]);
```

---

## 6. Testing Manual

### Checklist de Funcionalidades

```
Audiencias:
□ GET /api/marketing/lists → Carga tabla
□ POST /api/marketing/lists → Crea audiencia
□ DELETE /api/marketing/lists → Elimina audiencia
□ GET /api/marketing/lists/members → Ver miembros

Campañas (Fase 3):
□ GET /api/marketing/campaigns → Carga campañas
□ POST /api/marketing/campaigns/save → Crea/edita
□ POST /api/marketing/campaigns/delete → Elimina
□ POST /api/marketing/launch → Lanza campaña
```

### Testing con Console

```javascript
// En browser console, con sesión iniciada:
import { marketingApi } from './services/marketingApi.ts';

// Probar getLists
const lists = await marketingApi.getLists('demo_tenant', 'user_001');
console.log(lists);

// Probar createList
const newList = await marketingApi.createList('demo_tenant', 'user_001', {
  name: 'Test',
  description: 'Testing',
  visibility: 'PRIVATE'
});
console.log(newList);
```

---

## 7. Error Handling Mejorado

```typescript
const handleError = (error: unknown, context: string) => {
  if (error instanceof Error) {
    console.error(`[${context}] ${error.message}`);
    
    // Detección de errores específicos
    if (error.message.includes('401')) {
      // Redirigir a login
    } else if (error.message.includes('403')) {
      // Mostrar "Sin permisos"
    } else if (error.message.includes('404')) {
      // Mostrar "No encontrado"
    } else if (error.message.includes('500')) {
      // Mostrar "Error del servidor"
    }
  }
};
```

---

## Próximas mejoras 🚀

- [ ] Bulk actions (seleccionar múltiples y agregar a campaña)
- [ ] Importación CSV de contactos
- [ ] Segmentación avanzada
- [ ] Template builder para campañas
- [ ] Analytics dashboard
- [ ] A/B testing
- [ ] Scheduling de campañas

---

**¿Preguntas?** Revisar `MARKETING_CENTER_IMPLEMENTATION.md` para más contexto.

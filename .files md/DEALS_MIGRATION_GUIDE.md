# Próximos Pasos: Migración de Deals

Este documento proporciona instrucciones específicas para migrar la funcionalidad de Deals al Gateway.

## Estructura de Deals

### Endpoints a Actualizar
```
GET  /api/deals?id_tenant=...&id_user=...
GET  /api/deals/detail?id_trato=...&id_tenant=...&id_user=...
GET  /api/deals/by_company?...
POST /api/deals
POST /api/deals/update
POST /api/deals/delete
GET  /api/status/deals
POST /api/status/deals
```

### URLs del Gateway
```javascript
import { GATEWAY_CONFIG } from '../services/gatewayConfig';

// Ya están disponibles:
GATEWAY_CONFIG.API.DEALS.LIST          // https://gateway.computeksa.com/api/deals
GATEWAY_CONFIG.API.DEALS.DETAIL        // https://gateway.computeksa.com/api/deals/detail
GATEWAY_CONFIG.API.DEALS.CREATE        // https://gateway.computeksa.com/api/deals
GATEWAY_CONFIG.API.DEALS.UPDATE        // https://gateway.computeksa.com/api/deals/update
GATEWAY_CONFIG.API.DEALS.DELETE        // https://gateway.computeksa.com/api/deals/delete
GATEWAY_CONFIG.API.DEALS.BY_COMPANY    // https://gateway.computeksa.com/api/deals/by_company
GATEWAY_CONFIG.API.STATUSES.DEALS      // https://gateway.computeksa.com/api/status/deals
```

## Archivos a Actualizar

### 1. pages/DealsList.tsx (Mayor archivo)
Contiene aproximadamente 4-5 llamadas fetch

**Buscar y reemplazar:**
```javascript
// ANTES
fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals?...`)

// DESPUÉS
apiFetch(buildUrl(GATEWAY_CONFIG.API.DEALS.LIST, { id_tenant, id_user }))
```

**Paso a paso:**
1. Agregar imports:
   ```typescript
   import { apiFetch } from '../services/apiClient';
   import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';
   ```

2. Reemplazar cada llamada fetch por apiFetch

3. Usar `buildUrl()` para parámetros query

### 2. pages/DealDetail.tsx
Contiene 2 llamadas fetch

**Llamadas principales:**
- GET `/api/deals/detail?id_trato=...`
- POST `/api/status/deals`

### 3. pages/DealCreate.tsx
Contiene 1 llamada fetch

**Llamada principal:**
- POST `/api/deals`

## Ejemplo Completo

### ANTES (Legacy)
```typescript
import React, { useEffect, useState } from 'react';

const DealsList: React.FC = () => {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        // Obtener token manualmente
        const token = localStorage.getItem('token');
        
        const response = await fetch(
          `${import.meta.env.VITE_WEBHOOK_URL}/api/deals?id_tenant=${tenantId}&id_user=${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) throw new Error('Error loading deals');
        const data = await response.json();
        setDeals(data);
      } catch (error) {
        console.error(error);
      }
    };

    loadDeals();
  }, [tenantId, userId]);

  return <div>{/* ... */}</div>;
};
```

### DESPUÉS (Gateway)
```typescript
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';

const DealsList: React.FC = () => {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        // El token se maneja automáticamente en apiFetch
        const response = await apiFetch(
          buildUrl(GATEWAY_CONFIG.API.DEALS.LIST, { 
            id_tenant: tenantId, 
            id_user: userId 
          })
        );
        
        if (!response.ok) throw new Error('Error loading deals');
        const data = await response.json();
        setDeals(data);
      } catch (error) {
        console.error(error);
      }
    };

    loadDeals();
  }, [tenantId, userId]);

  return <div>{/* ... */}</div>;
};
```

## Herramienta Útil: buildUrl()

La función `buildUrl()` simplifica la creación de URLs con parámetros:

```typescript
import { buildUrl } from '../services/gatewayConfig';

// Ejemplo 1: Sin parámetros
buildUrl('https://gateway.computeksa.com/api/deals')
// Result: https://gateway.computeksa.com/api/deals

// Ejemplo 2: Con parámetros
buildUrl(GATEWAY_CONFIG.API.DEALS.LIST, { 
  id_tenant: '123', 
  id_user: '456',
  status: 'active'
})
// Result: https://gateway.computeksa.com/api/deals?id_tenant=123&id_user=456&status=active

// Ejemplo 3: Con parámetros undefined (se ignoran)
buildUrl(GATEWAY_CONFIG.API.DEALS.LIST, { 
  id_tenant: '123',
  optional_param: undefined  // se ignora
})
// Result: https://gateway.computeksa.com/api/deals?id_tenant=123
```

## Patrón de Migración Estándar

Para cada archivo:

1. **Agregar imports:**
   ```typescript
   import { apiFetch } from '../services/apiClient';
   import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';
   ```

2. **Buscar todos los fetch:**
   ```
   Ctrl+F: fetch(`${import.meta.env.VITE_WEBHOOK_URL}
   ```

3. **Para cada fetch:**
   - Identificar el endpoint (`/api/deals`, `/api/quotes`, etc.)
   - Reemplazar `fetch()` por `apiFetch()`
   - Reemplazar URL hardcodeada por `GATEWAY_CONFIG`
   - Usar `buildUrl()` para parámetros

4. **Ejemplo de patrón:**
   ```typescript
   // ANTES
   const response = await fetch(
     `${import.meta.env.VITE_WEBHOOK_URL}/api/deals?id_tenant=${id}&id_user=${user}`,
     { method: 'POST', headers: {...}, body: JSON.stringify(...) }
   );

   // DESPUÉS
   const response = await apiFetch(
     buildUrl(GATEWAY_CONFIG.API.DEALS.CREATE, { id_tenant: id, id_user: user }),
     { method: 'POST', body: JSON.stringify(...) }
   );
   ```

## Checklist para Deals

Cuando termines de migrar Deals, verifica:

- [ ] DealsList.tsx usa GATEWAY_CONFIG
- [ ] DealDetail.tsx usa GATEWAY_CONFIG
- [ ] DealCreate.tsx usa GATEWAY_CONFIG
- [ ] Todos los imports están presentes
- [ ] No hay más `import.meta.env.VITE_WEBHOOK_URL` en deals
- [ ] Todos los endpoints usan `apiFetch()`
- [ ] Headers se agregan automáticamente
- [ ] Testing manual en browser completado
- [ ] Network tab muestra URLs del Gateway
- [ ] Authorization header presente en todas las requests

## Scripts de Búsqueda

Para encontrar rápidamente qué actualizar:

### En VSCode:
1. Abre Find (Ctrl+F)
2. Busca: `VITE_WEBHOOK_URL`
3. En scope: `pages/Deal*.tsx`

### En Terminal:
```powershell
grep -r "VITE_WEBHOOK_URL" pages/Deal*.tsx
grep -r "fetch(" pages/Deal*.tsx | grep deals
```

## Ordem Recomendado

1. **Primero:** DealsList.tsx (la más compleja)
2. **Segundo:** DealDetail.tsx
3. **Tercero:** DealCreate.tsx

## Estimación de Tiempo

- DealsList.tsx: ~15 minutos
- DealDetail.tsx: ~10 minutos
- DealCreate.tsx: ~5 minutos
- Testing manual: ~10 minutos
- **Total: ~40 minutos**

## Support

Si tienes problemas:

1. Revisa [GATEWAY_CONFIGURATION.md](GATEWAY_CONFIGURATION.md)
2. Usa [GATEWAY_VERIFICATION_SCRIPT.js](GATEWAY_VERIFICATION_SCRIPT.js) para verificar el token
3. Abre DevTools Network tab para ver las URLs
4. Busca errores en Console

---

**Documento creado:** Enero 2026  
**Versión:** 1.0  
**Listo para:** Deals Migration

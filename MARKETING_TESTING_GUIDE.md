# Marketing Center - Testing & Troubleshooting

## 🧪 Testing Manual

### Ambiente Local Sin n8n

El código funciona 100% con datos mockados. Para probar:

```bash
npm run dev
# Abre http://localhost:5173/app/marketing
```

**Lo que debes ver:**
- Dashboard con 3 audiencias de ejemplo
- Tabla con columnas: Nombre, Tipo, Visibilidad, Miembros, Creada
- Botón "Nueva Audiencia" en esquina superior derecha
- Stats: 3 audiencias, 674 contactos totales, 2 públicas

### Testing con n8n Local

#### 1. Levantar n8n localmente
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e DB=sqlite \
  -e N8N_BASIC_AUTH_ACTIVE=false \
  n8nio/n8n
```

#### 2. Crear workflow de ejemplo
En http://localhost:5678:

**Workflow: GET /webhook/api/marketing/lists**
```
Webhook (GET) 
  ↓
Code Node (retorna mock data)
  ↓
Return response
```

Código en el Code Node:
```javascript
return [{
  list_id: 'list_001',
  tenant_id: $('Webhook').first().query.tenant_id,
  name: 'Clientes Activos',
  description: 'Demo',
  visibility: 'PUBLIC_TENANT',
  type: 'DYNAMIC',
  member_count: 100,
  created_at: new Date().toISOString(),
  created_by: 'test@example.com'
}];
```

#### 3. Configurar Vite proxy
En `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5678',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '/webhook/api')
    }
  }
}
```

#### 4. Cambiar a API real en MarketingCenter.tsx
En `loadLists()`, línea ~85:
```typescript
// Cambiar esto:
const mockLists: MarketingList[] = [ /* ... */ ];
setLists(mockLists);

// Por esto:
const data = await marketingApi.getLists(tenant_id, user_id);
setLists(data);
```

#### 5. Probar con curl
```bash
# Verificar que n8n está respondiendo
curl -X GET "http://localhost:5678/webhook/api/marketing/lists?tenant_id=demo_tenant&user_id=user_001"

# Deberías ver el JSON response
```

---

## 🐛 Troubleshooting

### Error 1: "Cannot GET /app/marketing"
**Problema:** Ruta no está registrada
**Solución:** Verificar que `App.tsx` tenga:
```typescript
import MarketingCenter from './pages/MarketingCenter';
// ...
<Route path="marketing" element={<MarketingCenter />} />
```

### Error 2: "Can't resolve '../services/marketingApi'"
**Problema:** El archivo no existe o está mal ubicado
**Solución:** Verificar que existe `src/services/marketingApi.ts`

### Error 3: "Type 'null' is not assignable to type 'MarketingList'"
**Problema:** Service layer retornando null
**Solución:** En `marketingApi.ts` verificar que no retorna null:
```typescript
// ❌ INCORRECTO
return text ? JSON.parse(text) : null;

// ✅ CORRECTO
const result = text ? JSON.parse(text) : null;
if (!result) throw new Error('Empty response');
return result;
```

### Error 4: "Network request failed"
**Problema:** API no está accesible
**Solución:** 
- Verificar que n8n está corriendo: `curl http://localhost:5678`
- Verificar URL en `VITE_WEBHOOK_URL`
- Verificar proxy en `vite.config.ts`
- Revisar Console del browser para ver request fallido

### Error 5: "toast is not defined"
**Problema:** Toast component no está importado
**Solución:** En MarketingCenter.tsx:
```typescript
import Toast from '../components/Toast';
```

### Error 6: Modal no abre
**Problema:** `isModalOpen` no se actualiza
**Solución:** Verificar que `setIsModalOpen(true)` se ejecuta
```typescript
// En botón Nueva Audiencia:
onClick={() => setIsModalOpen(true)}
```

---

## 🔍 Debugging Tips

### En Browser Console

```javascript
// Verificar que AuthContext tiene datos
import { AuthContext } from './contexts/AuthContext';
// (Acceso limitado desde console, mejor usar React DevTools)

// Probar API directamente
import { marketingApi } from './services/marketingApi.ts';
const lists = await marketingApi.getLists('demo_tenant', 'user_001');
console.log(lists);

// Inspeccionar red en tab "Network"
// Buscar requests a /api/marketing/lists
```

### React Developer Tools

1. Instalar extensión en Chrome
2. Ir a Components tab
3. Buscar `MarketingCenter`
4. Inspeccionar state:
   - `lists` debe tener array
   - `loading` debe ser false
   - `error` debe ser null

### VS Code Debug

En `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true
    }
  ]
}
```

---

## ✅ Verificación Pre-Deployment

### Checklist de Compilación
```bash
npm run build
# Debe compilar sin errores
```

### Checklist de Funcionalidades

#### Audiencias
- [ ] GET /api/marketing/lists carga datos
- [ ] POST /api/marketing/lists crea audiencia
- [ ] DELETE /api/marketing/lists elimina
- [ ] Tabla actualiza correctamente
- [ ] Confirmación antes de eliminar
- [ ] Toasts se muestran

#### UI/UX
- [ ] Spinner muestra durante loading
- [ ] Empty state muestra si no hay datos
- [ ] Modal abre/cierra suavemente
- [ ] Formulario valida campos
- [ ] Responsive en mobile (tabla scrollea)
- [ ] Colores y estilos correctos
- [ ] Navegación en Layout muestra "Marketing Center"

#### Performance
- [ ] Tabla renderiza < 1s con 100 items
- [ ] Modal abre < 200ms
- [ ] No hay memory leaks (React DevTools Profiler)

---

## 📊 Ejemplos de Testing

### Test: Cargar Audiencias
```typescript
describe('MarketingCenter', () => {
  it('should load lists on mount', async () => {
    const { getByText } = render(<MarketingCenter />);
    
    await waitFor(() => {
      expect(getByText('Clientes Activos')).toBeInTheDocument();
    });
  });
});
```

### Test: Crear Audiencia
```typescript
it('should create new list', async () => {
  const { getByRole, getByPlaceholderText } = render(<AudienceListModal isOpen={true} />);
  
  const nameInput = getByPlaceholderText('ej: Clientes Activos');
  fireEvent.change(nameInput, { target: { value: 'Nueva Audiencia' } });
  
  const submitBtn = getByRole('button', { name: /crear audiencia/i });
  fireEvent.click(submitBtn);
  
  await waitFor(() => {
    expect(getByText(/audiencia creada exitosamente/i)).toBeInTheDocument();
  });
});
```

### Test: API Service
```typescript
describe('marketingApi', () => {
  it('should fetch lists', async () => {
    const lists = await marketingApi.getLists('demo_tenant', 'user_001');
    
    expect(Array.isArray(lists)).toBe(true);
    expect(lists[0]).toHaveProperty('list_id');
    expect(lists[0]).toHaveProperty('name');
  });
});
```

---

## 🚨 Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| "Cannot find module" | Import incorrecto | Verificar ruta exacta |
| "null is not an object" | State no iniciado | Usar useState con valor inicial |
| "Not authenticated" | Sin sesión | Hacer login primero |
| "Fetch failed" | API no responde | Verificar n8n está corriendo |
| "CORS error" | Políticas de origen | Configurar proxy en Vite |
| "Toast undefined" | No importado | Agregar import de Toast |
| "Memory leak warning" | useEffect sin cleanup | Agregar return cleanup function |
| "Type error in props" | Tipos incompatibles | Revisar types.ts |

---

## 📈 Performance Profiling

### Con React DevTools Profiler

1. Abrir React DevTools → Profiler
2. Clickear record
3. Navegar a `/app/marketing`
4. Stopear recording
5. Analizar tiempo de render

**Targets:**
- Initial load: < 2s
- Table render: < 500ms
- Modal open: < 200ms

### Con Chrome DevTools

1. Abrir Developer Tools (F12)
2. Performance tab
3. Record
4. Ejecutar acciones
5. Stop
6. Analizar Main thread

**Buscar:**
- Rendering time < 16ms (60fps)
- No long tasks > 50ms

---

## 🔐 Testing de Seguridad

### Validaciones
```typescript
// Verificar que solo usuarios autenticados acceden
✓ MarketingCenter está dentro de ProtectedRoute
✓ tenant_id y user_id se pasan en requests
✓ Confirmación antes de acciones destructivas

// Probar con datos sensibles
✓ No logear contraseñas
✓ No exponer IDs de usuario en UI
✓ Sanitizar inputs
```

### CORS Testing
```bash
# Verificar headers CORS en respuesta
curl -i http://localhost:5678/webhook/api/marketing/lists

# Debe tener:
Access-Control-Allow-Origin: *
# O dominio específico
```

---

## 📝 Logs Esperados

### Console Logs Correctos
```
✓ "🔄 AuthContext: Cargando sesión desde localStorage..."
✓ "✅ Sesión restaurada correctamente"
✓ "📊 MarketingCenter: Cargando audiencias..."
✓ Tabla renderiza
```

### Console Errors a Ignorar (si se manejan)
```
⚠️ "Error loading lists: Network request failed"
   → Es ok si se muestra toast al usuario
```

### Errors que NO Deberían Ocurrir
```
❌ "Cannot find module"
❌ "Type error"
❌ "Undefined is not an object"
❌ Uncaught exceptions en console
```

---

## 🎯 Casos de Uso para Testing

### Caso 1: Usuario nuevo sin audiencias
```
1. Login
2. Navegar a /app/marketing
3. Verifica que se muestra "Sin audiencias creadas"
4. Click en "Crear Primera Audiencia"
5. Modal abre
6. Verifica que campos están vacíos
```

### Caso 2: Usuario con audiencias existentes
```
1. Login
2. Navegar a /app/marketing
3. Tabla carga con datos
4. Verifica columnnas y valores
5. Stats en footer muestran números correctos
```

### Caso 3: Crear audiencia
```
1. Click "Nueva Audiencia"
2. Rellena nombre: "Test"
3. Rellena descripción: "Test desc"
4. Selecciona visibilidad: "PRIVATE"
5. Click "Crear Audiencia"
6. Verifica toast de éxito
7. Modal cierra
8. Nueva fila aparece en tabla
```

### Caso 4: Eliminar audiencia
```
1. Busca una audiencia existente
2. Click icono papelera
3. Confirm dialog aparece
4. Click "OK"
5. Toast muestra "Eliminada"
6. Fila desaparece de tabla
```

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisar Console** para mensajes de error
2. **Verificar Network tab** para fallos en requests
3. **Consultar types.ts** para estructura esperada
4. **Revisar MARKETING_ARCHITECTURE.md** para diagrama
5. **Probar con curl** si es problema de API

---

**Última actualización**: 8 de Enero, 2026

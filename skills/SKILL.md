# SKILL: Estilo de Código — Componentes React/TypeScript

Aplica estas reglas a **todo** componente `.tsx` del proyecto.

---

## 1. Estructura de archivo

El orden siempre es:
```
// ── TYPES ─────────────────────
// ── INLINE ICONS ──────────────   (solo si el componente los define localmente)
// ── HELPERS / UTILS ───────────   (funciones puras, sin hooks)
// ── SUB-COMPONENTES ───────────   (componentes auxiliares del mismo archivo)
// ── MAIN COMPONENT ────────────
//    ↳ State
//    ↳ Effects
//    ↳ Handlers
//    ↳ Render
```

---

## 2. Separadores de sección

Usa separadores con guiones largos para marcar bloques. Longitud exacta: 60 caracteres tras `//`.
```ts
// ── TYPES ────────────────────────────────────────────────
// ── State ────────────────────────────────────────────────
// ── Effects ──────────────────────────────────────────────
// ── Handlers ─────────────────────────────────────────────
// ── Render ───────────────────────────────────────────────
```

---

## 3. Tipado

- Todos los props de componentes van en una `interface` con sufijo `Props`.
- Nunca usar `any` salvo en casteos de eventos sintéticos de React (ej. `as any` en `onInputChange` con target virtual).
- Los tipos compartidos entre archivos van en `../../types`. Los tipos locales al componente van en el mismo archivo arriba del todo.
- Preferir `React.FC<Props>` con destructuring en la firma.
```ts
// ✅ Correcto
export const MyModal: React.FC<MyModalProps> = ({ isOpen, onClose }) => { ... }

// ❌ Evitar
export default function MyModal(props: any) { ... }
```

---

## 4. Iconos inline

Cuando se definen SVG icons localmente (sin librería), seguir este patrón:
```ts
// Siempre aceptar className y opcionalmente size
const IconX: React.FC<{ className?: string; size?: number }> = ({ className, size = 12 }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size}
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
```

Nunca usar `width`/`height` hardcodeados si el ícono se reutiliza en distintos tamaños.

---

## 5. useEffect — reglas estrictas

### 5a. Nunca causar loops por dependencias no memoizadas

Si una prop función (ej. `onFetchDeals`) no está garantizada como estable con `useCallback` en el padre, **no incluirla en el array de dependencias**. Documentarlo:
```ts
useEffect(() => {
  if (isOpen && !dealsLoaded) onFetchDeals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen]); // onFetchDeals omitido intencionalmente — puede no estar memoizado en el padre
```

### 5b. Nunca mutar estado directamente dentro de un helper
```ts
// ❌ Rompe React — muta el objeto de estado Date directamente
const day = currentDate.getDay();
const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
startDate = new Date(currentDate.setDate(diff)); // ← mutación directa

// ✅ Correcto — clonar primero
const clone = new Date(currentDate);
const diff = clone.getDate() - clone.getDay() + (clone.getDay() === 0 ? -6 : 1);
clone.setDate(diff);
startDate = new Date(clone);
```

### 5c. No duplicar listeners

Un solo `useEffect` por responsabilidad. Si ya hay un listener global de `keydown`, no agregar otro con la misma lógica en otro efecto.

---

## 6. Extracción de lógica repetida con useCallback

Cuando la misma lógica aparece 2+ veces (ej. ajustar hora de fin cuando se cambia la de inicio), extraerla con `useCallback`:
```ts
const adjustEndIfNeeded = useCallback((startTime: string, date: string) => {
  const currentEnd = formatTimeDisplay(formData.end) || '10:00';
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = currentEnd.split(':').map(Number);
  if (eH * 60 + eM <= sH * 60 + sM) {
    const newMins = sH * 60 + sM + 60;
    const newEnd = `${Math.floor(newMins / 60) % 24}`.padStart(2, '0')
      + ':' + `${newMins % 60}`.padStart(2, '0');
    onInputChange({ target: { name: 'end', value: `${date}T${newEnd}` } } as any);
  }
}, [formData.end, onInputChange]);
```

---

## 7. Sub-componentes con comportamiento propio

Si un bloque de JSX tiene su propio estado o efectos, extraerlo como componente separado **en el mismo archivo**, encima del componente principal:
```ts
// ── SUB-COMPONENTES ───────────────────────────────────────
const TimeDropdown: React.FC<TimeDropdownProps> = ({ options, selected, onSelect }) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'center' }); }, []);
  // ...
};

// ── MAIN COMPONENT ────────────────────────────────────────
export const EventModal: React.FC<EventModalProps> = ({ ... }) => {
```

---

## 8. Estado vacío y estados de carga

Todo dropdown o lista con datos remotos debe manejar los 3 estados: cargando, vacío, con datos.
```tsx
{dealsLoading
  ? <div className="p-2 text-xs text-gray-500">Cargando...</div>
  : deals.length === 0
    ? <div className="p-2 text-xs text-gray-400">Sin resultados</div>
    : deals.map(deal => ( ... ))
}
```

---

## 9. Variables derivadas del estado — calcular antes del return

Evitar expresiones complejas inline en el JSX. Calcular arriba del `return`:
```ts
// ✅ Antes del return
const currentDate = formData.start ? formData.start.split('T')[0] : '';
const startTime   = formatTimeDisplay(formData.start) || '09:00';

// ❌ Inline en JSX — difícil de leer
value={formData.start ? formData.start.split('T')[0] : ''}
```

---

## 10. Funciones async — siempre con try/catch/finally
```ts
const fetchDeals = async (): Promise<Deal[]> => {
  if (dealsLoaded || !user?.id_tenant) return []; // ← retornar [] no estado stale
  setDealsLoading(true);
  try {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Error en respuesta');
    const data = await res.json();
    setDeals(data);
    return data;
  } catch (e) {
    console.error('fetchDeals:', e);
    return [];
  } finally {
    setDealsLoading(false);
    setDealsLoaded(true);
  }
};
```

---

## 11. Tailwind — convenciones de clases

- Responsive: mobile-first con `sm:`, `md:`, `lg:`.
- Estados hover/focus siempre explícitos: `hover:bg-gray-100`, `focus:outline-none`.
- No usar `style={{}}` salvo para valores que Tailwind no puede expresar (ej. `maxHeight` dinámico).
- Clases condicionales con template string o helper, nunca con ternarios anidados profundos:
```tsx
// ✅
className={`px-5 py-2 text-sm font-bold text-white rounded-lg ${
  submitting ? 'bg-gray-600' : 'bg-gray-900 hover:bg-gray-800'
}`}
```

---

## 12. Checklist antes de hacer PR

- [ ] ¿Hay algún `setXxx` llamado sobre un estado que no existe? (`setIsDetailedMode`, etc.)
- [ ] ¿Algún helper muta un objeto de estado directamente? (`.setDate()`, `.push()`, etc.)
- [ ] ¿Hay `useEffect` duplicados con la misma responsabilidad?
- [ ] ¿Los dropdowns muestran estado vacío además de cargando?
- [ ] ¿Los iconos SVG reutilizados en distintos tamaños aceptan `size` prop?
- [ ] ¿Las funciones async retornan `[]` (no estado stale) en el fallback?
- [ ] ¿La lógica repetida 2+ veces está en un `useCallback`?
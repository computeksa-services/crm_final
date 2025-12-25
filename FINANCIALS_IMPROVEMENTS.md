# Mejoras Pendientes para FinancialsList

## 1. Componente StatusInterestFilter
Agregar después de InlineBadgeSelector (línea 140):

```tsx
// --- COMPONENTE INTERNO: Dropdown de Filtro Superior ---
const StatusInterestFilter: React.FC<{
  placeholder: string;
  selectedId: string;
  onChange: (val: string) => void;
  items: { id: string; name: string; color?: string; icon?: string; count?: number }[];
}> = ({ placeholder, selectedId, onChange, items }) => {
  const [open, setOpen] = useState(false);
  const current = items.find(i => i.id === selectedId);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem]" onMouseLeave={() => { leaveTimeoutRef.current = setTimeout(() => setOpen(false), 300); }} onMouseEnter={() => { if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current); }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300">
        {current ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold" style={{ backgroundColor: `${current.color}15`, color: current.color, borderColor: `${current.color}40` }}>
            {current.icon && <i className={`${current.icon} mr-1.5`}></i>}
            {current.name}
          </span>
        ) : <span className="text-slate-500">{placeholder}</span>}
        <span className="absolute right-3 top-2.5 text-slate-400 text-xs"><i className="fa-solid fa-chevron-down"></i></span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 text-sm">{placeholder}</button>
          <div className="border-t border-slate-100"></div>
          {items.map(item => (
            <button key={item.id} type="button" onClick={() => { onChange(item.id); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm">
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold" style={{ backgroundColor: `${item.color}15`, color: item.color, borderColor: `${item.color}40` }}>
                {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                {item.name}
              </span>
              {item.count !== undefined && <span className="text-xs text-slate-400">({item.count})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 2. Funciones de Sorting y Filtros
Agregar antes de `fetchTransactions`:

```tsx
const requestSort = (key: string) => {
  setSortConfig(prev => ({
    key,
    direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
  }));
};

const toggleColumnFilter = (column: string, value: string) => {
  setColumnFilters(prev => {
    const current = prev[column] || [];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    return { ...prev, [column]: newValues };
  });
};

const getUniqueValues = (column: string) => {
  const values = new Map<string, number>();
  transactions.forEach(tx => {
    let val = '';
    if (column === 'status') val = tx.status;
    else if (column === 'transaction_type') val = tx.transaction_type;
    else if (column === 'client_name') val = tx.client_name || tx.client_company_name || '';
    if (val) {
      values.set(val, (values.get(val) || 0) + 1);
    }
  });
  return Array.from(values.entries()).map(([value, count]) => ({ value, label: value, count }));
};
```

## 3. Processed Transactions con Sorting y Filtros
Reemplazar `filteredTransactions` con:

```tsx
const processedTransactions = useMemo(() => {
  let result = [...transactions];

  // Search filter
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    result = result.filter(t =>
      t.invoice_number?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      (t.client_name || t.client_company_name)?.toLowerCase().includes(term)
    );
  }

  // Status filter
  if (filters.status) {
    result = result.filter(t => t.status === filters.status);
  }

  // Type filter
  if (filters.transactionType) {
    result = result.filter(t => t.transaction_type === filters.transactionType);
  }

  // Client filter
  if (filters.clientCompany) {
    result = result.filter(t => t.id_client_company === filters.clientCompany);
  }

  // Column filters
  Object.entries(columnFilters).forEach(([column, values]) => {
    if (values.length > 0) {
      result = result.filter(tx => {
        let val = '';
        if (column === 'status') val = tx.status;
        else if (column === 'transaction_type') val = tx.transaction_type;
        else if (column === 'client_name') val = tx.client_name || tx.client_company_name || '';
        return values.includes(val);
      });
    }
  });

  // Sorting
  if (sortConfig.key) {
    result.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof FinancialTransaction];
      let bVal: any = b[sortConfig.key as keyof FinancialTransaction];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return result;
}, [transactions, filters, columnFilters, sortConfig]);
```

## 4. Actualizar filtros para usar StatusInterestFilter
Reemplazar los dropdowns de estado y tipo con:

```tsx
<StatusInterestFilter
  placeholder="Todos los estados"
  selectedId={filters.status}
  onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
  items={[
    { id: 'PENDIENTE', name: 'Pendiente', color: '#f59e0b', icon: 'fa-solid fa-clock' },
    { id: 'PAGADO', name: 'Pagado', color: '#10b981', icon: 'fa-solid fa-circle-check' },
    { id: 'VENCIDO', name: 'Vencido', color: '#ef4444', icon: 'fa-solid fa-circle-exclamation' },
    { id: 'ANULADO', name: 'Anulado', color: '#6b7280', icon: 'fa-solid fa-ban' },
  ]}
/>
```

## 5. Agregar Sort Icons en Headers
Ejemplo para header de columna con sort:

```tsx
<th className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => requestSort('invoice_number')}>
  <div className="flex items-center gap-2">
    Factura
    {sortConfig.key === 'invoice_number' && (
      <i className={`fa-solid fa-arrow-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-xs text-brand-500`}></i>
    )}
  </div>
</th>
```

Esta es una implementación completa. ¿Quieres que proceda con estos cambios?

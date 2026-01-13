import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ExpandedState,
  FilterFn
} from '@tanstack/react-table';

// --- UTILS & FILTERS ---
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  const { start, end } = value as { start: string; end: string };
  const rowDate = row.getValue(columnId) as string;
  if (!rowDate) return false;
  const date = rowDate.split('T')[0];
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
  return isNaN(num) ? '$0.00' : num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const [date, time = ''] = normalized.split('T');
  return `${date}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

// --- HELPER PARA CELDA DE GRUPO (Sutil) ---
const renderGroupCell = (row: any, label: string) => (
  <div className="flex items-center gap-3">
    <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
    <span className="font-bold text-slate-700 uppercase tracking-tight">{label || 'No asignado'}</span>
    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
  </div>
);

// --- COMPONENTE INTERNO: Selector Inline ---
const InlineBadgeSelector: React.FC<{
    valueId: string | number;
    items: { id: string | number; name: string; color?: string; icon?: string }[];
    onSelect: (id: string | number) => void;
    disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const current = items.find(i => String(i.id) === String(valueId));
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[11px] font-black uppercase tracking-tight transition-all ${disabled ? 'cursor-default opacity-70' : 'hover:bg-white active:scale-95'}`}
                style={{ backgroundColor: `${current?.color}15`, color: current?.color, borderColor: `${current?.color}30` }}
            >
                {current?.icon && <i className={current.icon}></i>}
                {current?.name || 'S/N'}
                {!disabled && <i className="fa-solid fa-chevron-down opacity-50 text-[8px]"></i>}
            </button>
            {isOpen && (
                <div className="absolute z-[100] mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                    {items.map(item => (
                        <button
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                            className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-left border-b border-slate-50 last:border-0"
                        >
                            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                                <i className={item.icon || 'fa-solid fa-tag'}></i>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const QuotesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // --- DATA STATE ---
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // --- TABLE STATE ---
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('quotesList_grouping');
    return saved ? JSON.parse(saved) : [];
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // --- UI STATE ---
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Partial<Quote> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // --- MODALS ---
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; isDestructive?: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [quotesRes, companiesRes, contactsRes, statusesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/quotes?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`)
      ]);
      
      const parse = async (res: Response) => { const t = await res.text(); return t ? JSON.parse(t) : []; };
      
      if (!quotesRes.ok && quotesRes.status !== 404) throw new Error('Error al cargar cotizaciones');
      
      setQuotes(await parse(quotesRes));
      setCompanies(await parse(companiesRes));
      setContacts(await parse(contactsRes));
      setQuoteStatuses(await parse(statusesRes));

    } catch (e) {
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Guardar estado de agrupación en localStorage
  useEffect(() => {
    localStorage.setItem('quotesList_grouping', JSON.stringify(grouping));
  }, [grouping]);

  // --- FILTERS LOGIC ---
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setActiveFilterMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    quotes.forEach(quote => {
        let val = (quote as any)[columnId];
        if (columnId === 'id_quote_status') {
            const status = quoteStatuses.find(s => s.id_status === val);
            val = status ? status.name : 'Desconocido';
        }
        if (!val) val = '(Vacío)';
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  // --- ACTIONS HANDLERS ---
  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    // Filtrar contactos para el modal de edición
    if (quote.id_client_company) {
        setFilteredContacts(contacts.filter(c => c.id_client_company === quote.id_client_company));
    } else {
        setFilteredContacts([]);
    }
    setIsModalOpen(true);
  };

  const handleInlineUpdate = async (quote: Quote, updates: Partial<Quote>) => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    const isStatusChange = updates.id_quote_status && updates.id_quote_status !== quote.id_quote_status;
    const targetStatus = isStatusChange
      ? quoteStatuses.find((s) => s.id_status === updates.id_quote_status)
      : undefined;

    const runUpdate = async () => {
      setQuotes(prev => prev.map(q => q.id_cotizacion === quote.id_cotizacion ? { ...q, ...updates } : q));

      try {
          const payload = updates.id_quote_status 
              ? { id_cotizacion: quote.id_cotizacion, id_quote_status: updates.id_quote_status, id_tenant: user.id_tenant, id_user: user.id_user }
              : { ...quote, ...updates, id_tenant: user.id_tenant, id_user: user.id_user };
              
          const endpoint = updates.id_quote_status ? '/api/status/quotes' : '/api/quotes/update';
          
          const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });
          
          if (!res.ok) throw new Error();
          setToast({ message: 'Actualizado correctamente.', type: 'success' });
          fetchData(); 
      } catch {
          setToast({ message: 'Error al actualizar.', type: 'error' });
          fetchData(); 
      }
    };

    if (isStatusChange) {
      setConfirmState({
        isOpen: true,
        title: 'Confirmar Cambio de Estado',
        message: `¿Estás seguro de cambiar el estado a "${targetStatus?.name}"?`,
        onConfirm: () => {
          runUpdate();
          setConfirmState((p) => ({ ...p, isOpen: false }));
        },
      });
      return;
    }

    runUpdate();
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Cotización',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        try {
            await fetch('https://service.computeksa.com/webhook/api/quotes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_cotizacion: id, id_tenant: user?.id_tenant, id_user: user?.id_user }),
            });
            setToast({ message: 'Cotización eliminada.', type: 'success' });
            fetchData();
        } catch {
            setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
            setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Función para manejar cambios en el form de edición
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isCompanyChange = name === 'id_client_company';
    
    if (isCompanyChange) {
        setFilteredContacts(contacts.filter(c => c.id_client_company === value));
        setEditingQuote(prev => (prev ? { ...prev, [name]: value, id_contact: '' } : null));
    } else {
        setEditingQuote(prev => (prev ? { ...prev, [name]: value } : null));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote || !user) return;
    setSubmitting(true);
    try {
        const payload = { ...editingQuote, id_tenant: user.id_tenant, id_user: user.id_user, is_private: !!editingQuote.is_private };
        const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setToast({ message: 'Cotización actualizada.', type: 'success' });
        setIsModalOpen(false);
        fetchData();
    } catch {
        setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
        setSubmitting(false);
    }
  };

  // --- COLUMNS DEFINITION ---
  const columns = useMemo<ColumnDef<Quote>[]>(() => [
    {
        accessorKey: 'id_quote_status',
        header: 'Estado',
        size: 160,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            // CORRECCIÓN: Renderizar cabecera de grupo solo si estamos agrupando por estado
            if (row.getIsGrouped()) {
                if (grouping.includes(column.id)) {
                    const status = quoteStatuses.find(s => s.id_status === getValue());
                    return renderGroupCell(row, status?.name || 'Desconocido');
                }
                return null;
            }
            return (
                <InlineBadgeSelector 
                    valueId={getValue() as number}
                    items={quoteStatuses.map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
                    onSelect={(id) => handleInlineUpdate(row.original, { id_quote_status: Number(id) })}
                    disabled={!(row.original.access_level === 'EDIT' || user?.rol_user === 'admin')}
                />
            );
        },
        filterFn: (row, id, filterValue: string[]) => {
             const status = quoteStatuses.find(s => s.id_status === row.getValue(id));
             const statusName = status ? status.name : 'Desconocido';
             return filterValue.length === 0 || filterValue.includes(statusName);
        }
    },
    {
        accessorKey: 'formatted_no_cotizacion',
        header: 'Nro.',
        size: 80,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="font-bold text-brand-600 text-xs">{getValue() as string}</span>
    },
    {
        accessorKey: 'nombre_cotizacion',
        header: 'Nombre',
        size: 200,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-slate-700 text-sm font-medium">{getValue() as string}</span>
    },
    {
      accessorKey: 'client_company_name',
      header: 'Cliente',
      size: 220,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        // CORRECCIÓN PRINCIPAL: Solo renderizar grupo si ESTA columna es la agrupada
        if (row.getIsGrouped()) {
            return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string || 'Sin Cliente') : null;
        }
        return (
            <div className="flex flex-col">
                <span className="font-bold text-slate-700 text-xs uppercase">{getValue() as string}</span>
                <span className="text-[11px] text-slate-400">{row.original.contact_full_name || 'Sin contacto'}</span>
            </div>
        );
      }
    },
    {
        accessorKey: 'total',
        header: 'Total',
        size: 120,
        // CORRECCIÓN: Retornar null si es grupo
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="font-mono font-bold text-slate-700 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100">{formatCurrency(getValue() as string)}</span>
    },
    {
        accessorKey: 'created_by_name',
        header: 'Owner',
        size: 150,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            // CORRECCIÓN: Renderizar cabecera solo si es la columna agrupada
            if (row.getIsGrouped()) {
                return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string) : null;
            }
            return (
                <div className="flex items-center gap-2">
                    <img src={row.original.created_by_avatar || `https://ui-avatars.com/api/?name=${getValue()}`} className="w-5 h-5 rounded-full border border-slate-200" alt="" />
                    <span className="text-xs text-slate-600 font-medium">{getValue() as string}</span>
                </div>
            );
        }
    },
    {
      accessorKey: 'fecha_emision',
      header: 'Fecha Emisión',
      size: 120,
      filterFn: dateRangeFilter,
      cell: ({ row }) => {
        const fecha = row.original.fecha_emision_fmt || row.original.fecha_emision;
        return <span className="text-xs text-slate-500">{fecha}</span>;
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Creado',
      size: 140,
      cell: ({ row }) => {
        // Preferir el campo formateado si existe, si no, formatear localmente
        let fecha = row.original.created_at_fmt;
        if (!fecha && row.original.created_at) {
          const d = new Date(row.original.created_at);
          fecha = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return <span className="text-xs text-slate-500">{fecha}</span>;
      }
    },
    {
        id: 'actions',
        header: 'Acciones',
        size: 100,
        cell: ({ row }) => {
            if (row.getIsGrouped()) return null;
            const q = row.original;
            const canEdit = q.access_level === 'EDIT' || user?.rol_user === 'admin';
            const canDelete = q.created_by === user?.id_user || user?.rol_user === 'admin';
            return (
                <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/app/quotes/new?id=${q.id_cotizacion}`); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); setShareQuoteId(q.id_cotizacion); setIsShareOpen(true); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-user-plus text-[10px]"></i></button>
                        </>
                    )}
                    {canDelete && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id_cotizacion); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    )}
                </div>
            );
        }
    }
  ], [quoteStatuses, grouping]);

  const table = useReactTable({
    data: quotes,
    columns,
    state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => {
      if ('id_cotizacion' in row) return row.id_cotizacion as string; // Fix: Ensure correct ID field
      return '';
    }
  });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans text-slate-700">
      
      {/* TOOLBAR RESPONSIVO MEJORADO */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3">

        {(loading || quotes.length > 0) && (
          <>
            {/* 1. BUSCADOR */}
            <div className="relative order-3 lg:order-1 w-full lg:flex-1">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input 
                    value={globalFilter} 
                    onChange={e => setGlobalFilter(e.target.value)}
                    placeholder="Buscar cotización..." 
                    className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                />
            </div>
            
            {/* 2. FILTROS */}
            <div className="order-2 lg:order-2 w-full lg:w-auto flex items-center justify-start lg:justify-center flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm min-w-[200px]">
                <span className="text-[11px] font-black text-slate-400 uppercase px-2 whitespace-nowrap">Agrupar por:</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {[
                        { id: 'client_company_name', label: 'Cliente', icon: 'fa-building' },
                        { id: 'id_quote_status', label: 'Estado', icon: 'fa-list-check' },
                        { id: 'created_by_name', label: 'Owner', icon: 'fa-user-tie' }
                    ].map(opt => (
                        <button 
                            key={opt.id} 
                            onClick={() => setGrouping(prev => prev.includes(opt.id) ? [] : [opt.id])}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                                grouping.includes(opt.id)
                                ? 'bg-brand-600 text-white shadow-inner' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <i className={`fa-solid ${opt.icon} text-[11px]`}></i> {opt.label}
                        </button>
                    ))}
                </div>
            </div>
          </>
        )}

        {/* 3. BOTÓN AÑADIR */}
        <Link 
          to="/app/quotes/new" 
          className={`order-1 lg:order-3 w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all flex items-center justify-center gap-2 ${(!loading && quotes.length === 0) ? 'mx-auto sm:mx-0' : ''}`}
        >
            <i className="fa-solid fa-plus"></i> Nueva Cotización
        </Link>
      </div>

      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40 shadow-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const isDate = header.column.id === 'fecha_emision';
                  
                  return (
                    <th key={header.id} style={{ width: header.getSize() }} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2 text-left relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {{ asc: <i className="fa-solid fa-sort-up text-brand-600"></i>, desc: <i className="fa-solid fa-sort-down text-brand-600"></i> }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {header.column.id !== 'actions' && header.column.columnDef.enableColumnFilter !== false && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }} className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isFiltered ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}><i className={`fa-solid ${isDate ? 'fa-calendar' : 'fa-filter'} text-[10px]`}></i></button>
                        )}
                      </div>

                      {activeFilterMenu === header.column.id && (
                        <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-3 animate-in fade-in slide-in-from-top-1">
                          {isDate ? (
                            <div className="px-4 space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rango de fechas</span>
                                <input type="date" className="w-full text-xs border rounded p-1" onChange={e => header.column.setFilterValue(old => ({ ...old as any, start: e.target.value }))} />
                                <input type="date" className="w-full text-xs border rounded p-1" onChange={e => header.column.setFilterValue(old => ({ ...old as any, end: e.target.value }))} />
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto px-1">
                                {getFacetedValues(header.column.id).map(([val, count]) => {
                                    const isChecked = (columnFilters.find(f => f.id === header.column.id)?.value as string[] || []).includes(val);
                                    return (
                                        <label key={val} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-brand-600 border-brand-600 shadow-sm' : 'bg-white border-slate-300'}`}>{isChecked && <i className="fa-solid fa-check text-[10px] text-white"></i>}</div>
                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{val}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-600">({count})</span>
                                            <input type="checkbox" className="hidden" checked={isChecked} onChange={() => {
                                                const current = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                                                const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
                                                header.column.setFilterValue(next.length ? next : undefined);
                                            }} />
                                        </label>
                                    );
                                })}
                            </div>
                          )}
                          {isFiltered && <div className="mt-2 pt-2 border-t px-3 text-center"><button onClick={() => header.column.setFilterValue(undefined)} className="text-[10px] font-black text-red-500 hover:underline uppercase">Limpiar Filtro</button></div>}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {loading ? (
                <tr><td colSpan={columns.length} className="py-24 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-3"></i><p className="text-slate-400 text-sm font-medium">Cargando cotizaciones...</p></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-24 text-center text-slate-500">No se encontraron cotizaciones.</td></tr>
            ) : table.getRowModel().rows.map(row => {
                const isGrouped = row.getIsGrouped();
                return (
                    <tr 
                        key={row.id} 
                        onClick={() => { if(isGrouped) row.toggleExpanded(); else navigate(`/app/quotes/${row.original.id_cotizacion}`); }}
                        className={`${isGrouped ? 'bg-slate-50/80 border-l-4 border-l-brand-500 cursor-pointer font-bold' : 'hover:bg-blue-50/30 cursor-pointer group'} border-b border-slate-100 transition-colors`}
                    >
                        {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className={`px-4 py-2 border-r border-slate-50 ${isGrouped ? 'py-3' : ''}`}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-6">
            <span>{quotes.length} REGISTROS</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black tracking-normal">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
      </div>

      {isModalOpen && editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">Editar Cotización</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de la Cotización</label>
                <input name="nombre_cotizacion" required value={editingQuote.nombre_cotizacion || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                    <select name="id_quote_status" required value={editingQuote.id_quote_status || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">-- Estado --</option>
                    {quoteStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Empresa</label>
                    <select name="id_client_company" required value={editingQuote.id_client_company || ''} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">-- Empresa --</option>
                    {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                    </select>
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contacto Principal</label>
                <select name="id_contact" required value={editingQuote.id_contact || ''} onChange={handleInputChange} disabled={!editingQuote.id_client_company} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">-- Seleccionar Contacto --</option>
                  {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{`${c.first_name} ${c.last_name || ''}`}</option>)}
                </select>
              </div>
              <div className="pt-2">
                 <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center"><i className="fa-solid fa-list-check mr-2 text-brand-500"></i> Condiciones</h3>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Tiempo Entrega</label>
                    <input name="tiempo_entrega" value={editingQuote.tiempo_entrega || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Garantía</label>
                    <input name="garantia" value={editingQuote.garantia || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Validez</label>
                    <input name="validez_oferta" value={editingQuote.validez_oferta || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mensaje (Opcional)</label>
                <textarea name="mensaje" value={editingQuote.mensaje || ''} onChange={handleInputChange} rows={2} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"></textarea>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <input type="checkbox" id="is_private_edit" name="is_private" checked={editingQuote.is_private || false} onChange={(e) => setEditingQuote({ ...(editingQuote || {}), is_private: e.target.checked })} className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
                <label htmlFor="is_private_edit" className="cursor-pointer">
                  <div className="text-sm font-bold text-amber-800">Cotización Privada</div>
                  <div className="text-xs text-amber-700/70 mt-0.5">Solo visible para ti y administradores.</div>
                </label>
              </div>
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.isOpen && <ConfirmModal {...confirmState} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />}
      {isShareOpen && shareQuoteId && <ShareModal entity="quotes" id={shareQuoteId} isOpen={isShareOpen} onClose={() => { setIsShareOpen(false); setShareQuoteId(null); }} onShared={() => setToast({ message: 'Compartido.', type: 'success' })} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default QuotesList;
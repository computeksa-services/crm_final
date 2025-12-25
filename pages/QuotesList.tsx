import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';

// Tipo para el ordenamiento
type SortConfig = {
    key: keyof Quote | 'client_company_name' | 'owner_name' | 'estado_nombre';
    direction: 'asc' | 'desc';
};

// --- COMPONENTE INTERNO MEJORADO: Selector Inline con Posicionamiento Inteligente ---
const InlineBadgeSelector: React.FC<{
    valueId: string | number;
    items: { id: string | number; name: string; color?: string; icon?: string }[];
    onSelect: (id: string | number) => void;
    disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 224 });
    const current = items.find(i => i.id === valueId);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const leaveTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleResize = () => setIsOpen(false);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled || !buttonRef.current) return;

        if (isOpen) {
            setIsOpen(false);
            return;
        }

        const rect = buttonRef.current.getBoundingClientRect();
        const dropdownHeight = Math.min(items.length * 36 + 10, 256);
        const dropdownWidth = 224;

        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpwards = spaceBelow < dropdownHeight && rect.top > spaceBelow;
        const top = openUpwards ? rect.top - dropdownHeight - 5 : rect.bottom + 5;

        const spaceRight = window.innerWidth - rect.left;
        let left = rect.left;
        if (spaceRight < dropdownWidth) {
            left = rect.right - dropdownWidth;
        }

        setCoords({ top, left, width: dropdownWidth });
        setIsOpen(true);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                className={`inline-flex items-center px-2 py-1 rounded-lg border text-[13px] font-bold whitespace-nowrap ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-slate-300'}`}
                style={{
                    backgroundColor: `${current?.color || '#cccccc'}15`,
                    color: current?.color || '#333333',
                    borderColor: `${current?.color || '#cccccc'}40`
                }}
            >
                {current?.icon && <i className={`${current.icon} mr-1.5`}></i>}
                {current?.name || 'Seleccionar'}
                {!disabled && <i className="fa-solid fa-chevron-down text-[10px] ml-1 text-slate-400"></i>}
            </button>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    onMouseLeave={() => {
                        leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), 300);
                    }}
                    onMouseEnter={() => {
                        if (leaveTimeoutRef.current) {
                            clearTimeout(leaveTimeoutRef.current);
                            leaveTimeoutRef.current = null;
                        }
                    }}
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-auto animate-fade-in"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        maxHeight: '256px'
                    }}
                >
                    {items.filter(item => item.id !== valueId).map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm border-b border-slate-50 last:border-0"
                        >
                            <span
                                className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px] font-bold"
                                style={{
                                    backgroundColor: `${item.color || '#cccccc'}15`,
                                    color: item.color || '#333333',
                                    borderColor: `${item.color || '#cccccc'}40`
                                }}
                            >
                                {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                                {item.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

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

    const handleMouseLeave = () => {
        leaveTimeoutRef.current = setTimeout(() => setOpen(false), 300);
    };

    const handleMouseEnter = () => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    };

    return (
        <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem] lg:min-w-[18rem] max-w-[26rem]" onMouseLeave={handleMouseLeave} onMouseEnter={handleMouseEnter}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            >
                {current ? (
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
                        style={{
                            backgroundColor: `${current.color || '#cccccc'}15`,
                            color: current.color || '#333333',
                            borderColor: `${current.color || '#cccccc'}40`
                        }}
                    >
                        {current.icon && <i className={`${current.icon} mr-1.5`}></i>}
                        {current.name}
                    </span>
                ) : (
                    <span className="text-slate-500">{placeholder}</span>
                )}
                <span className="absolute right-3 top-2.5 text-slate-400 text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </span>
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 text-sm"
                    >
                        {placeholder}
                    </button>
                    <div className="border-t border-slate-100"></div>
                    {items.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => { onChange(item.id); setOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm"
                        >
                            <span
                                className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
                                style={{
                                    backgroundColor: `${item.color || '#cccccc'}15`,
                                    color: item.color || '#333333',
                                    borderColor: `${item.color || '#cccccc'}40`
                                }}
                            >
                                {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                                {item.name}
                            </span>
                            {item.count !== undefined && <span className="text-xs text-slate-400 ml-2">({item.count})</span>}
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
  
  // Data State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [quoteStatuses, setQuoteStatuses] = useState<QuoteStatus[]>([]);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Partial<Quote> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<{[key: string]: string[]}>({});
  const [dateFilters, setDateFilters] = useState<{[key: string]: {start: string; end: string}}>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

  // Modals State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; isDestructive?: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

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
        fetch(`/api/statuses/quotes?id_tenant=${tenantId}&id_user=${userId}`)
      ]);
      
      if (!quotesRes.ok) {
        if (quotesRes.status === 404) setQuotes([]);
        else throw new Error('Error al cargar cotizaciones');
        return;
      }
      const parse = async (res: Response) => { const t = await res.text(); return t ? JSON.parse(t) : []; };
      const quotesData = await parse(quotesRes);
      const companiesData = await parse(companiesRes);
      const contactsData = await parse(contactsRes);
      const statusesData = await parse(statusesRes);
      setQuotes(quotesData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setQuoteStatuses(statusesData);

    } catch (e) {
      setToast({ message: 'Error al cargar las cotizaciones.', type: 'error' });
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter Functions
  const toggleColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: newValues };
    });
  };

  const updateDateFilter = (column: string, type: 'start' | 'end', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [column]: { ...(prev[column] || { start: '', end: '' }), [type]: value }
    }));
  };

  const clearDateFilter = (column: string, type?: 'start' | 'end') => {
    if (type) {
      setDateFilters(prev => ({
        ...prev,
        [column]: { ...(prev[column] || { start: '', end: '' }), [type]: '' }
      }));
    } else {
      setDateFilters(prev => {
        const updated = { ...prev };
        delete updated[column];
        return updated;
      });
    }
  };

  const getUniqueValues = (column: string) => {
    const valueCounts = new Map<string, number>();
    quotes.forEach(quote => {
      let val = '';
      if (column === 'estado_nombre') {
        val = quote.estado_nombre || quote.estado || '';
      } else if (column === 'client_company_name') {
        val = quote.client_company_name || '';
      } else if (column === 'owner_name') {
        val = quote.created_by_name || '';
      }
      if (val) {
        valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
      }
    });
    return Array.from(valueCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const adjustDropdownPosition = (el: HTMLDivElement | null, preferredHeight?: number) => {
    if (!el) return;
    el.style.position = 'absolute';
    el.style.top = '100%';
    el.style.left = '0';
    el.style.marginTop = '8px';
    el.style.zIndex = '50';
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setColumnFilters({});
    setDateFilters({});
  };

  const hasActiveFilters = useMemo(() => {
    const hasColumnFilters = Object.values(columnFilters).some(v => (v || []).length > 0);
    const hasDateFilters = Object.values(dateFilters).some(r => !!(r?.start || r?.end));
    return Boolean(searchTerm || statusFilter || hasColumnFilters || hasDateFilters);
  }, [searchTerm, statusFilter, columnFilters, dateFilters]);

  useEffect(() => {
    if (editingQuote?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === editingQuote.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [editingQuote?.id_client_company, contacts]);

  // --- MANEJO DE CLICKS FUERA DE FILTROS ---
  useEffect(() => {
    if (openFilterColumn === null) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-filter-column]')) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openFilterColumn]);

  const requestSort = (key: SortConfig['key']) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Logic for Client-Side Filtering & Sorting
  const filteredAndSortedQuotes = useMemo(() => {
    // 1. Filtrar
    let result = (Array.isArray(quotes) ? quotes : []).filter(quote => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        (quote.formatted_no_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.client_company_name || '').toLowerCase().includes(searchLower) ||
        (quote.nombre_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.created_by_name || '').toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter ? quote.id_quote_status?.toString() === statusFilter : true;

      const matchesColumnFilters = Object.entries(columnFilters).every(([col, values]) => {
        if (values.length === 0) return true;
        if (col === 'estado_nombre') return values.includes(quote.estado_nombre || quote.estado || '');
        if (col === 'client_company_name') return values.includes(quote.client_company_name || '');
        if (col === 'owner_name') return values.includes(quote.created_by_name || '');
        return true;
      });

      const matchesDateFilters = Object.entries(dateFilters).every(([col, range]) => {
        if (!range.start && !range.end) return true;
        let dateValue = '';
        if (col === 'fecha_emision') {
          dateValue = quote.fecha_emision || '';
        } else if (col === 'created_at') {
          dateValue = quote.created_at || '';
        }
        if (!dateValue) return false;
        const itemDate = new Date(dateValue).setHours(0, 0, 0, 0);
        if (range.start) {
          const startDate = new Date(range.start).setHours(0, 0, 0, 0);
          if (itemDate < startDate) return false;
        }
        if (range.end) {
          const endDate = new Date(range.end).setHours(0, 0, 0, 0);
          if (itemDate > endDate) return false;
        }
        return true;
      });

      return matchesSearch && matchesStatus && matchesColumnFilters && matchesDateFilters;
    });

    // 2. Ordenar
    result.sort((a, b) => {
      let aValue = a[sortConfig.key as keyof Quote];
      let bValue = b[sortConfig.key as keyof Quote];

      if (sortConfig.key === 'client_company_name') {
        aValue = a.client_company_name || '';
        bValue = b.client_company_name || '';
      } else if (sortConfig.key === 'owner_name') {
        aValue = a.created_by_name || '';
        bValue = b.created_by_name || '';
      } else if (sortConfig.key === 'estado_nombre') {
        aValue = a.estado_nombre || a.estado || '';
        bValue = b.estado_nombre || b.estado || '';
      }

      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return result;
  }, [quotes, searchTerm, statusFilter, columnFilters, dateFilters, sortConfig]);

  const handleRowClick = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    // No setIsEditMode needed as per simplified logic, just modal open
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isCompanyChange = name === 'id_client_company';
    setEditingQuote(prev => (prev ? { ...prev, [name]: value, ...(isCompanyChange && { id_contact: '' }) } : null));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote || !user?.id_tenant || !user?.id_user) return;
    if (!editingQuote.nombre_cotizacion || !editingQuote.id_client_company || !editingQuote.id_contact || !editingQuote.id_quote_status) {
      setToast({ message: 'Complete Nombre, Empresa, Contacto y Estado.', type: 'error' });
      return;
    }
    setSubmitting(true);
    const payload = {
      ...editingQuote,
      id_tenant: user.id_tenant,
      id_user: user.id_user,
      is_private: !!editingQuote.is_private,
    };
    try {
      const response = await fetch('/api/quotes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al actualizar cotización.' }));
        throw new Error(errorData.message || 'Error al actualizar cotización.');
      }
      setToast({ message: 'Cotización actualizada.', type: 'success' });
      setIsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar la cotización.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuote = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Cotización',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant || !user?.id_user) return;
        setSubmitting(true);
        try {
          const response = await fetch('https://service.computeksa.com/webhook/api/quotes/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_cotizacion: id, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar cotización.' }));
            throw new Error(errorData.message || 'Error al eliminar cotización.');
          }
          await fetchData();
          setToast({ message: 'Cotización eliminada.', type: 'success' });
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleInlineUpdate = async (quote: Quote, updates: Partial<Quote>) => {
    if (!user?.id_tenant || !user?.id_user) return;
    const previousQuote = { ...quote };
    setQuotes(prev => prev.map(q => q.id_cotizacion === quote.id_cotizacion ? { ...q, ...updates } : q));

    try {
      const payload = {
        ...quote,
        ...updates,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
      };
      const res = await fetch('/api/quotes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('No se pudo actualizar');
      setToast({ message: 'Cotización actualizada.', type: 'success' });
    } catch (err) {
      setQuotes(prev => prev.map(q => q.id_cotizacion === quote.id_cotizacion ? previousQuote : q));
      setToast({ message: 'Error al actualizar.', type: 'error' });
    }
  };

  // --- RENDERIZADO TABLA ---
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <i className="fa-solid fa-sort text-slate-300 ml-1 text-xs"></i>;
    return <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-brand-600 ml-1 text-xs`}></i>;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="p-12 text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
            <p className="text-slate-500 font-medium">Sincronizando cotizaciones...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-12 text-center">
             <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-4"></i>
            <p className="text-slate-600 font-medium">{error}</p>
        </div>
      );
    }
    if (quotes.length === 0) {
      return (
        <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <i className="fa-solid fa-file-invoice-dollar text-3xl text-slate-300"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-700">No hay cotizaciones aún</h3>
            <p className="text-slate-500 max-w-sm mt-1 mb-6">Crea tu primera cotización profesional para enviar a tus clientes y cerrar más tratos.</p>
            <Link to="/quotes/new" className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                Crear Primera Cotización
            </Link>
        </div>
      );
    }

    if (filteredAndSortedQuotes.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron resultados para tu búsqueda.</p>
                <button onClick={clearAllFilters} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '1200px' }}>
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider sticky top-0 z-10">
                    <tr>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors min-w-[40px]" onClick={() => requestSort('formatted_no_cotizacion')}>
                            Nro. <SortIcon column="formatted_no_cotizacion" />
                        </th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('nombre_cotizacion')}>
                            Nombre <SortIcon column="nombre_cotizacion" />
                        </th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('client_company_name')}>
                            Cliente <SortIcon column="client_company_name" />
                        </th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => requestSort('total')}>
                            Total <SortIcon column="total" />
                        </th>
                        <th data-filter-column="estado_nombre" className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('estado_nombre')}>
                                    Estado <SortIcon column="estado_nombre" />
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'estado_nombre' ? null : 'estado_nombre'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['estado_nombre'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por Estado"
                                >
                                    <i className="fa-solid fa-filter text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'estado_nombre' && (
                                <div
                                    className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-64 overflow-auto z-50"
                                    onMouseLeave={() => setOpenFilterColumn(null)}
                                >
                                    {getUniqueValues('estado_nombre').map(val => (
                                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                                            <input type="checkbox" checked={(columnFilters['estado_nombre'] || []).includes(val.value)} onChange={() => toggleColumnFilter('estado_nombre', val.value)} className="w-4 h-4" />
                                            <span className="flex-1">{val.label}</span>
                                            <span className="text-xs text-slate-400">({val.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </th>
                        <th data-filter-column="owner_name" className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('created_by_name')}>
                                    Owner <SortIcon column="owner_name" />
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'owner_name' ? null : 'owner_name'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['owner_name'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por Owner"
                                >
                                    <i className="fa-solid fa-filter text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'owner_name' && (
                                <div
                                    className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-64 overflow-auto z-50"
                                    onMouseLeave={() => setOpenFilterColumn(null)}
                                >
                                    {getUniqueValues('owner_name').map(val => (
                                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                                            <input type="checkbox" checked={(columnFilters['owner_name'] || []).includes(val.value)} onChange={() => toggleColumnFilter('owner_name', val.value)} className="w-4 h-4" />
                                            <span className="flex-1">{val.label}</span>
                                            <span className="text-xs text-slate-400">({val.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </th>
                        <th data-filter-column="fecha_emision" className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('fecha_emision')}>
                                    Fecha <SortIcon column="fecha_emision" />
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'fecha_emision' ? null : 'fecha_emision'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(dateFilters['fecha_emision']?.start || dateFilters['fecha_emision']?.end) ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por fecha"
                                >
                                    <i className="fa-solid fa-calendar text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'fecha_emision' && (
                                <div
                                    className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 z-50"
                                    onMouseLeave={() => setOpenFilterColumn(null)}
                                >
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                                            <input type="date" value={dateFilters['fecha_emision']?.start || ''} onChange={(e) => updateDateFilter('fecha_emision', 'start', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                                            <input type="date" value={dateFilters['fecha_emision']?.end || ''} onChange={(e) => updateDateFilter('fecha_emision', 'end', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        {(dateFilters['fecha_emision']?.start || dateFilters['fecha_emision']?.end) && (
                                            <button type="button" onClick={() => clearDateFilter('fecha_emision')} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors">
                                                <i className="fa-solid fa-times mr-1"></i> Limpiar filtro
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </th>
                        <th className="px-2 py-3 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white" style={{ minHeight: '400px' }}>
                    {filteredAndSortedQuotes.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-slate-500" style={{ minHeight: '400px' }}>
                                <i className="fa-solid fa-filter text-2xl mb-2 block text-slate-300"></i>
                                No hay resultados para los filtros aplicados.
                            </td>
                        </tr>
                    ) : (
                        <>
                        {filteredAndSortedQuotes.map((quote) => (
                            <tr key={quote.id_cotizacion} onClick={() => handleRowClick(quote.id_cotizacion)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                                <td className="px-2 sm:px-4 py-2 align-top">
                                    <div className="flex flex-col whitespace-normal break-words">
                                        <span className="font-bold text-brand-600 text-sm hover:underline">#{quote.formatted_no_cotizacion || '---'}</span>
                                    </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 align-top">
                                    <div className="flex flex-col whitespace-normal break-words">
                                        <span className="text-sm font-bold text-slate-700">{quote.nombre_cotizacion || 'Sin Nombre'}</span>
                                    </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 align-top">
                                    <div className="flex flex-col whitespace-normal">
                                        <div className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            <i className="fa-solid fa-building text-slate-400 text-xs"></i>
                                            {quote.client_company_name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                            <i className="fa-solid fa-user text-slate-400 text-xs"></i>
                                            <span>{quote.contact_full_name || quote.contact_name}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-right">
                                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-sm">
                                        {quote.total}
                                    </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                    <InlineBadgeSelector
                                        valueId={quote.id_quote_status || 0}
                                        items={quoteStatuses.map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
                                        disabled={!(quote.access_level === 'EDIT' || user?.rol_user === 'admin')}
                                        onSelect={(id) => {
                                            if (id === quote.id_quote_status) return;
                                            const st = quoteStatuses.find(s => s.id_status === id);
                                            handleInlineUpdate(quote, {
                                                id_quote_status: id,
                                                estado_nombre: st?.name,
                                                estado_color: st?.color,
                                                estado_icon: st?.icon,
                                            });
                                        }}
                                    />
                                </td>
                                <td className="px-2 sm:px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${quote.created_by_name || 'User'}&background=random`}
                                            alt="Owner"
                                            className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover"
                                        />
                                        <span className="text-xs text-slate-600 whitespace-nowrap">{quote.created_by_name}</span>
                                    </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2">
                                    <div className="text-xs text-slate-600 whitespace-nowrap">
                                        <i className="fa-regular fa-calendar-plus text-slate-400 mr-1.5"></i>
                                        {quote.fecha_emision_fmt || (quote.fecha_emision ? new Date(quote.fecha_emision).toLocaleDateString() : 'N/A')}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(quote.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(quote); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">
                                                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setShareQuoteId(quote.id_cotizacion); setIsShareOpen(true); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Compartir">
                                                    <i className="fa-solid fa-user-plus text-xs"></i>
                                                </button>
                                            </>
                                        )}
                                        {(quote.created_by === user?.id_user || user?.rol_user === 'admin') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id_cotizacion); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredAndSortedQuotes.length < 6 && Array.from({ length: 6 - filteredAndSortedQuotes.length }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{ height: '60px' }}>
                                <td colSpan={9}></td>
                            </tr>
                        ))}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <>
    <div className="w-full mx-auto px-2 md:px-4 lg:px-6 space-y-4 animate-fade-in pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cotizaciones</h1>
            <p className="text-slate-500 text-sm mt-1">Gestiona, envía y monitorea tus propuestas comerciales.</p>
        </div>
        <Link to="/quotes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Cotización
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 items-center">
        <div className="relative w-full md:flex-1 min-w-[260px]">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm" />
        </div>
        <div className="flex items-center gap-2 w-full md:flex-1 flex-wrap justify-end">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="p-2.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              title="Quitar filtros"
            >
              <i className="fa-solid fa-filter-circle-xmark text-base"></i>
            </button>
          )}
          <StatusInterestFilter
            placeholder="Todos los Estados"
            selectedId={statusFilter}
            onChange={setStatusFilter}
            items={quoteStatuses.map(s => {
              const count = quotes.filter(q => q.id_quote_status?.toString() === s.id_status.toString()).length;
              return { id: s.id_status.toString(), name: s.name, color: s.color, icon: s.icon, count };
            })}
          />
        </div>
      </div>

      {/* Table Container aligned with DealsList */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-visible w-full flex flex-col">
        <div style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '350px', overflowY: 'auto', overflowX: 'hidden' }}>
          {renderContent()}
        </div>
        {filteredAndSortedQuotes.length > 0 && (
          <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span>Mostrando <span className="font-semibold text-slate-700">{filteredAndSortedQuotes.length}</span> de <span className="font-semibold text-slate-700">{quotes.length}</span> registros</span>
            <span className="text-lg font-bold text-brand-700">Total: ${filteredAndSortedQuotes.reduce((sum, q) => {
              const val = typeof q.total === 'string' ? parseFloat((q.total as string).replace(/[^0-9.-]+/g, '')) : (q.total as number);
              return sum + (isNaN(val as number) ? 0 : (val as number));
            }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </div>

    {/* Edit Modal */}
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
                <input 
                    name="nombre_cotizacion" 
                    required 
                    value={editingQuote.nombre_cotizacion || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Ej. Renovación de Licencias 2024"
                />
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
                  <div className="text-xs text-amber-700/70 mt-0.5">
                    Solo visible para ti y administradores. No se comparte con el equipo.
                  </div>
                </label>
              </div>
              
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isDestructive={confirmState.isDestructive}
          onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
          onConfirm={confirmState.onConfirm || (() => setConfirmState({ ...confirmState, isOpen: false }))}
        />
      )}

      {isShareOpen && shareQuoteId && (
        <ShareModal 
          entity="quotes" 
          id={shareQuoteId} 
          isOpen={isShareOpen} 
          onClose={() => { setIsShareOpen(false); setShareQuoteId(null); }} 
          onShared={() => setToast({ message: 'Cotización compartida.', type: 'success' })}
          excludeUserIds={user ? [user.id_user] : []}
        />
      )}

    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default QuotesList;
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../types';
import Toast from '../components/Toast';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';

// InlineBadgeSelector Component
interface InlineBadgeSelectorProps {
  value: string;
  valueId: string | number;
  color?: string;
  icon?: string;
  items: { id: string | number; name: string; color?: string; icon?: string }[];
  onSelect: (id: string | number) => void;
}

const InlineBadgeSelector: React.FC<InlineBadgeSelectorProps> = ({ value, valueId, color, icon, items, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(items.length * 40, 280);
      
      const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      
      setDropdownCoords({
        top: openUpwards ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
        left: rect.left,
      });
      setIsOpen(true);
    }
  };

  const handleSelect = (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    onSelect(id);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector(`[data-dropdown-for="${valueId}"]`);
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, valueId]);

  const filteredItems = items.filter(item => item.id !== valueId);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold transition-all hover:shadow-md border"
        style={{ 
          backgroundColor: `${color || '#94a3b8'}20`, 
          color: color || '#475569',
          borderColor: `${color || '#94a3b8'}50`
        }}
      >
        {icon && <i className={`${icon} mr-1.5`}></i>}
        {value || 'Desconocido'}
        <i className="fa-solid fa-chevron-down ml-1.5 text-[10px] opacity-60"></i>
      </button>

      {isOpen && (
        <div
          data-dropdown-for={valueId}
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            zIndex: 9999,
          }}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[200px] max-h-[280px] overflow-y-auto"
          onMouseLeave={() => setIsOpen(false)}
        >
          {filteredItems.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">No hay otras opciones</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleSelect(e, item.id)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span
                  className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border"
                  style={{ 
                    backgroundColor: `${item.color || '#94a3b8'}20`, 
                    color: item.color || '#475569',
                    borderColor: `${item.color || '#94a3b8'}50`
                  }}
                >
                  {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                  {item.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// StatusInterestFilter Component
interface StatusFilterProps {
  placeholder: string;
  selectedId: string;
  onChange: (val: string) => void;
  items: { id: string; name: string; color?: string; icon?: string; count?: number }[];
}

const StatusInterestFilter: React.FC<StatusFilterProps> = ({ placeholder, selectedId, onChange, items }) => {
  const [open, setOpen] = useState(false);
  const current = items.find(i => i.id === selectedId);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem] lg:min-w-[18rem] max-w-[26rem]" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
      >
        {current ? (
          <span
            className="inline-flex items-center px-3 py-1 rounded-lg border text-xs font-bold"
            style={{
              backgroundColor: `${current.color || '#94a3b8'}20`,
              color: current.color || '#475569',
              borderColor: `${current.color || '#94a3b8'}50`
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
                className="inline-flex items-center px-3 py-1 rounded-lg border text-xs font-bold"
                style={{
                  backgroundColor: `${item.color || '#94a3b8'}20`,
                  color: item.color || '#475569',
                  borderColor: `${item.color || '#94a3b8'}50`
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
  
  // Filters State (New)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<{[key: string]: string[]}>({});
  const [dateFilters, setDateFilters] = useState<{[key: string]: {start: string; end: string}}>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);

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

  // Logic for Client-Side Filtering
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (quote.formatted_no_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.client_company_name || '').toLowerCase().includes(searchLower) ||
        (quote.nombre_cotizacion || '').toLowerCase().includes(searchLower) ||
        (quote.created_by_name || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      const matchesStatus = statusFilter ? quote.id_quote_status?.toString() === statusFilter : true;
      if (!matchesStatus) return false;

      const matchesColumnFilters = Object.entries(columnFilters).every(([col, values]) => {
        if (values.length === 0) return true;
        if (col === 'estado_nombre') {
          return values.includes(quote.estado_nombre || quote.estado || '');
        }
        if (col === 'client_company_name') {
          return values.includes(quote.client_company_name || '');
        }
        if (col === 'owner_name') {
          return values.includes(quote.created_by_name || '');
        }
        return true;
      });
      if (!matchesColumnFilters) return false;

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
      if (!matchesDateFilters) return false;

      return true;
    });
  }, [quotes, searchTerm, statusFilter, columnFilters, dateFilters]);

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

    if (filteredQuotes.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron resultados para tu búsqueda.</p>
                <button onClick={clearAllFilters} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Detalle</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider relative overflow-visible">
                <div className="flex items-center justify-between">
                  <span>Cliente</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'client_company_name' ? null : 'client_company_name'); }}
                    className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      (columnFilters.client_company_name || []).length > 0 ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className="fa-solid fa-filter text-[10px]"></i>
                  </button>
                </div>
                {openFilterColumn === 'client_company_name' && (
                  <div
                    ref={(el) => adjustDropdownPosition(el)}
                    className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[220px] max-h-[280px] overflow-y-auto"
                    onMouseLeave={() => setOpenFilterColumn(null)}
                  >
                    {getUniqueValues('client_company_name').map((val) => (
                      <label key={val.value} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(columnFilters.client_company_name || []).includes(val.value)}
                          onChange={() => toggleColumnFilter('client_company_name', val.value)}
                          className="mr-3 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 flex-1">{val.label}</span>
                        <span className="text-xs text-slate-400">({val.count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider relative overflow-visible">
                <div className="flex items-center justify-between">
                  <span>Fecha</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'fecha_emision' ? null : 'fecha_emision'); }}
                    className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      (dateFilters.fecha_emision?.start || dateFilters.fecha_emision?.end) ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className="fa-solid fa-calendar-days text-[10px]"></i>
                  </button>
                </div>
                {openFilterColumn === 'fecha_emision' && (
                  <div
                    ref={(el) => adjustDropdownPosition(el)}
                    className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 min-w-[240px]"
                    onMouseLeave={() => setOpenFilterColumn(null)}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateFilters.fecha_emision?.start || ''}
                            onChange={(e) => updateDateFilter('fecha_emision', 'start', e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                          />
                          {dateFilters.fecha_emision?.start && (
                            <button
                              type="button"
                              onClick={() => clearDateFilter('fecha_emision', 'start')}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <i className="fa-solid fa-times text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateFilters.fecha_emision?.end || ''}
                            onChange={(e) => updateDateFilter('fecha_emision', 'end', e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                          />
                          {dateFilters.fecha_emision?.end && (
                            <button
                              type="button"
                              onClick={() => clearDateFilter('fecha_emision', 'end')}
                              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <i className="fa-solid fa-times text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider relative overflow-visible">
                <div className="flex items-center justify-between">
                  <span>Owner</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'owner_name' ? null : 'owner_name'); }}
                    className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      (columnFilters.owner_name || []).length > 0 ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className="fa-solid fa-filter text-[10px]"></i>
                  </button>
                </div>
                {openFilterColumn === 'owner_name' && (
                  <div
                    ref={(el) => adjustDropdownPosition(el)}
                    className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[220px] max-h-[280px] overflow-y-auto"
                    onMouseLeave={() => setOpenFilterColumn(null)}
                  >
                    {getUniqueValues('owner_name').map((val) => (
                      <label key={val.value} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(columnFilters.owner_name || []).includes(val.value)}
                          onChange={() => toggleColumnFilter('owner_name', val.value)}
                          className="mr-3 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 flex-1">{val.label}</span>
                        <span className="text-xs text-slate-400">({val.count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider relative overflow-visible">
                <div className="flex items-center justify-between">
                  <span>Estado</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'estado_nombre' ? null : 'estado_nombre'); }}
                    className={`ml-2 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      (columnFilters.estado_nombre || []).length > 0 ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className="fa-solid fa-filter text-[10px]"></i>
                  </button>
                </div>
                {openFilterColumn === 'estado_nombre' && (
                  <div
                    ref={(el) => adjustDropdownPosition(el)}
                    className="bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[220px] max-h-[280px] overflow-y-auto"
                    onMouseLeave={() => setOpenFilterColumn(null)}
                  >
                    {getUniqueValues('estado_nombre').map((val) => (
                      <label key={val.value} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(columnFilters.estado_nombre || []).includes(val.value)}
                          onChange={() => toggleColumnFilter('estado_nombre', val.value)}
                          className="mr-3 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 flex-1">{val.label}</span>
                        <span className="text-xs text-slate-400">({val.count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredQuotes.map((quote) => (
              <tr 
                key={quote.id_cotizacion} 
                onClick={() => handleRowClick(quote.id_cotizacion)}
                className="hover:bg-slate-50/80 transition-all cursor-pointer group"
              >
                <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-brand-600 text-sm hover:underline flex items-center gap-1">
                            #{quote.formatted_no_cotizacion || '---'}
                            {quote.is_private && <i className="fa-solid fa-lock text-[10px] text-amber-500" title="Privado"></i>}
                        </span>
                        <span className="text-slate-700 font-medium text-sm mt-0.5 truncate max-w-[220px]">
                            {quote.nombre_cotizacion || 'Sin Nombre'}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mr-3 text-xs shrink-0">
                             <i className="fa-solid fa-building"></i>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{quote.client_company_name || 'N/A'}</span>
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">{quote.contact_full_name || quote.contact_name}</span>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">
                    {quote.fecha_emision_fmt || new Date(quote.fecha_emision).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs border border-slate-200">
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700 truncate max-w-[160px]">{quote.created_by_name || 'Sin asignar'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {quote.access_level === 'EDIT' ? (
                    <InlineBadgeSelector
                      value={quote.estado_nombre || quote.estado || 'Desconocido'}
                      valueId={quote.id_quote_status || 0}
                      color={quote.estado_color}
                      icon={quote.estado_icon}
                      items={quoteStatuses.map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
                      onSelect={async (id) => {
                        if (!user?.id_tenant || !user?.id_user) return;
                        try {
                          const response = await fetch('/api/quotes/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id_cotizacion: quote.id_cotizacion,
                              id_quote_status: id,
                              id_tenant: user.id_tenant,
                              id_user: user.id_user,
                            }),
                          });
                          if (!response.ok) throw new Error('Error al actualizar estado');
                          await fetchData();
                          setToast({ message: 'Estado actualizado.', type: 'success' });
                        } catch (error) {
                          setToast({ message: 'Error al actualizar estado.', type: 'error' });
                        }
                      }}
                    />
                  ) : (
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
                      style={{ 
                          backgroundColor: `${quote.estado_color || '#cccccc'}15`, 
                          color: quote.estado_color || '#333',
                          borderColor: `${quote.estado_color || '#cccccc'}40`
                      }}
                    >
                      {quote.estado_icon && <i className={`${quote.estado_icon} mr-1.5`}></i>}
                      {quote.estado_nombre || quote.estado || 'Desconocido'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                    <span className="font-bold text-slate-700">{quote.total}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-start space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(quote); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                      )}
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShareQuoteId(quote.id_cotizacion); setIsShareOpen(true); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Compartir"
                        >
                          <i className="fa-solid fa-user-plus"></i>
                        </button>
                      )}
                      {quote.access_level === 'EDIT' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteQuote(quote.id_cotizacion); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
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

      {/* Filters & Actions Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 items-start justify-start flex-wrap">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por cliente, cotización..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <StatusInterestFilter
               placeholder="Todos los Estados"
               selectedId={statusFilter}
               onChange={setStatusFilter}
               items={quoteStatuses.map(s => {
                 const count = quotes.filter(q => q.id_quote_status?.toString() === s.id_status.toString()).length;
                 return { id: s.id_status.toString(), name: s.name, color: s.color, icon: s.icon, count };
               })}
             />
             {hasActiveFilters && (
               <button
                 onClick={clearAllFilters}
                 className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all flex items-center"
               >
                 <i className="fa-solid fa-rotate-left mr-2 text-xs"></i>
                 Restablecer
               </button>
             )}
         </div>
      </div>

      {/* Table Container aligned with DealsList */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-visible w-full flex flex-col">
        <div style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '350px', overflowY: 'auto', overflowX: 'hidden' }}>
          {renderContent()}
        </div>
        {filteredQuotes.length > 0 && (
          <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span>Mostrando <span className="font-semibold text-slate-700">{filteredQuotes.length}</span> de <span className="font-semibold text-slate-700">{quotes.length}</span> registros</span>
            <span className="text-lg font-bold text-brand-700">Total: ${filteredQuotes.reduce((sum, q) => {
              const val = typeof q.total === 'string' ? parseFloat((q.total as string).replace(/[^0-9.-]+/g, '')) : (q.total as number);
              return sum + (isNaN(val as number) ? 0 : (val as number));
            }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
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
    </div>
  );
};

export default QuotesList;
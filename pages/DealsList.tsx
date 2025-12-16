import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, ClientCompany, ClientContact, User, DealStatus, DealInterest } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';

// Tipo para el ordenamiento
type SortConfig = {
  key: keyof Deal | 'client_company_name' | 'contact_full_name' | 'owner_name' | 'estado_nombre' | 'interes_nombre';
  direction: 'asc' | 'desc';
};

const DealsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- ESTADOS DE DATOS ---
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<DealInterest[]>([]);
  
  // --- ESTADOS DE UI Y FILTROS ---
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string[] }>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
    const [dateFilters, setDateFilters] = useState<{ [key: string]: { start: string; end: string } }>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- ESTADOS DE MODALES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<ClientContact[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // --- ESTADOS COMPARTIR ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDealId, setShareDealId] = useState<string | null>(null);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

    // --- COMPONENTE INTERNO: Dropdown con colores e íconos ---
    const StatusInterestFilter: React.FC<{
        placeholder: string;
        selectedId: string;
        onChange: (val: string) => void;
        items: { id: string; name: string; color?: string; icon?: string; count?: number }[];
    }> = ({ placeholder, selectedId, onChange, items }) => {
        const [open, setOpen] = useState(false);
        const current = items.find(i => i.id === selectedId);
        const containerRef = useRef<HTMLDivElement>(null);

        // Cierra al hacer clic fuera
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
            <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem] lg:min-w-[18rem] max-w-[26rem]">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                >
                    {current ? (
                        <span
                            className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px]"
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
                                    className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px]"
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

    // Componente inline para editar estado/interés desde la tabla
    const InlineBadgeSelector: React.FC<{
        valueId: string;
        items: { id: string; name: string; color?: string; icon?: string }[];
        onSelect: (id: string) => void;
        disabled?: boolean;
    }> = ({ valueId, items, onSelect, disabled }) => {
        const [open, setOpen] = useState(false);
        const [openUpwards, setOpenUpwards] = useState(false);
        const current = items.find(i => i.id === valueId);
        const containerRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (!open) return;
            const handleClickOutside = (e: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setOpen(false);
                }
            };
            const handleKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setOpen(false);
            };
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKey);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleKey);
            };
        }, [open]);

        const handleOpen = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (disabled) return;
            
            // Detectar espacio disponible
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const dropdownHeight = 280; // max-h-64 aprox
                
                setOpenUpwards(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
            }
            setOpen(o => !o);
        };

        return (
            <div ref={containerRef} className="relative inline-flex">
                <button
                    type="button"
                    onClick={handleOpen}
                    disabled={disabled}
                    className={`inline-flex items-center px-2 py-1 rounded-lg border text-[13px] ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-slate-300'}`}
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

                {open && (
                    <div className={`absolute z-30 w-56 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto ${openUpwards ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                        {items.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onSelect(item.id); setOpen(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"
                            >
                                <span
                                    className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px]"
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
            </div>
        );
    };

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [dealsRes, companiesRes, contactsRes, usersRes, dealStatusesRes, interestStatusesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/interests?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
            if (res.status === 404) return [];
            const text = await res.text();
            throw new Error(`Error: ${res.status} - ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const [dealsData, companiesData, contactsData, usersData, statusesData, interestsData] = await Promise.all([
        parseResponse(dealsRes),
        parseResponse(companiesRes),
        parseResponse(contactsRes),
        parseResponse(usersRes),
        parseResponse(dealStatusesRes),
        parseResponse(interestStatusesRes)
      ]);

      setDeals(dealsData);
      setCompanies(companiesData);
      setContacts(contactsData);
      setUsers(usersData);
      setDealStatuses(statusesData);
      setInterestStatuses(interestsData);

    } catch (e: any) {
      console.error("Error cargando datos:", e);
      setToast({ message: 'Error al cargar los tratos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTROS Y ORDENAMIENTO ---
  useEffect(() => {
    if (editingDeal?.id_client_company) {
      setFilteredContacts(contacts.filter(c => c.id_client_company === editingDeal.id_client_company));
    } else {
      setFilteredContacts([]);
    }
  }, [editingDeal?.id_client_company, contacts]);

  const requestSort = (key: SortConfig['key']) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedDeals = useMemo(() => {
    // 1. Filtrar
    let result = deals.filter(deal => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (deal.nombre_trato || '').toLowerCase().includes(searchLower) ||
        (deal.client_company_name || '').toLowerCase().includes(searchLower) ||
        (deal.contact_full_name || '').toLowerCase().includes(searchLower) ||
        (deal.owner_name || '').toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter ? deal.id_deal_status === statusFilter : true;
      const matchesInterest = interestFilter ? deal.id_interest === interestFilter : true;

      // Column filters
      const matchesColumnFilters = Object.entries(columnFilters).every(([col, values]) => {
        if (values.length === 0) return true;
                if (col === 'estado_nombre') return values.includes(deal.estado_nombre || '');
                if (col === 'interes_nombre') return values.includes(deal.interes_nombre || '');
                if (col === 'owner_name') return values.includes(deal.owner_name || '');
        return true;
      });

            // Date range filters
            const matchesDateFilters = Object.entries(dateFilters).every(([col, range]) => {
                if (!range.start && !range.end) return true;
                let dateValue = '';
                if (col === 'created_at') dateValue = deal.created_at || deal.fecha_creacion || '';
                if (col === 'fecha_cierre_esperada') dateValue = deal.fecha_cierre_esperada || '';
                if (!dateValue) return false;
                const onlyDate = dateValue.split('T')[0];
                if (range.start && onlyDate < range.start) return false;
                if (range.end && onlyDate > range.end) return false;
                return true;
            });

            return matchesSearch && matchesStatus && matchesInterest && matchesColumnFilters && matchesDateFilters;
    });

    // 2. Ordenar
    if (sortConfig.key) {
      result.sort((a, b) => {
        // Manejo especial para valores monetarios string "$500.00"
        let aValue: any = a[sortConfig.key as keyof Deal];
        let bValue: any = b[sortConfig.key as keyof Deal];

        if (sortConfig.key === 'valor_trato') {
            aValue = parseFloat(String(aValue).replace(/[^0-9.-]+/g,"")) || 0;
            bValue = parseFloat(String(bValue).replace(/[^0-9.-]+/g,"")) || 0;
        } else {
            aValue = String(aValue || '').toLowerCase();
            bValue = String(bValue || '').toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [deals, searchTerm, statusFilter, interestFilter, sortConfig, columnFilters]);

  // --- HANDLERS (Iguales que antes, simplificados para brevedad) ---
  const toggleColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      if (current.includes(value)) {
        return { ...prev, [column]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [column]: [...current, value] };
      }
    });
  };

    const updateDateFilter = (column: string, field: 'start' | 'end', value: string) => {
        setDateFilters(prev => ({
            ...prev,
            [column]: { ...(prev[column] || { start: '', end: '' }), [field]: value }
        }));
    };

    const clearDateFilter = (column: string) => {
        setDateFilters(prev => ({ ...prev, [column]: { start: '', end: '' } }));
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setInterestFilter('');
        setColumnFilters({});
        setDateFilters({});
    };

    const hasActiveFilters = useMemo(() => {
        const hasColumnFilters = Object.values(columnFilters).some(v => (v || []).length > 0);
        const hasDateFilters = Object.values(dateFilters).some(r => !!(r?.start || r?.end));
        return Boolean(searchTerm || statusFilter || interestFilter || hasColumnFilters || hasDateFilters);
    }, [searchTerm, statusFilter, interestFilter, columnFilters, dateFilters]);

  const getUniqueValues = (column: string): { value: string; label: string; count: number }[] => {
    const values = new Map<string, { value: string; label: string; count: number }>();
    deals.forEach(deal => {
      let val = '';
      let label = '';
      if (column === 'estado_nombre') {
        val = deal.estado_nombre || '';
        label = deal.estado_nombre || '';
      } else if (column === 'interes_nombre') {
        val = deal.interes_nombre || '';
        label = deal.interes_nombre || '';
      } else if (column === 'owner_name') {
        val = deal.owner_name || '';
        label = deal.owner_name || '';
      }
      if (val) {
        const existing = values.get(val);
        values.set(val, { value: val, label, count: (existing?.count || 0) + 1 });
      }
    });
    return Array.from(values.values()).sort((a, b) => b.count - a.count);
  };

  const handleRowClick = (id: string) => navigate(`/deals/${id}`);
  const handleAddNew = () => {
    navigate('/deals/new');
  };
  const handleEdit = (deal: Deal) => {
    const rawValue = typeof deal.valor_trato === 'string' ? parseFloat((deal.valor_trato as string).replace(/[^0-9.-]+/g,"")) : deal.valor_trato;
    setEditingDeal({ ...deal, valor_trato: rawValue });
    setIsEditMode(true);
    setIsModalOpen(true);
  };
  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true, title: 'Eliminar Trato', message: '¿Estás seguro?', isDestructive: true,
      onConfirm: async () => {
        try {
          await fetch(`https://service.computeksa.com/webhook/api/deals/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_trato: id, id_tenant: user?.id_tenant, id_user: user?.id_user }) });
          setToast({ message: 'Eliminado.', type: 'success' });
          fetchData();
        } catch { setToast({ message: 'Error.', type: 'error' }); } finally { setConfirmState(prev => ({...prev, isOpen: false})); }
      }
    });
  };
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal || !user?.id_tenant) return;
    setSubmitting(true);
    const payload = { ...editingDeal, id_tenant: user.id_tenant, id_user: user.id_user, valor_trato: parseFloat(editingDeal.valor_trato as any) || 0 };
    try {
      const url = isEditMode ? `https://service.computeksa.com/webhook/api/deals/update` : `https://service.computeksa.com/webhook/api/deals`;
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setToast({ message: isEditMode ? 'Actualizado.' : 'Creado.', type: 'success' });
      setIsModalOpen(false); fetchData();
    } catch { setToast({ message: 'Error al guardar.', type: 'error' }); } finally { setSubmitting(false); }
  };
  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setEditingDeal(prev => prev ? ({ ...prev, [name]: value, ...(name === 'id_client_company' ? { id_contact: '' } : {}) }) : null);
  };

    const handleInlineUpdate = async (deal: Deal, updates: Partial<Deal>) => {
        if (!user?.id_tenant) return;
        const previousDeal = { ...deal };
        setDeals(prev => prev.map(d => d.id_trato === deal.id_trato ? { ...d, ...updates } : d));

        try {
            // Enviar todos los campos del deal para evitar errores de campos faltantes
            const payload = {
                id_trato: deal.id_trato,
                id_tenant: user.id_tenant,
                id_user: user.id_user,
                nombre_trato: deal.nombre_trato,
                valor_trato: typeof deal.valor_trato === 'string' ? parseFloat(deal.valor_trato.replace(/[^0-9.-]+/g, "")) : deal.valor_trato,
                id_client_company: deal.id_client_company,
                id_contact: deal.id_contact,
                id_deal_status: deal.id_deal_status,
                id_interest: deal.id_interest,
                id_user_owner: deal.id_user_owner || deal.id_user,
                fecha_cierre_esperada: deal.fecha_cierre_esperada,
                descripcion: deal.descripcion,
                ...updates
            };
            const res = await fetch('https://service.computeksa.com/webhook/api/deals/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('No se pudo actualizar');
            setToast({ message: 'Actualizado.', type: 'success' });
        } catch (err) {
            setDeals(prev => prev.map(d => d.id_trato === deal.id_trato ? previousDeal : d));
            setToast({ message: 'Error al actualizar.', type: 'error' });
        }
    };

  // --- SHARE HANDLERS (Iguales que antes) ---
  const openShareModal = (dealId: string) => {
    setShareDealId(dealId);
    const activos = users.filter((u: any) => u.status_user !== 'Inactivo' && u.id_user !== user?.id_user);
    setShareUsers(activos.map(u => ({ id_user: u.id_user, name_user: u.name_user, email_user: u.email_user })));
    setShareTargets([]); setSharePermission('VIEW'); setShareModalOpen(true);
  };
  const toggleShareTarget = (id: string) => setShareTargets(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const handleShareDeal = async (e: any) => {
    e.preventDefault();
    setShareSubmitting(true);
    try {
      await Promise.all(shareTargets.map(t => fetch('https://service.computeksa.com/webhook/api/deals/share', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id_trato: shareDealId, id_user_target: t, id_tenant: user?.id_tenant, permission_level: sharePermission }) })));
      setToast({ message: 'Compartido.', type: 'success' }); setShareModalOpen(false);
    } catch { setToast({ message: 'Error.', type: 'error' }); } finally { setShareSubmitting(false); }
  };

    // Cierra dropdowns de columna al hacer clic fuera
    useEffect(() => {
        if (!openFilterColumn) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-filter-column]')) {
                setOpenFilterColumn(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openFilterColumn]);

    // --- RENDERIZADO TABLA ---
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <i className="fa-solid fa-sort text-slate-300 ml-1 text-xs"></i>;
    return <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-brand-600 ml-1 text-xs`}></i>;
  };

    const renderContent = () => {
        if (loading) return <div className="p-12 text-center text-slate-500"><i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i><p>Cargando tratos...</p></div>;
        if (deals.length === 0) return <div className="p-16 text-center text-slate-500">No hay tratos registrados.</div>;

        return (
                <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left border-collapse" style={{ minWidth: '1200px' }}>
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                    <tr>
                        <th className="px-2 py-3"></th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors min-w-[240px]" onClick={() => requestSort('nombre_trato')}>
                            Trato <SortIcon column="nombre_trato" />
                        </th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('client_company_name')}>
                            Cliente <SortIcon column="client_company_name" />
                        </th>
                        <th className="px-2 sm:px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => requestSort('valor_trato')}>
                            Valor <SortIcon column="valor_trato" />
                        </th>
                        <th data-filter-column className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
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
                                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg w-56 max-h-64 overflow-auto">
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
                        <th data-filter-column className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('interes_nombre')}>
                                    Interés <SortIcon column="interes_nombre" />
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'interes_nombre' ? null : 'interes_nombre'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['interes_nombre'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por Interés"
                                >
                                    <i className="fa-solid fa-filter text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'interes_nombre' && (
                                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg w-56 max-h-64 overflow-auto">
                                    {getUniqueValues('interes_nombre').map(val => (
                                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                                            <input type="checkbox" checked={(columnFilters['interes_nombre'] || []).includes(val.value)} onChange={() => toggleColumnFilter('interes_nombre', val.value)} className="w-4 h-4" />
                                            <span className="flex-1">{val.label}</span>
                                            <span className="text-xs text-slate-400">({val.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </th>
                        <th data-filter-column className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('owner_name')}>
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
                                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg w-56 max-h-64 overflow-auto">
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
                        <th data-filter-column className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('created_at')}>
                                    Creado <SortIcon column="created_at" />
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'created_at' ? null : 'created_at'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(dateFilters['created_at']?.start || dateFilters['created_at']?.end) ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por fecha"
                                >
                                    <i className="fa-solid fa-calendar text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'created_at' && (
                                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64">
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                                            <input type="date" value={dateFilters['created_at']?.start || ''} onChange={(e) => updateDateFilter('created_at', 'start', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                                            <input type="date" value={dateFilters['created_at']?.end || ''} onChange={(e) => updateDateFilter('created_at', 'end', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        {(dateFilters['created_at']?.start || dateFilters['created_at']?.end) && (
                                            <button type="button" onClick={() => clearDateFilter('created_at')} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors">
                                                <i className="fa-solid fa-times mr-1"></i> Limpiar filtro
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </th>
                        <th data-filter-column className="px-2 sm:px-4 py-3 hover:bg-slate-100 transition-colors relative group">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 cursor-pointer" onClick={() => requestSort('fecha_cierre_esperada')}>
                                    Last Update <SortIcon column="fecha_cierre_esperada" />
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'fecha_cierre_esperada' ? null : 'fecha_cierre_esperada'); }}
                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${(dateFilters['fecha_cierre_esperada']?.start || dateFilters['fecha_cierre_esperada']?.end) ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                                    title="Filtrar por fecha"
                                >
                                    <i className="fa-solid fa-calendar text-xs"></i>
                                </button>
                            </div>
                            {openFilterColumn === 'fecha_cierre_esperada' && (
                                <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64">
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                                            <input type="date" value={dateFilters['fecha_cierre_esperada']?.start || ''} onChange={(e) => updateDateFilter('fecha_cierre_esperada', 'start', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                                            <input type="date" value={dateFilters['fecha_cierre_esperada']?.end || ''} onChange={(e) => updateDateFilter('fecha_cierre_esperada', 'end', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                                        </div>
                                        {(dateFilters['fecha_cierre_esperada']?.start || dateFilters['fecha_cierre_esperada']?.end) && (
                                            <button type="button" onClick={() => clearDateFilter('fecha_cierre_esperada')} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors">
                                                <i className="fa-solid fa-times mr-1"></i> Limpiar filtro
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {processedDeals.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                                <i className="fa-solid fa-filter text-2xl mb-2 block text-slate-300"></i>
                                No hay resultados para los filtros aplicados.
                            </td>
                        </tr>
                    ) : (
                    processedDeals.map((deal) => (
                        <tr key={deal.id_trato} onClick={() => handleRowClick(deal.id_trato)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                            
                            {/* 1. Acciones */}
                            <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(deal.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(deal); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">
                                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); openShareModal(deal.id_trato); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Compartir">
                                                <i className="fa-solid fa-user-plus text-xs"></i>
                                            </button>
                                        </>
                                    )}
                                    {(deal.created_by === user?.id_user || user?.rol_user === 'admin') && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(deal.id_trato); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    )}
                                </div>
                            </td>

                            {/* 2. Nombre Trato */}
                            <td className="px-2 sm:px-4 py-2 align-top">
                                <div className="flex flex-col whitespace-normal break-words">
                                    <span className="font-bold text-brand-600 text-sm hover:underline">{deal.nombre_trato}</span>
                                </div>
                            </td>

                            {/* 3. Cliente (Empresa + Contacto) */}
                            <td className="px-2 sm:px-4 py-2 align-top">
                                <div className="flex flex-col whitespace-normal">
                                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                        <i className="fa-solid fa-building text-slate-400 text-xs"></i>
                                        {deal.client_company_name}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <i className="fa-solid fa-user text-slate-400 text-xs"></i>
                                        <span>{deal.contact_full_name}</span>
                                    </div>
                                </div>
                            </td>

                            {/* 4. Valor */}
                            <td className="px-2 sm:px-4 py-2 text-right">
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-sm">
                                    {deal.valor_trato}
                                </span>
                            </td>

                                                        {/* 5. Estado (editable) */}
                                                        <td className="px-2 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                                                <InlineBadgeSelector
                                                                    valueId={deal.id_deal_status}
                                                                    items={dealStatuses.map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
                                                                    disabled={!(deal.access_level === 'EDIT' || user?.rol_user === 'admin')}
                                                                    onSelect={(id) => {
                                                                        if (id === deal.id_deal_status) return;
                                                                        const st = dealStatuses.find(s => s.id_status === id);
                                                                        handleInlineUpdate(deal, {
                                                                            id_deal_status: id,
                                                                            estado_nombre: st?.name,
                                                                            estado_color: st?.color,
                                                                            estado_icon: st?.icon,
                                                                        });
                                                                    }}
                                                                />
                                                        </td>

                                                        {/* 6. Interés (editable) */}
                                                        <td className="px-2 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                                                <InlineBadgeSelector
                                                                    valueId={deal.id_interest}
                                                                    items={interestStatuses.map(i => ({ id: i.id_interest, name: i.name, color: i.color, icon: i.icon }))}
                                                                    disabled={!(deal.access_level === 'EDIT' || user?.rol_user === 'admin')}
                                                                    onSelect={(id) => {
                                                                        if (id === deal.id_interest) return;
                                                                        const it = interestStatuses.find(i => i.id_interest === id);
                                                                        handleInlineUpdate(deal, {
                                                                            id_interest: id,
                                                                            interes_nombre: it?.name,
                                                                            interes_color: it?.color,
                                                                            interes_icon: it?.icon,
                                                                        });
                                                                    }}
                                                                />
                                                        </td>

                            {/* 7. Propietario (Avatar) */}
                            <td className="px-2 sm:px-4 py-2">
                                <div className="flex items-center gap-2" title={deal.owner_name}>
                                    <img 
                                        src={deal.owner_avatar || `https://ui-avatars.com/api/?name=${deal.owner_name}&background=random`} 
                                        alt="Owner" 
                                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover"
                                    />
                                    <span className="text-xs text-slate-600 whitespace-nowrap">{deal.owner_name}</span>
                                </div>
                            </td>

                            {/* 8. Fecha Creación */}
                            <td className="px-2 sm:px-4 py-2">
                                <div className="text-xs text-slate-600 whitespace-nowrap">
                                    <i className="fa-regular fa-calendar-plus text-slate-400 mr-1.5"></i>
                                    {deal.created_at_fmt || deal.fecha_creacion?.split('T')[0] || 'N/A'}
                                </div>
                            </td>

                            {/* 9. Fecha Actualización */}
                            <td className="px-2 sm:px-4 py-2">
                                <div className="text-xs text-slate-600 whitespace-nowrap">
                                    <i className="fa-regular fa-calendar-check text-slate-400 mr-1.5"></i>
                                    {deal.fecha_cierre_esperada?.split('T')[0] || 'N/A'}
                                </div>
                            </td>
                        </tr>
                    ))
                    )}
                </tbody>
            </table>
        </div>
    );
  };

  // ... (El resto del código: Modales, etc. se mantiene igual, ya está actualizado en tu versión anterior)
  // Solo asegúrate de incluir el return final con el layout completo.
    return (
        <div className="w-full mx-auto px-4 md:px-8 lg:px-12 space-y-6 animate-fade-in pb-12">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
        {/* ... Header, Filters ... */}
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tratos</h1>
                <p className="text-slate-500 text-sm mt-1">Gestiona y monitorea tus oportunidades de venta.</p>
            </div>
            <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
                <i className="fa-solid fa-plus mr-2"></i> Nuevo Trato
            </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-4 items-center">
            <div className="relative w-full md:flex-1 min-w-[260px]">
                <span className="absolute left-3 top-2.5 text-slate-400"><i className="fa-solid fa-magnifying-glass"></i></span>
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm" />
            </div>
            <div className="flex items-center gap-2 w-full md:flex-1 flex-wrap justify-end">
                {/* Status Filter (custom dropdown with colors/icons) */}
                <StatusInterestFilter
                  placeholder="Todos los Estados"
                  selectedId={statusFilter}
                  onChange={setStatusFilter}
                  items={dealStatuses.map(s => {
                    const count = deals.filter(d => d.id_deal_status === s.id_status).length;
                    return { id: s.id_status, name: s.name, color: s.color, icon: s.icon, count };
                  })}
                />
                {/* Interest Filter (custom dropdown with colors/icons) */}
                <StatusInterestFilter
                  placeholder="Cualquier Interés"
                  selectedId={interestFilter}
                  onChange={setInterestFilter}
                  items={interestStatuses.map(i => {
                    const count = deals.filter(d => d.id_interest === i.id_interest).length;
                    return { id: i.id_interest, name: i.name, color: i.color, icon: i.icon, count };
                  })}
                />
                                {hasActiveFilters && (
                                        <button
                                                type="button"
                                                onClick={clearAllFilters}
                                                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-2"
                                                title="Restablecer filtros"
                                        >
                                                <i className="fa-solid fa-rotate-left text-xs"></i> Restablecer
                                        </button>
                                )}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] w-full flex flex-col">
            <div className="flex-1">
                {renderContent()}
            </div>
            {processedDeals.length > 0 && (
                <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span>Mostrando <span className="font-semibold text-slate-700">{processedDeals.length}</span> de <span className="font-semibold text-slate-700">{deals.length}</span> registros</span>
                    <span className="text-lg font-bold text-brand-700">Total: ${processedDeals.reduce((sum, d) => {
                        const valor = typeof d.valor_trato === 'string' ? parseFloat(d.valor_trato.replace(/[^0-9.-]+/g, "")) : d.valor_trato;
                        return sum + (isNaN(valor) ? 0 : valor);
                    }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            )}
        </div>
        
        {/* ... Modales Share y Edit (Mantener los que ya tienes, que están bien) ... */}
        {/* NOTA: Asegúrate de incluir el código de los modales aquí antes de cerrar el div principal */}
        {shareModalOpen && shareDealId && (
            <ShareModal entity="deal" id={shareDealId} isOpen={shareModalOpen} onClose={() => { setShareModalOpen(false); setShareDealId(null); }} onShared={() => setToast({ message: 'Trato compartido.', type: 'success' })} />
        )}
        
        {/* IMPORTANTE: Pega aquí el Modal de Crear/Editar Trato que te pasé en la respuesta anterior para que funcione completo */}
        {isModalOpen && editingDeal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
                        <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Trato' : 'Nuevo Trato'}</h2>
                        <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"><i className="fa-solid fa-times"></i></button>
                    </div>
                    <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-6">
                        {/* ... (Contenido del formulario del mensaje anterior) ... */}
                        {/* Si necesitas que te repita el formulario completo dímelo, pero es el mismo de arriba */}
                        
                        {/* Sección 1 */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Información General</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-full">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                                    <input type="text" name="nombre_trato" required value={editingDeal.nombre_trato || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Valor (USD)</label>
                                    <input type="number" name="valor_trato" required value={editingDeal.valor_trato || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" step="0.01" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Cierre</label>
                                    <input type="date" name="fecha_cierre_esperada" value={editingDeal.fecha_cierre_esperada?.split('T')[0] || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" />
                                </div>
                            </div>
                        </div>
                        {/* Sección 2 */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cliente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Empresa</label>
                                    <select name="id_client_company" required value={editingDeal.id_client_company || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500">
                                        <option value="">-- Seleccionar --</option>
                                        {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Contacto</label>
                                    <select name="id_contact" value={editingDeal.id_contact || ''} onChange={handleInputChange} disabled={!editingDeal.id_client_company} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100">
                                        <option value="">-- Seleccionar --</option>
                                        {filteredContacts.map(c => <option key={c.id_contact} value={c.id_contact}>{c.first_name} {c.last_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        {/* Sección 3 */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Clasificación</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                                    <select name="id_deal_status" required value={editingDeal.id_deal_status || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500">
                                        {dealStatuses.map(s => <option key={s.id_status} value={s.id_status}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Interés</label>
                                    <select name="id_interest" required value={editingDeal.id_interest || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500">
                                        {interestStatuses.map(i => <option key={i.id_interest} value={i.id_interest}>{i.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Propietario</label>
                                    <select name="id_user_owner" required value={editingDeal.id_user_owner || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-brand-500">
                                        {users.map(u => <option key={u.id_user} value={u.id_user}>{u.name_user}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        {/* Descripcion */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                            <textarea name="descripcion" value={editingDeal.descripcion || ''} onChange={handleInputChange} rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none"></textarea>
                        </div>
                        {/* Footer */}
                        <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium transition-all disabled:opacity-70">
                                {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default DealsList;
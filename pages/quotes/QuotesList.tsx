import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../../types';
import { apiFetch } from '../../services/apiClient';
import Toast from '../../components/Toast';
import ShareModal from '../../components/ShareModal';
import ConfirmModal from '../../components/ConfirmModal';
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
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Encontrar el índice del estado actual
    const currentIndex = items.findIndex(i => String(i.id) === String(valueId));
    
    // Dividir items en los que van arriba y abajo del estado actual
    const itemsAbove = currentIndex > 0 ? items.slice(0, currentIndex) : [];
    const itemsBelow = currentIndex < items.length - 1 ? items.slice(currentIndex + 1) : [];
    
    // Determinar si mostrar el dropdown hacia arriba o abajo
    const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
    
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Si hay más espacio arriba y el dropdown es grande, mostrarlo arriba
            if (spaceAbove > spaceBelow && spaceBelow < 200) {
                setDropdownPosition('top');
            } else {
                setDropdownPosition('bottom');
            }
        }
    }, [isOpen]);

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
                ref={buttonRef}
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
                <div 
                    className={`absolute z-[100] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownPosition === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'}`}
                >
                    {/* Estados arriba del actual */}
                    {itemsAbove.length > 0 && (
                        <div className="py-1">
                            {itemsAbove.map(item => (
                                <button
                                    key={item.id}
                                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                                    className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-left border-b border-slate-50 last:border-0 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                                        <i className={item.icon || 'fa-solid fa-tag'}></i>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* Estado actual (deshabilitado) */}
                    <div className="py-1 bg-slate-50 border-y border-slate-200">
                        <div className="w-full px-3 py-2.5 flex items-center gap-3 opacity-60 cursor-not-allowed">
                            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${current?.color}20`, color: current?.color }}>
                                <i className={current?.icon || 'fa-solid fa-tag'}></i>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{current?.name || 'S/N'}</span>
                            <i className="fa-solid fa-check text-[10px] ml-auto text-slate-400"></i>
                        </div>
                    </div>
                    
                    {/* Estados abajo del actual */}
                    {itemsBelow.length > 0 && (
                        <div className="py-1">
                            {itemsBelow.map(item => (
                                <button
                                    key={item.id}
                                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                                    className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-left border-b border-slate-50 last:border-0 transition-colors"
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
            )}
        </div>
    );
};

const QuotesList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { users } = useDataCache(); // ⬅️ Obtener usuarios de cache
  
  // --- DATA STATE ---
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [metadata, setMetadata] = useState<{ statuses: QuoteStatus[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // --- TABLE STATE ---
  const [sorting, setSorting] = useState<SortingState>([]);
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
  
  // --- MODALS ---
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState<string | null>(null);
  const [shareQuote, setShareQuote] = useState<Quote | null>(null);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; isDestructive?: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

  // --- FETCH DATA ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    setLoading(true);

    try {
      const quotesRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes`);
      
      if (!quotesRes.ok && quotesRes.status !== 404) throw new Error('Error al cargar cotizaciones');
      
      const text = await quotesRes.text();
      const data = text ? JSON.parse(text) : null;
      
      // Estructura esperada: [{ response: { quotes: [...], metadata: { statuses: [...] } } }]
      if (Array.isArray(data) && data[0]?.response) {
        const response = data[0].response;
        setQuotes(response.quotes || []);
        setMetadata(response.metadata || null);
      } else if (data?.quotes && data?.metadata) {
        // Fallback: { quotes: [...], metadata: {...} }
        setQuotes(data.quotes);
        setMetadata(data.metadata);
      } else if (Array.isArray(data)) {
        // Fallback: array directo
        setQuotes(data);
      }

    } catch (e) {
      console.error('Error al cargar cotizaciones:', e);
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id_tenant, user?.id_user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            const status = (metadata?.statuses || []).find(s => s.id_status === val);
            val = status ? status.name : 'Desconocido';
        }
        if (!val) val = '(Vacío)';
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  // --- ACTIONS HANDLERS ---
  const openShareModal = async (quote: Quote) => {
    setShareQuoteId(quote.id_cotizacion as string);
    setShareQuote(quote);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/share?id_cotizacion=${quote.id_cotizacion}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list
        .map((u: any) => {
          const level = (u.permission_level || '').toUpperCase();
          return {
          id_user: u.id_user,
          name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
          avatar: u.avatar_url || u.avatar || null,
          permission_level: level === 'NONE' ? 'BLOCKED' : level,
          rol_user: u.rol_user
        };
      });
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
    setIsShareOpen(true);
  };

  const handleInlineUpdate = async (quote: Quote, updates: Partial<Quote>) => {
    if (!user?.id_tenant || !user?.id_user) return;
    
    // No permitir cambiar al mismo estado
    if (updates.id_quote_status && updates.id_quote_status === quote.id_quote_status) {
      return;
    }
    
    const isStatusChange = updates.id_quote_status && updates.id_quote_status !== quote.id_quote_status;
    const targetStatus = isStatusChange
      ? (metadata?.statuses || []).find((s) => s.id_status === updates.id_quote_status)
      : undefined;

    const runUpdate = async () => {
      setQuotes(prev => prev.map(q => q.id_cotizacion === quote.id_cotizacion ? { ...q, ...updates } : q));

      try {
          const payload = updates.id_quote_status 
              ? { id_cotizacion: quote.id_cotizacion, id_quote_status: updates.id_quote_status, id_tenant: user.id_tenant, id_user: user.id_user }
              : { ...quote, ...updates, id_tenant: user.id_tenant, id_user: user.id_user };
              
          const endpoint = updates.id_quote_status ? '/api/status/quotes' : '/api/quotes/update';
          
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}${endpoint}`, {
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
            await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes/delete`, {
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
                    const status = (metadata?.statuses || []).find(s => s.id_status === getValue());
                    return renderGroupCell(row, status?.name || 'Desconocido');
                }
                return null;
            }
            return (
                <InlineBadgeSelector 
                    valueId={getValue() as number}
                    items={(metadata?.statuses || []).map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
                    onSelect={(id) => handleInlineUpdate(row.original, { id_quote_status: String(id) })}
                    disabled={!(row.original.access_level === 'EDIT' || user?.rol_user === 'admin')}
                />
            );
        },
        filterFn: (row, id, filterValue: string[]) => {
             const status = (metadata?.statuses || []).find(s => s.id_status === row.getValue(id));
             const statusName = status ? status.name : 'Desconocido';
             return filterValue.length === 0 || filterValue.includes(statusName);
        }
    },
    {
        accessorKey: 'formatted_no_cotizacion',
        header: 'Nro.',
        size: 80,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="font-bold text-brand-600 text-xs">{getValue() as string}</span>
    },
    {
        accessorKey: 'nombre_cotizacion',
        header: 'Nombre',
        size: 200,
        minSize: 150,
        maxSize: 250,
        cell: ({ getValue, row }) => {
            if (row.getIsGrouped()) return null;
            const nombre = getValue() as string;
            return (
                <div className="overflow-hidden" style={{ maxWidth: '250px' }}>
                    <span 
                        className="text-slate-700 text-sm font-medium block truncate" 
                        title={nombre}
                    >
                        {nombre}
                    </span>
                </div>
            );
        }
    },
    {
      accessorKey: 'client_company_name',
      header: 'Cliente',
      size: 220,
      minSize: 180,
      maxSize: 250,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        // CORRECCIÓN PRINCIPAL: Solo renderizar grupo si ESTA columna es la agrupada
        if (row.getIsGrouped()) {
            return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string || 'Sin Cliente') : null;
        }
        const companyName = getValue() as string;
        const contactName = row.original.contact_full_name || 'Sin contacto';
        return (
            <div className="flex flex-col overflow-hidden" style={{ maxWidth: '250px' }}>
                <span className="font-bold text-slate-700 text-xs uppercase truncate" title={companyName}>{companyName}</span>
                <span className="text-[11px] text-slate-400 truncate" title={contactName}>{contactName}</span>
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
        accessorKey: 'collaborators',
        header: 'Colaboradores',
        size: 200,
        enableColumnFilter: true,
        filterFn: (row, id, filterValue: string[]) => {
            const collaborators = (row.original as any).collaborators || [];
            if (filterValue.length === 0) return true;
            return collaborators.some((collab: any) => {
                const user = users.find((u: any) => u.id_user === collab.id);
                const userName = user?.name_user || '';
                return filterValue.some(filter => userName.toLowerCase().includes(filter.toLowerCase()));
            });
        },
        cell: ({ row, column }) => {
            if (row.getIsGrouped()) return null;
            
            const collaborators = (row.original as any).collaborators || [];
            if (collaborators.length === 0) return <span className="text-xs text-slate-400">Sin asignar</span>;
            
            // Ordenar: Creador primero, luego Principal (EDIT), luego Secundario (VIEW)
            const sorted = [...collaborators].sort((a, b) => {
                if (a.is_owner !== b.is_owner) return b.is_owner ? 1 : -1;
                const levelOrder = { EDIT: 1, VIEW: 2, BLOCKED: 3 };
                return (levelOrder[a.access_level as keyof typeof levelOrder] || 3) - (levelOrder[b.access_level as keyof typeof levelOrder] || 3);
            });
            
            return (
                <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {sorted.map((collab: any, idx: number) => {
                        const user = users.find(u => u.id_user === collab.id);
                        const avatarUrl = user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name_user || 'U'}&background=random`;
                        const userName = user?.name_user || 'Usuario';
                        const isOwner = collab.is_owner;
                        const isPrincipal = collab.access_level === 'EDIT' && !isOwner;
                        const isSecondary = collab.access_level === 'VIEW';
                        
                        // Determinar estilo según nivel
                        let borderColor = 'border-slate-200';
                        let badgeIcon = null;
                        let tooltipLevel = '';
                        
                        if (isOwner) {
                            borderColor = 'border-amber-400 shadow-amber-200';
                            badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center"><i className="fa-solid fa-star text-white text-[6px]"></i></div>;
                            tooltipLevel = 'Creador';
                        } else if (isPrincipal) {
                            borderColor = 'border-indigo-400 shadow-indigo-200';
                            badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center"><i className="fa-solid fa-crown text-white text-[6px]"></i></div>;
                            tooltipLevel = 'Principal';
                        } else if (isSecondary) {
                            borderColor = 'border-slate-300';
                            badgeIcon = <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-400 rounded-full flex items-center justify-center"><i className="fa-solid fa-eye text-white text-[6px]"></i></div>;
                            tooltipLevel = 'Secundario';
                        }
                        
                        return (
                            <div
                                key={collab.id || idx}
                                className="relative inline-block group/avatar"
                            >
                                <div className="relative cursor-pointer">
                                    <img 
                                        src={avatarUrl} 
                                        alt={userName}
                                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-125 hover:z-10 shadow-sm ${borderColor}`}
                                    />
                                    {badgeIcon}
                                    {/* Tooltip solo en hover del avatar */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                                        <div className="font-bold">{userName}</div>
                                        <div className={`text-[9px] ${isOwner ? 'text-amber-300' : isPrincipal ? 'text-indigo-300' : 'text-slate-300'}`}>
                                            {tooltipLevel}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }
    },
    {
      accessorKey: 'fecha_emision',
      header: 'Emisión',
      size: 120,
      filterFn: dateRangeFilter,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const fecha = row.original.fecha_emision_fmt || row.original.fecha_emision;
        return <span className="text-xs text-slate-500">{fecha}</span>;
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Creado',
      size: 140,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        // Preferir el campo formateado si existe, si no, formatear localmente
        let fecha = row.original.created_at_fmt;
        if (!fecha && row.original.created_at) {
          const d = new Date(row.original.created_at);
          fecha = d.toLocaleDateString();
        }
        // Si viene con hora desde el backend, extraer solo la fecha
        if (fecha && fecha.includes(' ')) {
          fecha = fecha.split(' ')[0];
        }
        return <span className="text-xs text-slate-500">{fecha}</span>;
      }
    },
    {
      accessorKey: 'days_inactive',
      header: 'Inactivo',
      size: 120,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const days = row.original.days_inactive;
        if (days === undefined || days === null) return <span className="text-xs text-slate-400 italic">N/A</span>;
        
        // Colores según días de inactividad
        let colorClass = 'text-slate-600';
        let bgClass = 'bg-slate-100';
        if (days > 30) {
          colorClass = 'text-red-600';
          bgClass = 'bg-red-50';
        } else if (days > 15) {
          colorClass = 'text-amber-600';
          bgClass = 'bg-amber-50';
        } else if (days > 7) {
          colorClass = 'text-yellow-600';
          bgClass = 'bg-yellow-50';
        } else {
          colorClass = 'text-emerald-600';
          bgClass = 'bg-emerald-50';
        }
        
        return (
          <span className={`text-xs font-bold px-2 py-1 rounded ${bgClass} ${colorClass}`}>
            {days} {days === 1 ? 'día' : 'días'}
          </span>
        );
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
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/app/quotes/edit?id=${q.id_cotizacion}`); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); openShareModal(q); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-user-plus text-[10px]"></i></button>
                        </>
                    )}
                    {canDelete && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id_cotizacion); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    )}
                </div>
            );
        }
    }
  ], [grouping, metadata, users]);

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
                                <input type="date" className="w-full text-xs border rounded p-1" onChange={e => header.column.setFilterValue((old: any) => ({ ...old as any, start: e.target.value }))} />
                                <input type="date" className="w-full text-xs border rounded p-1" onChange={e => header.column.setFilterValue((old: any) => ({ ...old as any, end: e.target.value }))} />
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
                <tr>
                  <td colSpan={columns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <i className="fa-regular fa-file-lines text-4xl text-slate-300"></i>
                      <p className="font-bold text-slate-600">No hay cotizaciones aún</p>
                      <p className="text-sm text-slate-400">Crea tu primera cotización para visualizarla aquí.</p>
                      <button onClick={() => navigate('/app/quotes/new')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all text-sm font-bold">Crear cotización</button>
                    </div>
                  </td>
                </tr>
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

      {confirmState.isOpen && <ConfirmModal {...confirmState} onConfirm={confirmState.onConfirm || (() => {})} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />}
      {isShareOpen && shareQuoteId && (
        <ShareModal 
          entity="quotes" 
          id={shareQuoteId} 
          entityName={shareQuote?.nombre_cotizacion || `Cotización #${shareQuoteId}`}
          creatorName={shareQuote?.created_by_name || ''}
          isOpen={isShareOpen} 
          onClose={() => { setIsShareOpen(false); setShareQuoteId(null); setShareQuote(null); setShareCollaborators([]); }} 
          onShared={() => { 
            setToast({ message: 'Compartido.', type: 'success' }); 
            fetchData(); // Refrescar datos después de cambiar permisos
          }}
          currentCollaborators={shareCollaborators}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default QuotesList;

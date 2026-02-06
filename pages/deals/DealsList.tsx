import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useDealFilters } from '../../contexts/DealFiltersContext';
import { Deal, ClientCompany, DealInterest } from '../../types';
import { apiFetch } from '../../services/apiClient';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import DealEditModal from '../../components/DealEditModal';
import { canUserAction, canEditInline } from '../../utils/permissions';
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

// --- FILTRO PERSONALIZADO PARA RANGO DE FECHAS ---
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  const { start, end } = value as { start: string; end: string };
  const rowDate = row.getValue(columnId) as string;
  if (!rowDate) return false;
  const date = rowDate.split('T')[0];
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

const parseDealValue = (value: Deal['valor_trato']) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatDealValue = (value: Deal['valor_trato']) => {
  if (typeof value === 'string') return value;
  const amount = parseDealValue(value);
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const [date, time = ''] = normalized.split('T');
  return `${date}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

// --- HELPER PARA CELDA DE GRUPO (Actualizado) ---
const renderGroupCell = (row: any, label: string) => (
  <div className="flex items-center gap-3">
    {/* Ícono Chevron en lugar de botón */}
    <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
    
    <span className="font-bold text-slate-700 uppercase tracking-tight">{label || 'No asignado'}</span>
    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
  </div>
);

const InlineBadgeSelector: React.FC<{
  valueId: string;
  items: { id: string; name: string; color?: string; icon?: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const current = items.find(i => i.id === valueId);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Encontrar el índice del estado actual
  const currentIndex = items.findIndex(i => i.id === valueId);
  
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
        className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${disabled ? 'cursor-default opacity-70' : 'hover:bg-white active:scale-95'}`}
        style={{ backgroundColor: `${current?.color}15`, color: current?.color, borderColor: `${current?.color}30` }}
      >
        {current?.icon && <i className={current.icon}></i>}
        {current?.name || 'S/N'}
        {!disabled && <i className="fa-solid fa-chevron-down opacity-50 text-[8px]"></i>}
      </button>
      {isOpen && (
        <div 
          ref={dropdownRef}
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[100] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownPosition === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'}`}
        >
          <div className="max-h-64 overflow-y-auto">
          {/* Estados arriba del actual */}
          {itemsAbove.length > 0 && (
            <div className="py-0.5">
              {itemsAbove.map(item => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                  className="w-full px-2 py-1 hover:bg-slate-50 flex items-center gap-1.5 text-left border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                    <i className={`${item.icon || 'fa-solid fa-tag'} text-[9px]`}></i>
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Estado actual (deshabilitado) */}
          <div className="py-0.5 bg-slate-50 border-y border-slate-200">
            <div className="w-full px-2 py-1 flex items-center gap-1.5 opacity-60 cursor-not-allowed">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${current?.color}20`, color: current?.color }}>
                <i className={`${current?.icon || 'fa-solid fa-tag'} text-[9px]`}></i>
              </div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{current?.name || 'S/N'}</span>
              <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400"></i>
            </div>
          </div>
          
          {/* Estados abajo del actual */}
          {itemsBelow.length > 0 && (
            <div className="py-0.5">
              {itemsBelow.map(item => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                  className="w-full px-2 py-1 hover:bg-slate-50 flex items-center gap-1.5 text-left border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                    <i className={`${item.icon || 'fa-solid fa-tag'} text-[9px]`}></i>
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

const DealsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dealStatuses: cachedDealStatuses, dealInterests: cachedDealInterests, users } = useDataCache();
  const { setDeals: setContextDeals, setDealStatuses: setContextDealStatuses } = useDealFilters();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('dealsListGrouping');
    return saved ? JSON.parse(saved) : [];
  });
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const saved = localStorage.getItem('dealsListExpanded');
    return saved ? JSON.parse(saved) : {};
  });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<Deal> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDealForEdit, setSelectedDealForEdit] = useState<Deal | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDealId, setShareDealId] = useState<string | null>(null);
  const [shareDealName, setShareDealName] = useState<string>('');
  const [shareDealCreator, setShareDealCreator] = useState<string>('');
  const [shareDealCollaborators, setShareDealCollaborators] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

  const fetchData = useCallback(async (force = false) => {
    if (!user?.id_tenant || !user?.id_user) return;

    const cacheKey = `deals_list_cache_${user.id_user}`;
    const now = Date.now();
    const cacheTtlMs = 2 * 60 * 1000; // 2 minutos

    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.timestamp && now - parsed.timestamp < cacheTtlMs && Array.isArray(parsed?.deals)) {
            setDeals(parsed.deals);
            setContextDeals(parsed.deals);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }
    }

    setLoading(true);
    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`);
      if (!response.ok) throw new Error('No se pudo cargar tratos');

      const text = await response.text();
      const raw = text ? JSON.parse(text) : {};
      
      // El backend devuelve: [{ response: { tratos: [...] } }] o { response: { tratos: [...] } }
      const payload = Array.isArray(raw) ? (raw[0]?.response ?? raw[0]?.data ?? raw[0] ?? {}) : (raw.response ?? raw.data ?? raw);

      const normalizeDeals = (list: any[] = []) => Array.isArray(list)
        ? list.map(d => ({
              id_trato: d.id_trato,
              id_tenant: user.id_tenant,
              id_user_owner: d.id_owner ?? d.id_user_owner,
              id_user: d.id_owner ?? d.id_user,
              id_client_company: d.id_client_company ?? d.empresa_id ?? d.id_empresa ?? '',
              id_contact: d.id_contact ?? d.contacto_id ?? d.id_contacto ?? '',
              id_deal_status: d.estado_id ?? d.id_deal_status ?? d.id_estado ?? '',
              id_interest: d.interes_id ?? d.id_interest ?? d.id_interes ?? '',
              id_channel: d.id_channel ?? d.canal_id ?? d.id_canal,
              nombre_trato: d.nombre_trato,
              valor_trato: d.valor_numeric ?? d.valor_trato ?? 0,
              descripcion: d.descripcion,
              fecha_cierre_esperada: d.fecha_cierre_esperada,
              client_company_name: d.empresa_nombre ?? d.client_company_name,
              contact_full_name: d.contacto_nombre ?? d.contact_full_name,
              contact_email: d.contact_email,
              collaborators: d.collaborators || [],
              estado_nombre: d.estado_nombre,
              estado_color: d.estado_color,
              estado_categoria: d.estado_categoria,
              estado_icon: d.estado_icon,
              interes_nombre: d.interes_nombre,
              interes_color: d.interes_color,
              interes_icon: d.interes_icon,
              created_at: d.created_at ?? d.fecha_creacion,
              updated_at: d.updated_at ?? d.fecha_actualizacion,
              access_level: d.access_level ?? 'VIEW',
            }))
        : [];

      const dealsFromApi = normalizeDeals(payload.tratos);
      
      // Debug: ver los datos que llegan
      console.log('Raw payload.tratos:', payload.tratos);
      console.log('Normalized deals:', dealsFromApi);
      
      setDeals(dealsFromApi);
      setContextDeals(dealsFromApi);
      localStorage.setItem(cacheKey, JSON.stringify({ deals: dealsFromApi, timestamp: now }));
    } catch (e) { setToast({ message: 'Error de conexión', type: 'error' }); }
    finally { setLoading(false); }
  }, [user, setContextDeals]);

  const openShareModal = async (deal: Deal) => {
    setShareDealId(deal.id_trato);
    setShareDealName(deal.nombre_trato || '');
    setShareDealCreator(deal.owner_name || '');
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${deal.id_trato}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list.map((u: any) => {
        const level = (u.permission_level || '').toUpperCase();
        return {
          id_user: u.id_user,
          name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
          avatar: u.avatar_url || u.avatar || null,
          permission_level: level === 'NONE' ? 'BLOCKED' : level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        };
      });
      setShareDealCollaborators(mapped);
    } catch {
      setShareDealCollaborators([]);
    }
    setShareModalOpen(true);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGroupingChange = (newGrouping: string[]) => {
    setGrouping(newGrouping);
    localStorage.setItem('dealsListGrouping', JSON.stringify(newGrouping));
    
    if (newGrouping.length > 0) {
      const groupByColumn = newGrouping[0];
      const allExpanded: ExpandedState = {};
      
      deals.forEach((deal) => {
        const groupValue = (deal as any)[groupByColumn];
        if (groupValue !== null && groupValue !== undefined) {
          allExpanded[String(groupValue)] = true;
        }
      });
      
      setExpanded(allExpanded);
      localStorage.setItem('dealsListExpanded', JSON.stringify(allExpanded));
    } else {
      setExpanded({});
      localStorage.setItem('dealsListExpanded', JSON.stringify({}));
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setActiveFilterMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Función para obtener valores facetados con contadores
  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    deals.forEach(deal => {
      // Manejo especial para collaborators (array de objetos)
      if (columnId === 'collaborators') {
        const collaborators = (deal as any).collaborators || [];
        if (collaborators.length === 0) {
          counts.set('Sin asignar', (counts.get('Sin asignar') || 0) + 1);
        } else {
          collaborators.forEach((collab: any) => {
            const user = users.find((u: any) => u.id_user === collab.id);
            const userName = user?.name_user || 'Usuario';
            counts.set(userName, (counts.get(userName) || 0) + 1);
          });
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      }
      
      const val = (deal as any)[columnId] || '(Vacío)';
      counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  const handleEdit = (deal: Deal) => {
    setSelectedDealForEdit(deal);
    setIsEditModalOpen(true);
  };

  const handleEditModalSuccess = (updatedDeal: Deal) => {
    setToast({ message: 'Trato actualizado exitosamente.', type: 'success' });
    setIsEditModalOpen(false);
    setSelectedDealForEdit(null);
    fetchData(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...editingDeal,
        valor_trato: parseDealValue(editingDeal?.valor_trato ?? 0),
        id_tenant: user?.id_tenant,
        id_user: user?.id_user
      };
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/${isEditMode ? 'update' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) { setToast({ message: 'Guardado con éxito', type: 'success' }); setIsModalOpen(false); fetchData(true); }
    } catch { setToast({ message: 'Error al procesar', type: 'error' }); }
    finally { setSubmitting(false); }
  };

  const handleInlineUpdate = async (deal: Deal, updates: Partial<Deal>) => {
    if (!user?.id_tenant || !user?.id_user) return;

    // Prevenir cambio al mismo estado o interés
    if (updates.id_deal_status && updates.id_deal_status === deal.id_deal_status) {
      return;
    }
    if (updates.id_interest && updates.id_interest === deal.id_interest) {
      return;
    }

    const isStatusChange = updates.id_deal_status && updates.id_deal_status !== deal.id_deal_status;
    const isInterestChange = updates.id_interest && updates.id_interest !== deal.id_interest;
    const targetStatus = isStatusChange
      ? cachedDealStatuses.find((s) => s.id_status === updates.id_deal_status)
      : undefined;

    const runUpdate = async () => {
      try {
        if (isStatusChange) {
          const payload = {
            id_trato: deal.id_trato,
            id_deal_status: updates.id_deal_status,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
          };
          console.log('DEBUG: Enviando payload a /api/status/deals:', payload);
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const responseText = await res.text();
          console.log('DEBUG: Respuesta del servidor:', responseText);
          if (!res.ok) throw new Error('No se pudo actualizar el estado del trato');
        } else if (isInterestChange) {
          const payload = {
            ...deal,
            ...updates,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
          };
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/v1/deals/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error('No se pudo actualizar el interés del trato');
        } else {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...deal, ...updates, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
        }
        fetchData(true);
        setToast({ message: 'Actualizado.', type: 'success' });
      } catch (e) {
        console.error(e);
        setToast({ message: 'Error al actualizar', type: 'error' });
      }
    };

    if (isStatusChange) {
      const isLostStatus = targetStatus?.status_category === 'LOST';
      setConfirmState({
        isOpen: true,
        title: isLostStatus ? 'Marcar Trato como Perdido' : 'Confirmar Cambio de Estado',
        message: isLostStatus 
          ? 'Esto marcará todas las cotizaciones asociadas como Perdidas. ¿Deseas continuar?'
          : `¿Estás seguro de cambiar el estado a "${targetStatus?.name}"?`,
        isDestructive: isLostStatus,
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
      isOpen: true, title: 'Eliminar Trato', message: '¿Estás seguro? Esta acción es irreversible.', isDestructive: true,
      onConfirm: async () => {
        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_trato: id, id_tenant: user?.id_tenant, id_user: user?.id_user })
        });
        fetchData(true); setConfirmState(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const columns = useMemo<ColumnDef<Deal>[]>(() => [
    {
      accessorKey: 'estado_nombre',
      header: 'Estado',
      size: 180,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return <InlineBadgeSelector valueId={row.original.id_deal_status || ''} items={cachedDealStatuses.map(s => ({ ...s, id: s.id_status }))} onSelect={id => handleInlineUpdate(row.original, { id_deal_status: id })} disabled={!canEditInline(user, row.original)} />;
      }
    },
    {
      accessorKey: 'nombre_trato',
      header: 'Nombre del Trato',
      size: 250,
      minSize: 150,
      maxSize: 300,
      cell: ({ getValue, row }) => {
        if (row.getIsGrouped()) return null;
        const nombre = getValue() as string;
        return (
          <div className="overflow-hidden" style={{ maxWidth: '300px' }}>
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
      size: 200,
      minSize: 150,
      maxSize: 250,
      enableColumnFilter: true,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
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
      accessorKey: 'valor_trato',
      header: 'Valor',
      size: 130,
      enableColumnFilter: false,
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) return null;
        const val = getValue() as Deal['valor_trato'];
        return <div className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 inline-block font-mono font-black text-slate-700 text-[11px]">{formatDealValue(val)}</div>;
      }
    },
    {
      accessorKey: 'interes_nombre',
      header: 'Interés',
      size: 160,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return <InlineBadgeSelector valueId={row.original.id_interest || ''} items={cachedDealInterests.map(i => ({ ...i, id: i.id_interest }))} onSelect={id => handleInlineUpdate(row.original, { id_interest: id })} disabled={!canEditInline(user, row.original)} />;
      }
    },
    {
      accessorKey: 'collaborators',
      accessorFn: (row) => {
        const collaborators = (row as any).collaborators || [];
        return collaborators.map((collab: any) => {
          const user = users.find((u: any) => u.id_user === collab.id);
          return user?.name_user || '';
        }).join(', ');
      },
      header: 'Colaboradores',
      size: 200,
      enableColumnFilter: true,
      enableGrouping: true,
      filterFn: (row, id, filterValue: string[]) => {
        const collaborators = (row.original as any).collaborators || [];
        if (filterValue.length === 0) return true;
        return collaborators.some((collab: any) => {
          const user = users.find((u: any) => u.id_user === collab.id);
          const userName = user?.name_user || '';
          return filterValue.some(filter => userName.toLowerCase().includes(filter.toLowerCase()));
        });
      },
      cell: ({ row, column, getValue }) => {
        if (row.getIsGrouped()) {
          return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string || 'Sin Colaboradores') : null;
        }
        
        const collaborators = (row.original as any).collaborators || [];
        if (collaborators.length === 0) return <span className="text-xs text-slate-400">Sin asignar</span>;
        
        // Ordenar: Creador primero, luego Principal (EDIT), luego Secundario (VIEW)
        const sorted = [...collaborators].sort((a: any, b: any) => {
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
                      className={`w-7 h-7 rounded-full border-2 ${borderColor} transition-all`}
                      alt={userName}
                    />
                    {badgeIcon}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="font-bold">{userName}</div>
                    <div className="text-slate-300">{tooltipLevel}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Creado',
      size: 150,
      filterFn: dateRangeFilter,
      cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-[12px] text-slate-600">{formatDateTime(getValue() as string)}</span>
    },
    {
      accessorKey: 'updated_at',
      header: 'Actualizado',
      size: 150,
      filterFn: dateRangeFilter,
      cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-[12px] text-slate-600">{formatDateTime(getValue() as string)}</span>
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 120,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const deal = row.original;
        const canEdit = canUserAction(user, deal, 'edit');
        const canDelete = canUserAction(user, deal, 'delete');
        const canShare = canUserAction(user, deal, 'share');
        
        return (
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <button onClick={(e) => { e.stopPropagation(); handleEdit(deal); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
            )}
            {canShare && (
              <button onClick={(e) => { e.stopPropagation(); openShareModal(deal); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-user-plus text-[10px]"></i></button>
            )}
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(deal.id_trato); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
            )}
          </div>
        );
      }
    }
  ], [cachedDealStatuses, cachedDealInterests, grouping]);

  const table = useReactTable({
    data: deals, columns, state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination },
    onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, onGlobalFilterChange: setGlobalFilter, onGroupingChange: setGrouping, 
    onExpandedChange: (updater) => {
      setExpanded((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('dealsListExpanded', JSON.stringify(next));
        return next;
      });
    }, 
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), getGroupedRowModel: getGroupedRowModel(), getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => {
      if ('id_trato' in row) return row.id_trato as string;
      if ('id' in row) return row.id as string;
      return '';
    }
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const totalFiltered = useMemo(() => filteredRows.reduce((s, r) => s + (r.getIsGrouped() ? 0 : parseDealValue(r.original.valor_trato)), 0), [filteredRows]);

  return (
    <div className="flex flex-col h-[calc(100vh-58px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans text-slate-700">
      
      {/* TOOLBAR RESPONSIVO MEJORADO */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3">

        {/* 1. BUSCADOR */}
        {/* Mobile/Tablet: Order 3 (Abajo del todo), Width 100%. 
            Desktop (lg): Order 1 (Izquierda), flex-1 (Ocupa el espacio disponible). */}
        <div className="relative order-3 lg:order-1 w-full lg:flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Buscar trato..." className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm" />
        </div>
        
        {/* 2. FILTROS */}
        {/* Mobile/Tablet: Order 2. 
            Desktop: Order 2. lg:w-auto (Se ajusta al contenido, no crece). */}
        <div className="order-2 lg:order-2 w-full lg:w-auto flex items-center justify-start lg:justify-center flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm min-w-[200px]">
            <span className="text-[11px] font-black text-slate-400 uppercase px-2 whitespace-nowrap">Agrupar por:</span>
            <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'estado_nombre', label: 'Estado', icon: 'fa-list-check' },
                  { id: 'interes_nombre', label: 'Interés', icon: 'fa-star' },
                  { id: 'collaborators', label: 'Colaboradores', icon: 'fa-user-group' },
                  { id: 'client_company_name', label: 'Empresa', icon: 'fa-building' }
                ].map(opt => (
                  <button key={opt.id} onClick={() => handleGroupingChange(grouping.includes(opt.id) ? [] : [opt.id])} className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${grouping.includes(opt.id) ? 'bg-brand-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className={`fa-solid ${opt.icon} text-[11px]`}></i> {opt.label}
                  </button>
                ))}
            </div>
        </div>

        {/* 3. BOTÓN AÑADIR */}
        {/* Mobile/Tablet: Order 1 (Arriba). Desktop: Order 3 (Derecha) */}
        <button onClick={() => navigate('/app/deals/new')} className="order-1 lg:order-3 w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all flex items-center justify-center gap-2">
            <i className="fa-solid fa-plus"></i> Nuevo Trato
        </button>
      </div>
      {/* FIN TOOLBAR RESPONSIVO */}

      <div className="flex-1 overflow-auto relative bg-slate-50/10">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40 shadow-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const isDate = ['created_at', 'updated_at'].includes(header.column.id);
                  
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
                        <div 
                          ref={filterMenuRef} 
                          onMouseLeave={() => setActiveFilterMenu(null)}
                          className="absolute top-full left-0 mt-1 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-3 animate-in fade-in slide-in-from-top-1"
                        >
                          {isDate ? (
                            <div className="px-4 space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rango de fechas</span>
                                <div>
                                    <label className="text-[9px] text-slate-400 uppercase font-bold">Desde:</label>
                                    <input type="date" className="w-full text-xs border rounded p-1" onChange={e => {
                                        const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                        header.column.setFilterValue({ ...val, start: e.target.value });
                                    }} />
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-400 uppercase font-bold">Hasta:</label>
                                    <input type="date" className="w-full text-xs border rounded p-1" onChange={e => {
                                        const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                        header.column.setFilterValue({ ...val, end: e.target.value });
                                    }} />
                                </div>
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto px-1">
                                {getFacetedValues(header.column.id).map(([val, count]) => {
                                    const activeValues = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                                    const isChecked = activeValues.includes(val);
                                    return (
                                        <label key={val} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-brand-600 border-brand-600 shadow-sm' : 'bg-white border-slate-300'}`}>
                                                    {isChecked && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                                </div>
                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{val}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-600">({count})</span>
                                            <input type="checkbox" className="hidden" checked={isChecked} onChange={() => {
                                                const next = isChecked ? activeValues.filter(v => v !== val) : [...activeValues, val];
                                                header.column.setFilterValue(next.length ? next : undefined);
                                            }} />
                                        </label>
                                    );
                                })}
                            </div>
                          )}
                          {isFiltered && (
                            <div className="mt-2 pt-2 border-t px-3 text-center">
                                <button onClick={() => header.column.setFilterValue(undefined)} className="text-[10px] font-black text-red-500 hover:underline uppercase">Limpiar Filtro</button>
                            </div>
                          )}
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
                <tr><td colSpan={columns.length} className="py-24 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-3"></i><p className="text-slate-400 text-sm font-medium">Cargando tratos...</p></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <i className="fa-regular fa-handshake text-4xl text-slate-300"></i>
                      <p className="font-bold text-slate-600">No hay tratos aún</p>
                      <p className="text-sm text-slate-400">Crea tu primer trato para visualizarlo aquí.</p>
                      <button onClick={() => navigate('/app/deals/new')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all text-sm font-bold">Crear trato</button>
                    </div>
                  </td>
                </tr>
            ) : table.getRowModel().rows.map(row => {
                const isGrouped = row.getIsGrouped();
                const handleRowClick = () => {
                    if (isGrouped) row.toggleExpanded();
                    else navigate(`/app/deals/${row.original.id_trato}`);
                };

                return (
                    <tr 
                        key={row.id} 
                        onClick={handleRowClick}
                        className={`
                            ${isGrouped 
                                ? 'bg-slate-50/80 border-l-4 border-l-brand-500 cursor-pointer font-bold' 
                                : 'hover:bg-blue-50/30 cursor-pointer group'} 
                            border-b border-slate-100 transition-colors
                        `}
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

      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <span>{deals.length} REGISTROS</span>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-brand-600">
                <span className="text-slate-400">VALOR TOTAL:</span> {totalFiltered.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black tracking-normal">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
      </div>

      {isModalOpen && editingDeal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEditMode ? 'bg-brand-100 text-brand-600' : 'bg-emerald-100 text-emerald-600'}`}><i className={`fa-solid ${isEditMode ? 'fa-pen-to-square' : 'fa-plus-circle'}`}></i></div>
                {isEditMode ? 'Editar Trato' : 'Nuevo Trato'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre del Trato</label>
                        <input required value={editingDeal.nombre_trato || ''} onChange={e => setEditingDeal({...editingDeal, nombre_trato: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Empresa</label>
                        <select required value={editingDeal.id_client_company || ''} onChange={e => setEditingDeal({...editingDeal, id_client_company: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500">
                            <option value="">Selecciona empresa...</option>
                            {/* Companies removed - use cached data if needed */}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor</label>
                        <input
                          type="number"
                          required
                          value={editingDeal.valor_trato ?? ''}
                          onChange={e => {
                            const raw = e.target.value;
                            setEditingDeal(prev => ({ ...prev, valor_trato: raw === '' ? '' : parseDealValue(raw) }));
                          }}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estado</label>
                        <div className="grid grid-cols-2 gap-2">
                            {cachedDealStatuses.map((s: any) => (
                                <button key={s.id_status} type="button" onClick={() => setEditingDeal({...editingDeal, id_deal_status: s.id_status})} className={`px-3 py-2 rounded-xl border text-[10px] font-bold flex items-center gap-2 transition-all ${editingDeal.id_deal_status === s.id_status ? 'ring-2 ring-brand-500 border-transparent shadow-sm' : 'border-slate-100 hover:bg-slate-50 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                                    <i className={s.icon}></i> {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Interés</label>
                        <div className="grid grid-cols-2 gap-2">
                            {cachedDealInterests.map((i: any) => (
                                <button key={i.id_interest} type="button" onClick={() => setEditingDeal({...editingDeal, id_interest: i.id_interest})} className={`px-3 py-2 rounded-xl border text-[10px] font-bold flex items-center gap-2 transition-all ${editingDeal.id_interest === i.id_interest ? 'ring-2 ring-brand-500 border-transparent shadow-sm' : 'border-slate-100 hover:bg-slate-50 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: `${i.color}15`, color: i.color }}>
                                    <i className={i.icon}></i> {i.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>} Guardar Trato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shareModalOpen && shareDealId && (
        <ShareModal entity="deal" id={shareDealId} entityName={shareDealName || `Trato #${shareDealId}`} creatorName={shareDealCreator} isOpen={shareModalOpen} onClose={() => { setShareModalOpen(false); setShareDealId(null); setShareDealName(''); setShareDealCreator(''); setShareDealCollaborators([]); }} onShared={() => { setToast({ message: 'Asignaciones actualizadas.', type: 'success' }); fetchData(true); }} currentCollaborators={shareDealCollaborators} />
      )}

      {/* Deal Edit Modal - creation-style modal for editing */}
      {selectedDealForEdit && (
        <DealEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDealForEdit(null);
          }}
          initialData={selectedDealForEdit}
          onSuccess={handleEditModalSuccess}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(p => ({ ...p, isOpen: false }))} />
    </div>
  );
};

export default DealsList;

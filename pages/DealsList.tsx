import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDealFilters } from '../contexts/DealFiltersContext';
import { Deal, ClientCompany, DealInterest } from '../types';
import { apiFetch } from '../services/apiClient';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';
import DealEditModal from '../components/DealEditModal';
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
        className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tight transition-all ${disabled ? 'cursor-default opacity-70' : 'hover:bg-white active:scale-95'}`}
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

const DealsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dealStatuses, setDeals: setContextDeals, setDealStatuses: setContextDealStatuses } = useDealFilters();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [interestStatuses, setInterestStatuses] = useState<DealInterest[]>([]);
  const [loading, setLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
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
  const [submitting, setSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    try {
      const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals`);
      if (!response.ok) throw new Error('No se pudo cargar tratos');

      const text = await response.text();
      const raw = text ? JSON.parse(text) : {};
      const payload = Array.isArray(raw) ? (raw[0]?.data ?? raw[0] ?? {}) : (raw.data ?? raw);

      const normalizeStatuses = (list: any[] = []) => Array.isArray(list)
        ? list.map(s => ({
            id_status: s.id_status,
            name: s.name,
            color: s.color,
            icon: s.icon,
            status_category: s.status_category,
            status_order: s.status_order,
          }))
        : [];

      const normalizeInterests = (list: any[] = []) => Array.isArray(list)
        ? list.map(i => ({
            id_interest: i.id_interest,
            name: i.name,
            color: i.color,
            icon: i.icon,
            status_order: i.status_order,
            id_tenant: user.id_tenant,
          }))
        : [];

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
              owner_name: d.owner_name,
              owner_avatar: d.owner_avatar,
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
      const statusList = normalizeStatuses(payload.config_estados);
      const interestsList = normalizeInterests(payload.config_intereses);

      setContextDealStatuses(statusList);
      setInterestStatuses(interestsList);
      setDeals(dealsFromApi);
      setContextDeals(dealsFromApi);
    } catch (e) { setToast({ message: 'Error de conexión', type: 'error' }); }
    finally { setLoading(false); }
  }, [user, setContextDeals, setContextDealStatuses]);

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
    fetchData();
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
      if (res.ok) { setToast({ message: 'Guardado con éxito', type: 'success' }); setIsModalOpen(false); fetchData(); }
    } catch { setToast({ message: 'Error al procesar', type: 'error' }); }
    finally { setSubmitting(false); }
  };

  const handleInlineUpdate = async (deal: Deal, updates: Partial<Deal>) => {
    if (!user?.id_tenant || !user?.id_user) return;

    const isStatusChange = updates.id_deal_status && updates.id_deal_status !== deal.id_deal_status;
    const targetStatus = isStatusChange
      ? dealStatuses.find((s) => s.id_status === updates.id_deal_status)
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
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error('No se pudo actualizar el estado del trato');
        } else {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...deal, ...updates, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
        }
        fetchData();
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
        fetchData(); setConfirmState(p => ({ ...p, isOpen: false }));
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
        return <InlineBadgeSelector valueId={row.original.id_deal_status} items={dealStatuses.map(s => ({ ...s, id: s.id_status }))} onSelect={id => handleInlineUpdate(row.original, { id_deal_status: id })} disabled={row.original.access_level !== 'EDIT'} />;
      }
    },
    {
      accessorKey: 'nombre_trato',
      header: 'Trato',
      size: 250,
      cell: ({ row }) => row.getIsGrouped() ? null : <span className="font-bold text-slate-800 text-sm">{row.original.nombre_trato}</span>
    },
    {
      accessorKey: 'client_company_name',
      header: 'Empresa',
      size: 200,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return (
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-slate-700 uppercase leading-tight">{getValue() as string}</span>
          <span className="text-[11px] text-slate-400">{row.original.contact_full_name}</span>
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
        return <InlineBadgeSelector valueId={row.original.id_interest} items={interestStatuses.map(i => ({ ...i, id: i.id_interest }))} onSelect={id => handleInlineUpdate(row.original, { id_interest: id })} disabled={row.original.access_level !== 'EDIT'} />;
      }
    },
    {
      accessorKey: 'owner_name',
      header: 'Owner',
      size: 150,
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return (
        <div className="flex items-center gap-2">
          <img src={(row.original as any).owner_avatar || `https://ui-avatars.com/api/?name=${getValue()}`} className="w-6 h-6 rounded-full border" alt="" />
          <span className="text-[11px] text-slate-600 font-bold">{getValue() as string}</span>
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
      cell: ({ row }) => row.getIsGrouped() ? null : (
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
          <button onClick={(e) => { e.stopPropagation(); setShareDealId(row.original.id_trato); setShareModalOpen(true); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-user-plus text-[10px]"></i></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id_trato); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
        </div>
      )
    }
  ], [dealStatuses, interestStatuses, grouping]);

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
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans text-slate-700">
      
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
                  { id: 'owner_name', label: 'Owner', icon: 'fa-user-tie' },
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
                        <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-3 animate-in fade-in slide-in-from-top-1">
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

      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest">
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
                            {companies.map(c => <option key={c.id_client_company} value={c.id_client_company}>{c.name_company}</option>)}
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
                            {dealStatuses.map(s => (
                                <button key={s.id_status} type="button" onClick={() => setEditingDeal({...editingDeal, id_deal_status: s.id_status})} className={`px-3 py-2 rounded-xl border text-[10px] font-bold flex items-center gap-2 transition-all ${editingDeal.id_deal_status === s.id_status ? 'ring-2 ring-brand-500 border-transparent shadow-sm' : 'border-slate-100 hover:bg-slate-50 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                                    <i className={s.icon}></i> {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Interés</label>
                        <div className="grid grid-cols-2 gap-2">
                            {interestStatuses.map(i => (
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
        <ShareModal entity="deal" id={shareDealId} isOpen={shareModalOpen} onClose={() => { setShareModalOpen(false); setShareDealId(null); }} onShared={() => fetchData()} />
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

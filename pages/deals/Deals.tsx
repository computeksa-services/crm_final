import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useDealFilters } from '../../contexts/DealFiltersContext';
import { Deal, Quote } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG } from '../../services/gatewayConfig';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import SelectWinningQuoteModal from '../../components/SelectWinningQuoteModal';
import DealEditModal from '../../components/DealEditModal';
import DealsKanban from './DealsKanban';
import DealsTable, { DealsTableHandle } from './DealsTable';
import DealsListView from './DealsListView';
import {
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ExpandedState,
} from '@tanstack/react-table';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GROUP_OPTIONS = [
  { id: 'client_company_name', label: 'Cliente',  icon: 'fa-building'   },
  { id: 'estado_nombre',       label: 'Estado',   icon: 'fa-list-check' },
  { id: 'interes_nombre',      label: 'Interés',  icon: 'fa-star'       },
];

const VIEW_OPTIONS = [
  { id: 'table',  label: 'Tabla',  icon: 'fa-table-cells' },
  { id: 'list',   label: 'Lista',  icon: 'fa-list'        },
  { id: 'kanban', label: 'Kanban', icon: 'fa-columns'     },
] as const;

// ─── TOOLBAR ─────────────────────────────────────────────────────────────────
const ToolbarViewMenu: React.FC<{
  grouping: string[];
  onGroupingChange: (g: string[]) => void;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  onGlobalFilterChange: (v: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onNew: () => void;
  onClearFilters: () => void;
  viewMode: 'table' | 'list' | 'kanban';
  onViewModeChange: (mode: 'table' | 'list' | 'kanban') => void;
}> = ({
  grouping, onGroupingChange, columnFilters, globalFilter, onGlobalFilterChange,
  showArchived, onToggleArchived, onNew,
  onClearFilters, viewMode, onViewModeChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeView        = VIEW_OPTIONS.find(o => o.id === viewMode)!;
  const activeGroup       = GROUP_OPTIONS.find(o => grouping.includes(o.id));
  const hasActiveGroup    = grouping.length > 0;
  const hasActiveFilters  = columnFilters.length > 0;
  // Badge total de configs activas para mostrar en el botón principal
  const activeConfigCount = (hasActiveGroup ? 1 : 0) + (showArchived ? 1 : 0) + columnFilters.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 650);
  };

  const canUseHoverClose = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  };

  return (
    <div className="border-b border-slate-200 px-3 py-2 flex items-center gap-2 bg-white">

      {/* ── BÚSQUEDA ── */}
      <div className="relative flex-1 min-w-0">
        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none" />
        <input
          value={globalFilter}
          onChange={e => onGlobalFilterChange(e.target.value)}
          placeholder="Buscar trato…"
          className="w-full pl-8 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white placeholder:text-slate-300 text-slate-700 transition-all"
        />
        {globalFilter && (
          <button onClick={() => onGlobalFilterChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        )}
      </div>

      {/* ── MENÚ DE VISTA — dropdown principal ── */}
      <div
        className="relative flex-shrink-0"
        ref={ref}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={() => {
          if (open && canUseHoverClose()) scheduleClose();
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className={`
            relative flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-md border text-sm sm:text-xs font-medium transition-all whitespace-nowrap
            ${open ? 'bg-slate-50 border-slate-300 text-slate-700' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}
          `}
        >
          <i className={`fa-solid ${activeView.icon} text-[11px] sm:text-[10px]`} />
          <span className="inline">Vista</span>
          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />

          {/* Badge con número de configs activas */}
          {activeConfigCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center leading-none border-2 border-white">
              {activeConfigCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-full mt-1.5 right-0 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl shadow-[0_10px_24px_rgba(15,23,42,0.12)] py-1 z-50 w-60 max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto">

            {/* ── SECCIÓN VISTA ── */}
            <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Vista</p>
            {VIEW_OPTIONS.map(opt => {
              const isActive = viewMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onViewModeChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left
                    ${isActive ? 'bg-slate-100 text-slate-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <i className={`fa-solid ${opt.icon} text-[11px] sm:text-[10px] w-3.5 text-center ${isActive ? 'text-slate-600' : 'text-slate-400'}`} />
                  {opt.label}
                  {isActive && <i className="fa-solid fa-check text-[9px] ml-auto text-slate-400" />}
                </button>
              );
            })}

            {/* ── SECCIÓN AGRUPADO POR ── */}
            <div className="border-t border-slate-100 mt-1.5 pt-1.5">
              <p className="px-2.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Agrupado por</p>

              {GROUP_OPTIONS.map(groupOpt => {
                const isGroupActive = grouping.includes(groupOpt.id);
                return (
                  <button
                    key={groupOpt.id}
                    onClick={() => {
                      onGroupingChange(isGroupActive ? [] : [groupOpt.id]);
                      setOpen(false);
                    }}
                    className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left
                      ${isGroupActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <i className={`fa-solid ${groupOpt.icon} text-[11px] sm:text-[10px] w-3.5 text-center ${isGroupActive ? 'text-blue-500' : 'text-slate-400'}`} />
                    {groupOpt.label}
                    {isGroupActive && <i className="fa-solid fa-check text-[9px] ml-auto text-blue-400" />}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  onGroupingChange([]);
                  setOpen(false);
                }}
                className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left
                  ${hasActiveGroup ? 'text-red-600 bg-red-50 hover:bg-red-100/70' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <i className={`fa-solid fa-xmark text-[11px] sm:text-[10px] w-3.5 text-center ${hasActiveGroup ? 'text-red-500' : 'text-slate-400'}`} />
                Sin agrupar
                {!hasActiveGroup && <i className="fa-solid fa-check text-[9px] ml-auto text-slate-400" />}
              </button>
            </div>

            {/* ── SECCIÓN OPCIONES ── */}
            <div className="border-t border-slate-100 mt-1.5 pt-1.5">
              <p className="px-2.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Opciones</p>

              <button
                onClick={() => {
                  onToggleArchived();
                  setOpen(false);
                }}
                className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left
                  ${showArchived ? 'text-amber-700 bg-amber-50 hover:bg-amber-100/70 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <i className={`fa-solid fa-box-archive text-[11px] sm:text-[10px] w-3.5 text-center ${showArchived ? 'text-amber-500' : 'text-slate-400'}`} />
                {showArchived ? 'Viendo archivados' : 'Ver archivados'}
                {showArchived && <i className="fa-solid fa-check text-[9px] ml-auto text-amber-500" />}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    onClearFilters();
                    setOpen(false);
                  }}
                  className="w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs text-slate-600 hover:bg-slate-50 rounded-md transition-colors text-left"
                >
                  <i className="fa-solid fa-filter text-[10px] w-3.5 text-center text-slate-400" />
                  <span>Limpiar {columnFilters.length} filtro{columnFilters.length > 1 ? 's' : ''}</span>
                  <i className="fa-solid fa-xmark text-[9px] ml-auto text-slate-400" />
                </button>
              )}

              {activeConfigCount > 1 && (
                <>
                  <div className="border-t border-slate-100 mx-3 my-1.5" />
                  <button
                    onClick={() => {
                      onGroupingChange([]);
                      onClearFilters();
                      if (showArchived) onToggleArchived();
                      setOpen(false);
                    }}
                    className="w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-rotate-left text-[10px] w-3.5 text-center text-red-500" />
                    Resetear todo
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── NUEVO TRATO ── */}
      <button onClick={onNew}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-800 text-white rounded-md text-sm sm:text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap">
        <i className="fa-solid fa-plus text-[11px] sm:text-[10px]" />
        <span className="inline">Nuevo trato</span>
      </button>
    </div>
  );
};

// ─── DEALS CONTAINER ──────────────────────────────────────────────────────────
const Deals: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dealStatuses: cachedDealStatuses, dealInterests: cachedDealInterests, users } = useDataCache();
  const { setDeals: setContextDeals } = useDealFilters();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const saved = localStorage.getItem('dealsListColumnFilters');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [globalFilter, setGlobalFilter] = useState('');

  const VALID_GROUP_IDS = ['client_company_name', 'estado_nombre', 'interes_nombre'];
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('dealsListGrouping');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((id: string) => VALID_GROUP_IDS.includes(id)) : [];
  });
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const saved = localStorage.getItem('dealsListExpanded');
    return saved ? JSON.parse(saved) : {};
  });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'kanban'>(() => {
    const saved = localStorage.getItem('dealsListViewMode');
    return (saved === 'table' || saved === 'list' || saved === 'kanban') ? saved : 'table';
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDealForEdit, setSelectedDealForEdit] = useState<Deal | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDealId, setShareDealId] = useState<string | null>(null);
  const [shareDealName, setShareDealName] = useState('');
  const [shareDealCreator, setShareDealCreator] = useState('');
  const [shareDealCollaborators, setShareDealCollaborators] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });
  const [selectWinnerModal, setSelectWinnerModal] = useState<{
    isOpen: boolean; deal: Deal | null; quotes: Quote[]; pendingStatusId: string;
  }>({ isOpen: false, deal: null, quotes: [], pendingStatusId: '' });

  // Ref para métodos expuestos por DealsTable (expandAll / collapseAll)
  const dealsTableRef = useRef<DealsTableHandle>(null);

  // ─── FETCH ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (force = false) => {
    if (!user?.id_tenant || !user?.id_user) return;
    const cacheKey = `deals_list_cache_${user.id_user}_${showArchived ? 'archived' : 'active'}`;
    const now = Date.now();
    const cacheTtlMs = 2 * 60 * 1000;

    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.timestamp && now - parsed.timestamp < cacheTtlMs && Array.isArray(parsed?.deals)) {
            setDeals(parsed.deals); setContextDeals(parsed.deals); setLoading(false); return;
          }
        } catch { localStorage.removeItem(cacheKey); }
      }
    }

    setLoading(true);
    try {
      const endpoint = showArchived
        ? GATEWAY_CONFIG.API.DEALS.ARCHIVED_LIST
        : GATEWAY_CONFIG.API.DEALS.LIST;
      const response = await apiFetch(endpoint);
      if (!response.ok) throw new Error();
      const text = await response.text();
      const raw = text ? JSON.parse(text) : {};

      const extractTratos = (input: any): any[] => {
        if (!input) return [];
        if (Array.isArray(input)) {
          const first = input[0];
          if (first) {
            if (Array.isArray(first?.response?.tratos)) return first.response.tratos;
            if (Array.isArray(first?.data?.tratos)) return first.data.tratos;
            if (Array.isArray(first?.tratos)) return first.tratos;
          }
          if (input.every((it: any) => it && (it.id_trato || it.nombre_trato))) return input;
          return [];
        }
        if (Array.isArray(input?.response?.tratos)) return input.response.tratos;
        if (Array.isArray(input?.data?.tratos)) return input.data.tratos;
        if (Array.isArray(input?.tratos)) return input.tratos;
        return [];
      };

      const normalizeDeals = (list: any[] = [], defaultArchived = false) => Array.isArray(list)
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
            estado_actual: {
              id: d.estado_id ?? d.id_deal_status ?? d.id_estado ?? '',
              icon: d.estado_icon ?? '',
              name: d.estado_nombre ?? '',
              color: d.estado_color ?? '#94a3b8',
              category: d.estado_categoria ?? 'DRAFT',
            },
            interes_nombre: d.interes_nombre,
            interes_color: d.interes_color,
            interes_icon: d.interes_icon,
            created_at: d.created_at ?? d.fecha_creacion,
            updated_at: d.updated_at ?? d.fecha_actualizacion,
            days_inactive: d.days_inactive ?? null,
            inactive_time_text: d.inactive_time_text ?? d.texto_inactividad ?? '',
            access_level: d.access_level ?? 'VIEW',
            archived:
              typeof d.archived === 'boolean'
                ? d.archived
                : typeof d.archivado === 'boolean'
                  ? d.archivado
                  : defaultArchived,
          }))
        : [];

      const dealsFromApi = normalizeDeals(extractTratos(raw), showArchived);
      setDeals(dealsFromApi);
      setContextDeals(dealsFromApi);
      localStorage.setItem(cacheKey, JSON.stringify({ deals: dealsFromApi, timestamp: now }));
    } catch { setToast({ message: 'Error de conexión', type: 'error' }); }
    finally { setLoading(false); }
  }, [user, setContextDeals, showArchived]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { localStorage.removeItem('deals_view_mode'); }, []);
  useEffect(() => { localStorage.setItem('dealsListColumnFilters', JSON.stringify(columnFilters)); }, [columnFilters]);
  useEffect(() => { localStorage.setItem('dealsListViewMode', viewMode); }, [viewMode]);

  // ─── HELPERS ────────────────────────────────────────────────────────────────
  const parseDealValue = (value: Deal['valor_trato']) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const handleGroupingChange = (newGrouping: string[]) => {
    setGrouping(newGrouping);
    localStorage.setItem('dealsListGrouping', JSON.stringify(newGrouping));
    setExpanded({});
    localStorage.setItem('dealsListExpanded', JSON.stringify({}));
  };

  const updateDealsLocal = useCallback((updater: (prev: Deal[]) => Deal[]) => {
    setDeals(prev => {
      const next = updater(prev);
      setContextDeals(next);
      return next;
    });
  }, [setContextDeals]);

  const openShareModal = async (deal: Deal) => {
    setShareDealId(deal.id_trato);
    setShareDealName(deal.nombre_trato || '');
    setShareDealCreator((deal as any).owner_name || '');
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
          is_owner: u.is_owner,
        };
      });
      setShareDealCollaborators(mapped);
    } catch { setShareDealCollaborators([]); }
    setShareModalOpen(true);
  };

  const handleEdit = (deal: Deal) => { setSelectedDealForEdit(deal); setIsEditModalOpen(true); };
  const handleEditModalSuccess = (updatedDeal: Deal) => {
    setToast({ message: 'Trato actualizado.', type: 'success' });
    updateDealsLocal(prev => prev.map(d => d.id_trato === updatedDeal.id_trato ? { ...d, ...updatedDeal } : d));
    setIsEditModalOpen(false);
    setSelectedDealForEdit(null);
  };

  const handleArchive = async (deal: Deal) => {
    try {
      await apiFetch(GATEWAY_CONFIG.API.DEALS.ARCHIVED, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_trato: deal.id_trato, id_tenant: user?.id_tenant, id_user: user?.id_user, archived: !deal.archived }),
      });
      updateDealsLocal(prev => prev.map(d => d.id_trato === deal.id_trato ? { ...d, archived: !deal.archived } : d));
      setToast({ message: deal.archived ? 'Trato desarchivado.' : 'Trato archivado.', type: 'success' });
    } catch { setToast({ message: 'Error al archivar.', type: 'error' }); }
  };

  const handleInlineUpdate = async (deal: Deal, updates: Partial<Deal>) => {
    if (!user?.id_tenant || !user?.id_user) return;
    if (updates.id_deal_status && updates.id_deal_status === deal.id_deal_status) return;
    if (updates.id_interest && updates.id_interest === deal.id_interest) return;

    const isStatusChange = !!(updates.id_deal_status && updates.id_deal_status !== deal.id_deal_status);
    const isInterestChange = !!(updates.id_interest && updates.id_interest !== deal.id_interest);
    const targetStatus = isStatusChange ? cachedDealStatuses.find(s => s.id_status === updates.id_deal_status) : undefined;

    const runUpdate = async () => {
      try {
        if (isStatusChange) {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: updates.id_deal_status, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!res.ok) throw new Error();
        } else if (isInterestChange) {
          const res = await apiFetch(GATEWAY_CONFIG.API.DEALS.UPDATE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...deal, ...updates, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          if (!res.ok) throw new Error();
        } else {
          await apiFetch(GATEWAY_CONFIG.API.DEALS.UPDATE, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...deal, ...updates, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
        }
        const nextPatch: Partial<Deal> = {};

        if (isStatusChange) {
          nextPatch.id_deal_status = updates.id_deal_status;
          if (targetStatus) {
            nextPatch.estado_nombre = targetStatus.name;
            nextPatch.estado_color = targetStatus.color;
            nextPatch.estado_icon = targetStatus.icon;
            nextPatch.estado_categoria = targetStatus.status_category;
            nextPatch.estado_actual = {
              ...(deal.estado_actual || { id: '', icon: '', name: '', color: '#94a3b8', category: 'DRAFT' }),
              id: targetStatus.id_status,
              icon: targetStatus.icon,
              name: targetStatus.name,
              color: targetStatus.color,
              category: targetStatus.status_category || 'DRAFT',
            } as any;
          }
        }

        if (isInterestChange) {
          const nextInterest = cachedDealInterests.find(i => i.id_interest === updates.id_interest);
          nextPatch.id_interest = updates.id_interest;
          if (nextInterest) {
            nextPatch.interes_nombre = nextInterest.name;
            nextPatch.interes_color = nextInterest.color;
            nextPatch.interes_icon = nextInterest.icon;
            nextPatch.interes_actual = {
              ...(deal.interes_actual || { id: '', icon: '', name: '', color: '#94a3b8' }),
              id: nextInterest.id_interest,
              icon: nextInterest.icon,
              name: nextInterest.name,
              color: nextInterest.color,
            } as any;
          }
        }

        const patchToApply = Object.keys(nextPatch).length > 0 ? nextPatch : updates;
        updateDealsLocal(prev => prev.map(d => d.id_trato === deal.id_trato ? { ...d, ...patchToApply } : d));
        setToast({ message: 'Actualizado.', type: 'success' });
      } catch { setToast({ message: 'Error al actualizar', type: 'error' }); }
    };

    if (isStatusChange) {
      const isLostStatus = targetStatus?.status_category === 'LOST';
      const isWonStatus  = targetStatus?.status_category === 'WON' ||
        targetStatus?.name?.toUpperCase().includes('GANADO') ||
        targetStatus?.name?.toUpperCase().includes('CERRADO');

      if (isWonStatus) {
        (async () => {
          try {
            const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${deal.id_trato}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
            if (!res.ok) throw new Error();
            const text = await res.text();
            const parsed = text ? JSON.parse(text) : null;
            const payload = Array.isArray(parsed) ? (parsed[0] || null) : parsed;
            const quotesData = payload?.cotizaciones_activas || payload?.cotizaciones || payload?.quotes || [];
            if (quotesData.length === 0) { runUpdate(); return; }
            const mappedQuotes: Quote[] = quotesData.map((q: any) => ({
              id_cotizacion: q.id || q.id_cotizacion,
              id_tenant: user.id_tenant,
              id_user: payload.owner_id,
              id_client_company: payload.id_client_company || '',
              id_contact: payload.id_contact || '',
              no_cotizacion: Number(q.numero || q.no_cotizacion) || 0,
              formatted_no_cotizacion: q.numero || q.formatted_no_cotizacion,
              nombre_cotizacion: q.nombre || q.nombre_cotizacion,
              fecha_emision: q.fecha || q.fecha_emision,
              fecha_emision_fmt: q.fecha || q.fecha_emision_fmt,
              total: String(q.total),
              version: q.version || 1,
              id_quote_status: q.id_quote_status || '',
              id_trato: deal.id_trato,
              is_private: q.is_private || false,
              estado: q.estado || q.estado_nombre,
              estado_color: q.color_estado || q.estado_color,
              estado_decision: q.estado_decision || 'PENDIENTE' as any,
              created_at: q.created_at || '',
              updated_at: q.updated_at || '',
            }));
            setSelectWinnerModal({ isOpen: true, deal, quotes: mappedQuotes, pendingStatusId: updates.id_deal_status || '' });
          } catch { setToast({ message: 'Error al cargar cotizaciones', type: 'error' }); }
        })();
        return;
      }

      const messageContent = (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {isLostStatus
              ? 'Esto marcará todas las cotizaciones asociadas como Perdidas. ¿Deseas continuar?'
              : `¿Cambiar el estado a "${targetStatus?.name}"?`}
          </p>
          {targetStatus?.notify_client && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <i className="fa-solid fa-envelope text-blue-500 text-xs" />
              <span className="text-xs text-blue-700">Se notificará al cliente por correo</span>
            </div>
          )}
        </div>
      );
      setConfirmState({
        isOpen: true,
        title: isLostStatus ? 'Marcar como Perdido' : 'Confirmar cambio',
        message: messageContent as any,
        isDestructive: isLostStatus,
        onConfirm: () => { runUpdate(); setConfirmState(p => ({ ...p, isOpen: false })); },
      });
      return;
    }
    runUpdate();
  };

  const handleWinningQuoteConfirm = async (selectedQuoteId: string, createInCartera: boolean) => {
    const { deal, quotes, pendingStatusId } = selectWinnerModal;
    if (!deal || !pendingStatusId || !user?.id_user) return;
    setSelectWinnerModal({ isOpen: false, deal: null, quotes: [], pendingStatusId: '' });
    try {
      const selectedQuote = quotes.find(q => q.id_cotizacion === selectedQuoteId);
      if (!selectedQuote) throw new Error();
      const resStatus = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: pendingStatusId, id_user: user.id_user, id_cotizacion: selectedQuoteId }),
      });
      if (!resStatus.ok) throw new Error();
      if (selectedQuote.id_quote_status) {
        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/quotes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_cotizacion: selectedQuoteId, id_quote_status: selectedQuote.id_quote_status, id_user: user.id_user }),
        });
      }
      const wonStatus = cachedDealStatuses.find(s => s.id_status === pendingStatusId);
      if (wonStatus) {
        updateDealsLocal(prev => prev.map(d =>
          d.id_trato === deal.id_trato
            ? {
                ...d,
                id_deal_status: wonStatus.id_status,
                estado_nombre: wonStatus.name,
                estado_color: wonStatus.color,
                estado_icon: wonStatus.icon,
                estado_categoria: wonStatus.status_category,
                estado_actual: {
                  ...(d.estado_actual || { id: '', icon: '', name: '', color: '#94a3b8', category: 'DRAFT' }),
                  id: wonStatus.id_status,
                  icon: wonStatus.icon,
                  name: wonStatus.name,
                  color: wonStatus.color,
                  category: wonStatus.status_category || 'DRAFT',
                } as any,
              }
            : d
        ));
      }
      const quoteNumber = selectedQuote.formatted_no_cotizacion || selectedQuote.no_cotizacion;
      setToast({ message: `Cotización #${quoteNumber} marcada como ganadora.`, type: 'success' });
      if (createInCartera) setTimeout(() => navigate(`/app/financials/new?from_deal=${deal.id_trato}&quote_id=${selectedQuoteId}&client_id=${deal.id_client_company}`), 500);
    } catch { setToast({ message: 'No se pudo completar la operación.', type: 'error' }); }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true, title: 'Eliminar trato', message: '¿Estás seguro? Esta acción es irreversible.', isDestructive: true,
      onConfirm: async () => {
        await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/delete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_trato: id, id_tenant: user?.id_tenant, id_user: user?.id_user }),
        });
        updateDealsLocal(prev => prev.filter(d => d.id_trato !== id));
        setConfirmState(p => ({ ...p, isOpen: false }));
        setToast({ message: 'Trato eliminado.', type: 'success' });
      },
    });
  };

  const handleStatusChangeWithQuotes = (deal: Deal, statusId: string, quotes: Quote[], pendingStatusId: string) => {
    setSelectWinnerModal({ isOpen: true, deal, quotes, pendingStatusId });
  };

  const handleInterestChange = async (deal: Deal, interestId: string) => {
    await handleInlineUpdate(deal, { id_interest: interestId });
  };

  // Filtrado manual para Lista y Kanban (no usan TanStack)
  const filteredDealsForSimpleViews = useMemo(() => {
    if (!globalFilter) return deals;
    const q = globalFilter.toLowerCase();
    return deals.filter(d =>
      d.nombre_trato?.toLowerCase().includes(q) ||
      d.client_company_name?.toLowerCase().includes(q) ||
      d.contact_full_name?.toLowerCase().includes(q) ||
      d.estado_actual?.name?.toLowerCase().includes(q) ||
      ((d as any).estado_nombre?.toLowerCase().includes(q)) ||
      (d as any).interes_actual?.name?.toLowerCase().includes(q) ||
      (d.interes_nombre?.toLowerCase().includes(q))
    );
  }, [deals, globalFilter]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans text-slate-700">

      <ToolbarViewMenu
        grouping={grouping}
        onGroupingChange={handleGroupingChange}
        columnFilters={columnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(v => !v)}
        onNew={() => navigate('/app/deals/new')}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onClearFilters={() => setColumnFilters([])}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <BrandSpinner size="lg" />
        </div>
      ) : viewMode === 'table' ? (
        <DealsTable
          ref={dealsTableRef}
          deals={deals}
          cachedDealStatuses={cachedDealStatuses}
          cachedDealInterests={cachedDealInterests}
          cachedUsers={users}
          user={user}
          showArchived={showArchived}
          sorting={sorting}
          setSorting={setSorting}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          globalFilter={globalFilter}
          grouping={grouping}
          setGrouping={setGrouping}
          expanded={expanded}
          setExpanded={setExpanded}
          pagination={pagination}
          setPagination={setPagination}
          onRefresh={() => fetchData(true)}
          onEdit={handleEdit}
          onShare={openShareModal}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onStatusChange={handleStatusChangeWithQuotes}
          onInterestChange={handleInterestChange}
          onInlineUpdate={handleInlineUpdate}
          onExpandAll={() => dealsTableRef.current?.expandAll()}
          onCollapseAll={() => dealsTableRef.current?.collapseAll()}
        />
      ) : viewMode === 'list' ? (
        <DealsListView
          deals={filteredDealsForSimpleViews}
          cachedDealStatuses={cachedDealStatuses}
          cachedDealInterests={cachedDealInterests}
          cachedUsers={users}
          showArchived={showArchived}
          user={user}
          grouping={grouping}
          onEdit={handleEdit}
          onShare={openShareModal}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onStatusChange={handleStatusChangeWithQuotes}
          onInterestChange={handleInterestChange}
          onInlineUpdate={handleInlineUpdate}
          onRefresh={() => fetchData(true)}
        />
      ) : (
        <DealsKanban
          deals={filteredDealsForSimpleViews.filter(d => showArchived ? d.archived : !d.archived)}
          dealStatuses={cachedDealStatuses}
          dealInterests={cachedDealInterests}
          cachedUsers={users}
          user={user}
          onEdit={handleEdit}
          onShare={openShareModal}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onRefresh={() => fetchData(true)}
        />
      )}

      {shareModalOpen && shareDealId && (
        <ShareModal
          entity="deal" id={shareDealId}
          entityName={shareDealName || `Trato #${shareDealId}`}
          creatorName={shareDealCreator} isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareDealId(null); setShareDealName(''); setShareDealCreator(''); setShareDealCollaborators([]); }}
          onShared={() => { setToast({ message: 'Asignaciones actualizadas.', type: 'success' }); }}
          currentCollaborators={shareDealCollaborators}
        />
      )}

      {selectedDealForEdit && (
        <DealEditModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setSelectedDealForEdit(null); }}
          initialData={selectedDealForEdit}
          onSuccess={handleEditModalSuccess}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(p => ({ ...p, isOpen: false }))} />

      {selectWinnerModal.isOpen && selectWinnerModal.deal && (
        <SelectWinningQuoteModal
          isOpen={selectWinnerModal.isOpen}
          onClose={() => setSelectWinnerModal({ isOpen: false, deal: null, quotes: [], pendingStatusId: '' })}
          onConfirm={handleWinningQuoteConfirm}
          quotes={selectWinnerModal.quotes}
          dealName={selectWinnerModal.deal.nombre_trato || `Trato #${selectWinnerModal.deal.id_trato}`}
          hasCarteraAccess={user?.module_access?.financials || user?.rol_user === 'admin' || user?.rol_user === 'superadmin'}
        />
      )}
    </div>
  );
};

export default Deals;
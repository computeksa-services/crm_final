import React, { useEffect, useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deal, DealStatus, DealInterest, Quote } from '../../types';
import { apiFetch } from '../../services/apiClient';
import Avatar from '../../components/Avatar';
import DealActionsMenu from '../../components/DealActionsMenu';
import { canEditInline } from '../../utils/permissions';
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
  FilterFn,
  PaginationState,
  Updater
} from '@tanstack/react-table';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface DealsTableProps {
  deals: Deal[];
  cachedDealStatuses: DealStatus[];
  cachedDealInterests: DealInterest[];
  cachedUsers: any[];
  user: any;
  showArchived: boolean;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  columnFilters: ColumnFiltersState;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  globalFilter: string;
  grouping: GroupingState;
  setGrouping: (grouping: GroupingState) => void;
  expanded: ExpandedState;
  setExpanded: (expanded: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => void;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void;
  onRefresh: () => void;
  onEdit: (deal: Deal) => void;
  onShare: (deal: Deal) => void;
  onArchive: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (deal: Deal, statusId: string, quotes: Quote[], pendingStatusId: string) => void;
  onInterestChange: (deal: Deal, interestId: string) => void;
  onInlineUpdate: (deal: Deal, updates: Partial<Deal>) => Promise<void>;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

// Handle expuesto para expand/collapse desde el padre
export interface DealsTableHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  const { start, end } = value as { start: string; end: string };
  const rowDate = row.getValue(columnId) as string;
  if (!rowDate) return false;
  
  // Convertir DD/MM/YYYY a YYYY-MM-DD para comparación
  let isoDate = '';
  const parts = rowDate.split('/');
  if (parts.length === 3) {
    isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  
  if (!isoDate) return false;
  
  if (start && isoDate < start) return false;
  if (end && isoDate > end) return false;
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

// FIX 2: resolveUser acepta objetos collab, no solo IDs
const resolveUser = (users: any[], collabId: any) => {
  if (!collabId) return undefined;
  const collabIdStr = String(collabId);
  return users.find(u => {
    const userId = u.id_user || u.id || u.username || u.user_id;
    if (!userId) return false;
    const userIdStr = String(userId);
    return (
      u.id_user === collabId ||
      u.id === collabId ||
      u.username === collabId ||
      u.user_id === collabId ||
      userIdStr.includes(collabIdStr) ||
      collabIdStr.includes(userIdStr)
    );
  });
};

const formatAmount = (amount: number): string =>
  amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCurrency = (amount: number): string =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const MoneyValue: React.FC<{ amount: number; size?: string; accounting?: boolean }> = ({ amount, size = 'text-sm', accounting = false }) => {
  const numStr = formatAmount(amount);
  if (accounting) {
    return (
      <span className={`flex items-baseline w-full tabular-nums font-semibold text-slate-800 ${size}`}>
        <span className="select-none">$</span>
        <span className="flex-1 text-right">{numStr}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-baseline tabular-nums font-semibold text-slate-800 ${size}`}>
      {formatCurrency(amount)}
    </span>
  );
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  
  // Backend siempre envía DD/MM/YYYY
  const parts = value.split('/');
  if (parts.length !== 3) {
    console.warn('⚠️ Formato de fecha inesperado:', value);
    return value;
  }
  
  const [dd, mm, yyyy] = parts;
  const parsedDate = new Date(`${yyyy}-${mm}-${dd}`);
  
  if (Number.isNaN(parsedDate.getTime())) {
    console.warn('⚠️ Fecha inválida:', value);
    return value;
  }
  
  const weekday = new Intl.DateTimeFormat('es-EC', { weekday: 'short' }).format(parsedDate).replace('.', '').toLowerCase();
  const datePart = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsedDate).replace('.', '').toLowerCase();
  return `${weekday}, ${datePart}`;
};

// ─── INLINE BADGE SELECTOR ────────────────────────────────────────────────────
const InlineBadgeSelector: React.FC<{
  valueId: string;
  items: { id: string; name: string; color?: string; icon?: string; notify_client?: boolean }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const current = items.find(i => i.id === valueId);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');

  const renderNotifyBadge = () => (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">
      <i className="fa-solid fa-envelope text-[8px]" />
    </span>
  );

  const currentIndex = items.findIndex(i => i.id === valueId);
  const itemsAbove = currentIndex > 0 ? items.slice(0, currentIndex) : [];
  const itemsBelow = currentIndex < items.length - 1 ? items.slice(currentIndex + 1) : [];

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition(window.innerHeight - rect.bottom < 200 && rect.top > 200 ? 'top' : 'bottom');
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
        className={`
          inline-flex items-center gap-2 px-2.5 py-1 min-h-[24px] rounded-md text-[11px] font-semibold
          transition-all whitespace-nowrap
          ${disabled ? 'cursor-default' : 'hover:opacity-90 cursor-pointer'}
        `}
        style={{ backgroundColor: current?.color || '#94a3b8', color: '#ffffff' }}
      >
        {current?.icon && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
            <i className={`${current.icon} text-[9px] leading-none`} />
          </span>
        )}
        <span>{current?.name || '—'}</span>
        {current?.notify_client && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none opacity-70">
            <i className="fa-solid fa-envelope text-[8px] leading-none" />
          </span>
        )}
        {!disabled && (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-0.5 opacity-60">
            <i className="fa-solid fa-chevron-down text-[7px] leading-none" />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} 
            left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {itemsAbove.map(item => (
              <button key={item.id}
                onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color || '#94a3b8' }}>
                  <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
                {item.notify_client && renderNotifyBadge()}
              </button>
            ))}
            <div className="bg-slate-50 border-y border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: current?.color || '#94a3b8' }}>
                  <i className={`${current?.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{current?.name || '—'}</span>
                {current?.notify_client && renderNotifyBadge()}
                <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400" />
              </div>
            </div>
            {itemsBelow.map(item => (
              <button key={item.id}
                onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color || '#94a3b8' }}>
                  <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`} />
                </div>
                <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
                {item.notify_client && renderNotifyBadge()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT (forwardRef para exponer expandAll/collapseAll) ────────────
const DealsTable = forwardRef<DealsTableHandle, DealsTableProps>(({
  deals,
  cachedDealStatuses,
  cachedDealInterests,
  cachedUsers,
  user,
  showArchived,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  globalFilter,           // FIX 3: conectado al table instance
  grouping,
  setGrouping,
  expanded,
  setExpanded,
  pagination,
  setPagination,
  onRefresh,
  onEdit,
  onShare,
  onArchive,
  onDelete,
  onStatusChange,
  onInterestChange,
  onInlineUpdate,
  onExpandAll,
  onCollapseAll
}, ref) => {
  const navigate = useNavigate();
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const applyUpdater = <T,>(updater: Updater<T>, current: T): T => {
    return typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;
  };

  // ─── INLINE UPDATES ──────────────────────────────────────────────────────────
  const handleInlineStatusUpdate = async (deal: Deal, newStatusId: string) => {
    const newStatus = cachedDealStatuses.find(s => s.id_status === newStatusId);
    if (!newStatus) return;
    if (newStatus.status_category === 'WON') {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/quotes?id_trato=${deal.id_trato}`);
        if (!res.ok) throw new Error();
        const quotesData = await res.json();
        const quotes = Array.isArray(quotesData) ? quotesData : quotesData?.quotes || [];
        if (quotes.length > 0) { onStatusChange(deal, newStatusId, quotes, newStatusId); return; }
      } catch { /* fall through to standard update */ }
    }
    try {
      await onInlineUpdate(deal, { id_deal_status: newStatusId });
    } catch (e) { console.error('Error updating status:', e); }
  };

  const handleInlineInterestUpdate = async (deal: Deal, newInterestId: string) => {
    try {
      await onInlineUpdate(deal, { id_interest: newInterestId });
    } catch (e) { console.error('Error updating interest:', e); }
  };

  // ─── FACETED VALUES — FIX 1: usa campos del modelo normalizado ───────────────
  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    deals.forEach(deal => {
      if (columnId === 'collaborators') {
        const collaborators = (deal as any).collaborators || [];
        if (collaborators.length === 0) {
          counts.set('Sin asignar', (counts.get('Sin asignar') || 0) + 1);
        } else {
          collaborators.forEach((collab: any) => {
            const u = resolveUser(cachedUsers, collab.id ?? collab.id_user ?? collab.user_id ?? '');
            const name = u?.name_user || 'Usuario';
            counts.set(name, (counts.get(name) || 0) + 1);
          });
        }
        return;
      }
      if (columnId === 'client_company_name') {
        const comp = deal.client_company_name || '(Vacío)';
        const contact = deal.contact_full_name || 'Sin contacto';
        counts.set(`🏢 ${comp}`, (counts.get(`🏢 ${comp}`) || 0) + 1);
        counts.set(`👤 ${contact}`, (counts.get(`👤 ${contact}`) || 0) + 1);
        return;
      }
      // estado_nombre, interes_nombre y cualquier otro campo directo
      const val = (deal as any)[columnId] || '(Vacío)';
      counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // ─── GROUP CELL ───────────────────────────────────────────────────────────────
  const renderGroupCell = (row: any, label: string) => {
    const subtotal = row.subRows.reduce((sum: number, subRow: any) =>
      sum + parseDealValue(subRow.original?.valor_trato || 0), 0);
    const colId = row.groupingColumnId;
    let color: string | undefined;
    let icon: string | undefined;
    if (colId === 'estado_nombre') {
      const match = cachedDealStatuses.find(s => s.name?.toUpperCase() === label?.toUpperCase());
      color = match?.color; icon = match?.icon;
    } else if (colId === 'interes_nombre') {
      const match = cachedDealInterests.find(i => i.name?.toUpperCase() === label?.toUpperCase());
      color = match?.color; icon = match?.icon;
    }
    return (
      <div className="flex items-center gap-3 py-0.5">
        <i className={`fa-solid fa-chevron-right text-slate-400 text-[10px] transition-transform duration-150 ${row.getIsExpanded() ? 'rotate-90' : ''}`} />
        {color ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white"
            style={{ backgroundColor: color }}>
            {icon && <i className={`${icon} text-[9px]`} />}
            {label || 'Sin asignar'}
          </span>
        ) : (
          <span className="font-semibold text-slate-700 text-xs">{label || 'Sin asignar'}</span>
        )}
        <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{row.subRows.length}</span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50">
          <MoneyValue amount={subtotal} size="text-xs" />
        </span>
      </div>
    );
  };

  // ─── COLUMNS ─────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Deal>[]>(() => [
    {
      accessorKey: 'estado_nombre',
      header: 'Estado',
      size: 190,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(row.getValue(columnId) as string);
      },
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return (
          <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
            <DealActionsMenu deal={row.original} user={user} onEdit={onEdit} onShare={onShare} onArchive={onArchive} onDelete={onDelete} anchor="auto-left" />
            <InlineBadgeSelector
              valueId={row.original.id_deal_status || ''}
              items={cachedDealStatuses.map(s => ({ ...s, id: s.id_status }))}
              onSelect={id => handleInlineStatusUpdate(row.original, id)}
              disabled={!canEditInline(user, row.original)}
            />
          </div>
        );
      }
    },
    {
      accessorKey: 'nombre_trato',
      header: 'Nombre',
      size: 260, minSize: 150, maxSize: 320,
      enableColumnFilter: false,
      cell: ({ getValue, row }) => {
        if (row.getIsGrouped()) return null;
        const nombre = getValue() as string;
        return (
          <span className="text-slate-800 text-sm font-medium block truncate" style={{ maxWidth: 300 }} title={nombre}>
            {nombre}
          </span>
        );
      }
    },
    {
      accessorKey: 'client_company_name',
      header: 'Cliente',
      size: 200, minSize: 150, maxSize: 260,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) return true;
        const company = row.getValue(columnId) as string;
        const contact = (row.original as any).contact_full_name || '';
        return filterValue.some(val => {
          const cleanVal = val.replace(/^(🏢|👤)\s/, '');
          return (company && company.toLowerCase() === cleanVal.toLowerCase())
              || (contact && contact.toLowerCase() === cleanVal.toLowerCase());
        });
      },
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        const companyName = getValue() as string;
        const contactName = row.original.contact_full_name || '';
        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-[13px] leading-tight text-slate-800 font-semibold truncate" style={{ maxWidth: 180 }}>{companyName}</span>
            {contactName && <span className="text-[10px] leading-tight text-slate-600 truncate" style={{ maxWidth: 180 }}>{contactName}</span>}
          </div>
        );
      }
    },
    {
      accessorKey: 'valor_trato',
      header: 'Valor',
      size: 130,
      enableColumnFilter: false,
      cell: ({ getValue, row }) => {
        if (row.getIsGrouped()) return null;
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50">
            <MoneyValue amount={parseDealValue(getValue() as Deal['valor_trato'])} size="text-[11px]" />
          </span>
        );
      }
    },
    {
      accessorKey: 'interes_nombre',
      header: 'Interés',
      size: 145,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes((row.getValue(columnId) as string) || '(Vacío)');
      },
      cell: ({ row, getValue, column }) => {
        if (row.getIsGrouped()) {
          if (grouping[0] === column.id) return renderGroupCell(row, getValue() as string);
          return null;
        }
        return (
          <div onClick={e => e.stopPropagation()}>
            <InlineBadgeSelector
              valueId={row.original.id_interest || ''}
              items={cachedDealInterests.map(i => ({ ...i, id: i.id_interest }))}
              onSelect={id => handleInlineInterestUpdate(row.original, id)}
              disabled={!canEditInline(user, row.original)}
            />
          </div>
        );
      }
    },
    {
      accessorKey: 'collaborators',
      header: 'Colaboradores',
      size: 160,
      enableColumnFilter: true,
      filterFn: (row, _id, filterValue: string[]) => {
        const collaborators = (row.original as any).collaborators || [];
        if (filterValue.length === 0) return true;
        return collaborators.some((collab: any) => {
          const u = resolveUser(cachedUsers, collab.id ?? collab.id_user ?? collab.user_id ?? '');
          const name = u?.name_user || '';
          return filterValue.some(f => name.toLowerCase().includes(f.toLowerCase()));
        });
      },
      // FIX 2: collaborators es array de objetos {id, access_level, is_owner}
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const collaborators = (row.original as any).collaborators || [];
        if (collaborators.length === 0) return <span className="text-xs text-slate-300">—</span>;
        const sorted = [...collaborators].sort((a, b) => {
          if (a.is_owner !== b.is_owner) return b.is_owner ? 1 : -1;
          const lo = { EDIT: 1, VIEW: 2, BLOCKED: 3 };
          return (lo[a.access_level as keyof typeof lo] || 3) - (lo[b.access_level as keyof typeof lo] || 3);
        });
        return (
          <div className="flex items-center gap-1 h-8 leading-none" onClick={e => e.stopPropagation()}>
            {sorted.slice(0, 4).map((collab: any, idx: number) => {
              const collabId = collab.id ?? collab.id_user ?? collab.user_id ?? collab.userId;
              const u = resolveUser(cachedUsers, collabId);
              const userName = u?.name_user || collab?.name || collab?.user_name || collab?.email || 'Usuario';
              const userAvatar =
                u?.avatar_url ||
                (u as any)?.avatar ||
                collab?.avatar_url ||
                collab?.avatar ||
                collab?.user_avatar ||
                null;
              const isOwner = !!collab.is_owner;
              const isPrincipal = collab.access_level === 'EDIT' && !isOwner;
              const badgeType: 'OWNER' | 'EDIT' | 'VIEW' = isOwner ? 'OWNER' : isPrincipal ? 'EDIT' : 'VIEW';
              const tooltipLevel = isOwner ? 'Creador' : isPrincipal ? 'Principal' : 'Secundario';
              return (
                <div key={collab.id ?? collab.id_user ?? idx} className="inline-flex items-center">
                  <Avatar
                    src={userAvatar}
                    name={userName}
                    size="sm"
                    className="cursor-pointer"
                    badgeInset
                    badge={{ type: badgeType }}
                    enableHoverZoom
                    hoverScale={1.25}
                    showTooltip
                    tooltipRole={tooltipLevel}
                    tooltipPosition="bottom"
                  />
                </div>
              );
            })}
            {sorted.length > 4 && (
              <span className="inline-flex items-center text-[10px] leading-none text-slate-400 font-medium ml-0.5">+{sorted.length - 4}</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Creado',
      size: 140,
      enableColumnFilter: true,
      filterFn: dateRangeFilter,
      cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
        <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateTime(getValue() as string)}</span>
      )
    },
    {
      accessorKey: 'updated_at',
      header: 'Actualizado',
      size: 140,
      enableColumnFilter: true,
      filterFn: dateRangeFilter,
      cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
        <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateTime(getValue() as string)}</span>
      )
    },
    {
      accessorKey: 'days_inactive',
      header: 'Inactivo',
      size: 110,
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const days = row.original.days_inactive;
        const inactiveText = row.original.inactive_time_text;
        if (days === undefined || days === null) {
          return <span className="text-xs text-slate-300">{inactiveText || '—'}</span>;
        }
        let color = 'text-slate-400';
        const fallbackText = days === 0 ? 'Al día' : `${days}d`;
        if (days === 0)       color = 'text-emerald-500';
        else if (days > 30)   color = 'text-red-500';
        else if (days > 15)   color = 'text-orange-400';
        else if (days > 7)    color = 'text-amber-400';
        else                  color = 'text-emerald-400';
        const text = inactiveText || fallbackText;
        return <span className={`text-xs font-medium ${color}`}>{text}</span>;
      }
    },
  ], [cachedDealStatuses, cachedDealInterests, grouping, cachedUsers, user]);

  // ─── TABLE INSTANCE — FIX 3: globalFilter conectado ─────────────────────────
  const table = useReactTable({
    data: useMemo(
      () => showArchived ? deals.filter(d => d.archived === true) : deals.filter(d => !d.archived),
      [deals, showArchived]
    ),
    columns,
    paginateExpandedRows: false,
    state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination },
    onSortingChange: (updater) => {
      setSorting(applyUpdater(updater, sorting));
    },
    onColumnFiltersChange: (updater) => {
      setColumnFilters(applyUpdater(updater, columnFilters));
    },
    onGlobalFilterChange: () => {}, // solo lectura — lo controla el padre
    onGroupingChange: (updater) => {
      const nextGrouping = applyUpdater(updater, grouping);
      setGrouping(nextGrouping);

      // Keep user-selected header sorting. If grouping is enabled and no sort exists,
      // set a sensible default once.
      const groupedBy = nextGrouping[0];
      if (groupedBy && sorting.length === 0) {
        setSorting([{ id: groupedBy, desc: false }]);
      }
    },
    onExpandedChange: (updater) => {
      setExpanded(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('dealsListExpanded', JSON.stringify(next));
        return next;
      });
    },
    onPaginationChange: (updater) => {
      const next = applyUpdater(updater, pagination as PaginationState);
      setPagination({ pageIndex: next.pageIndex, pageSize: next.pageSize });
    },
    autoResetExpanded: false,
    groupedColumnMode: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id_trato || (row as any).id || '',
  });

  // FIX 4: exponer expandAll / collapseAll al padre via ref
  useImperativeHandle(ref, () => ({
    expandAll: () => {
      const next: Record<string, boolean> = {};
      table.getRowModel().rows
        .filter(r => r.getIsGrouped())
        .forEach(r => {
          next[r.id] = true;
        });
      setExpanded(next as ExpandedState);
      localStorage.setItem('dealsListExpanded', JSON.stringify(next));
    },
    collapseAll: () => {
      setExpanded({});
      localStorage.setItem('dealsListExpanded', JSON.stringify({}));
    }
  }), [table]);

  const filteredRows = table.getFilteredRowModel().rows;
  const totalFiltered = useMemo(
    () => filteredRows.reduce((s, r) => s + (r.getIsGrouped() ? 0 : parseDealValue(r.original.valor_trato)), 0),
    [filteredRows]
  );

  return (
    <>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm" ref={tableRef}>
          <thead className="sticky top-0 z-30">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const isDate = ['fecha_emision', 'created_at', 'updated_at'].includes(header.column.id);
                  return (
                    <th key={header.id} style={{ width: header.getSize() }}
                      className="h-9 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-left relative font-sans">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none"
                          onClick={header.column.getToggleSortingHandler()}>
                          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{ asc: <i className="fa-solid fa-sort-up text-slate-400 text-[9px]" />, desc: <i className="fa-solid fa-sort-down text-slate-400 text-[9px]" /> }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {header.column.id !== 'actions' && header.column.columnDef.enableColumnFilter !== false && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isFiltered ? 'text-slate-500 bg-slate-200' : 'text-slate-300 hover:text-slate-500'}`}>
                            <i className={`fa-solid ${isDate ? 'fa-calendar-days' : 'fa-filter'} text-[9px]`} />
                          </button>
                        )}
                      </div>

                      {activeFilterMenu === header.column.id && (
                        <div ref={filterMenuRef} onMouseLeave={() => setActiveFilterMenu(null)}
                          className="absolute top-full left-0 mt-1.5 w-60 bg-white shadow-lg rounded-lg border border-slate-200 z-50 py-2.5">
                          {isDate ? (
                            <div className="px-3 space-y-2">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Rango de fechas</p>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Desde</label>
                                <input type="date" className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300"
                                  onChange={e => {
                                    const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                    header.column.setFilterValue({ ...val, start: e.target.value });
                                  }} />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Hasta</label>
                                <input type="date" className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300"
                                  onChange={e => {
                                    const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                    header.column.setFilterValue({ ...val, end: e.target.value });
                                  }} />
                              </div>
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto px-1">
                              {getFacetedValues(header.column.id).map(([val, count]) => {
                                const activeValues = (columnFilters.find(f => f.id === header.column.id)?.value as string[]) || [];
                                const isChecked = activeValues.includes(val);
                                return (
                                  <label key={val} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-slate-700 border-slate-700' : 'border-slate-300'}`}>
                                      {isChecked && <i className="fa-solid fa-check text-[7px] text-white" />}
                                    </div>
                                    <span className="text-xs text-slate-700 truncate flex-1">{val}</span>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">{count}</span>
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
                            <div className="mt-1 pt-1.5 border-t border-slate-100 px-3">
                              <button onClick={() => header.column.setFilterValue(undefined)}
                                className="text-[10px] text-red-400 hover:text-red-600 font-medium">Limpiar filtro</button>
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

          <tbody>
            {grouping.length > 0 && onExpandAll && onCollapseAll && (
              <tr className="bg-slate-50 border-b border-slate-100">
                <td colSpan={columns.length} className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button onClick={onExpandAll}
                      className="text-slate-400 hover:text-slate-700 transition-colors leading-none">
                      expandir
                    </button>
                    <span className="text-slate-300">/</span>
                    <button onClick={onCollapseAll}
                      className="text-slate-400 hover:text-slate-700 transition-colors leading-none">
                      contraer
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="fa-regular fa-handshake text-3xl text-slate-200" />
                    <p className="text-sm text-slate-400">No hay tratos</p>
                    <button onClick={() => navigate('/app/deals/new')}
                      className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
                      Crear trato
                    </button>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.map(row => {
              const isGrouped = row.getIsGrouped();
              return (
                <tr key={row.id}
                  onClick={() => isGrouped ? row.toggleExpanded() : navigate(`/app/deals/${row.original.id_trato}`)}
                  className={`border-b border-slate-100 transition-colors cursor-pointer
                    ${isGrouped ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white hover:bg-blue-50/70'}`}
                >
                  {isGrouped ? (
                    <td colSpan={row.getVisibleCells().length} className="px-4 py-2">
                      {(() => {
                        const groupedCell = row.getVisibleCells().find(cell => cell.column.id === row.groupingColumnId);
                        const label = groupedCell ? String(groupedCell.getValue() ?? '') : '';
                        return renderGroupCell(row, label);
                      })()}
                    </td>
                  ) : (
                    row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="border-t border-zinc-200 px-4 py-1.5 bg-zinc-50 font-sans">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs text-slate-600 min-w-0">
            <span className="font-semibold shrink-0">{deals.length} registros</span>
            <span className="inline-flex items-center justify-between sm:justify-start gap-2 px-2.5 py-0.5 rounded-md bg-white border border-zinc-200 min-w-0 w-[190px] sm:w-auto">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</span>
              <span className="text-[11px] sm:text-[12px] font-semibold text-slate-800 tabular-nums">
                {totalFiltered.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-end sm:justify-start gap-1.5 text-xs text-slate-600 shrink-0">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 disabled:opacity-30 transition-colors">
            <i className="fa-solid fa-chevron-left text-[9px]" />
          </button>
          <span className="px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 disabled:opacity-30 transition-colors">
            <i className="fa-solid fa-chevron-right text-[9px]" />
          </button>
          </div>
        </div>
      </div>
    </>
  );
});

DealsTable.displayName = 'DealsTable';
export default DealsTable;
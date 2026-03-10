import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Quote, ClientCompany, ClientContact, QuoteStatus } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG } from '../../services/gatewayConfig';
import Toast from '../../components/Toast';
import ShareModal from '../../components/ShareModal';
import ConfirmModal from '../../components/ConfirmModal';
import { BrandSpinner } from '../../components/AppLoaders';
import Avatar from '../../components/Avatar';
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
  FilterFn,
  Updater
} from '@tanstack/react-table';

const GROUP_OPTIONS = [
  { id: 'id_quote_status', label: 'Estado', icon: 'fa-list-check' },
  { id: 'client_company_name', label: 'Cliente', icon: 'fa-building' }
] as const;

const VALID_GROUP_IDS = ['id_quote_status', 'client_company_name'];

const normalizeQuote = (quote: any): Quote => {
  const archived =
    typeof quote?.archived === 'boolean'
      ? quote.archived
      : typeof quote?.archivado === 'boolean'
        ? quote.archivado
        : false;

  return {
    ...quote,
    archived,
  } as Quote;
};

const normalizeQuotesList = (list: any): Quote[] => {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeQuote(item));
};

// --- UTILS & FILTERS ---
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  const { start, end } = value as { start: string; end: string };
  let rowDate = row.getValue(columnId) as string;
  if (!rowDate) return false;
  
  // Extraer solo la parte de fecha (YYYY-MM-DD)
  let date: string;
  if (rowDate.includes('T')) {
    // Formato ISO: 2024-03-03T12:00:00
    date = rowDate.split('T')[0];
  } else if (rowDate.includes(' ')) {
    // Formato con espacio: 2024-03-03 12:00:00
    date = rowDate.split(' ')[0];
  } else if (rowDate.includes('/')) {
    // Formato con barras: 03/03/2024 -> convertir a YYYY-MM-DD
    const parts = rowDate.split('/');
    if (parts.length === 3) {
      // Asumiendo formato DD/MM/YYYY o MM/DD/YYYY
      try {
        const d = new Date(rowDate);
        date = d.toISOString().split('T')[0];
      } catch {
        return false;
      }
    } else {
      return false;
    }
  } else {
    date = rowDate;
  }
  
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

  let parsedDate: Date | null = null;

  // Formato DD/MM/YYYY o DD/MM/YYYY HH:mm
  if (value.includes('/')) {
    const [datePart] = value.split(' ');
    const [dayStr, monthStr, yearStr] = datePart.split('/');
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);

    if (day && month && year) {
      parsedDate = new Date(year, month - 1, day);
    }
  }

  // Formatos ISO o compatibles con Date
  if (!parsedDate) {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) {
      parsedDate = d;
    }
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const weekday = new Intl.DateTimeFormat('es-EC', { weekday: 'short' })
    .format(parsedDate)
    .replace('.', '')
    .toLowerCase();

  const datePart = new Intl.DateTimeFormat('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
    .format(parsedDate)
    .replace('.', '')
    .toLowerCase();

  return `${weekday}, ${datePart}`;
};

// --- HELPER PARA CELDA DE GRUPO (Actualizado) ---
const renderGroupCell = (row: any, label: string, statuses: QuoteStatus[] = []) => {
  // Calcular subtotal del grupo
  const subtotal = row.subRows.reduce((sum: number, subRow: any) => {
    const value = parseFloat(String(subRow.original?.total || 0));
    return sum + value;
  }, 0);

  const colId = row.groupingColumnId;
  let color: string | undefined;
  let icon: string | undefined;

  if (colId === 'id_quote_status') {
    const statusById = statuses.find((s) => String(s.id_status) === String(label));
    const statusByName = statuses.find((s) => s.name?.toUpperCase() === String(label || '').toUpperCase());
    const matched = statusById || statusByName;
    color = matched?.color;
    icon = matched?.icon;
    label = matched?.name || label;
  }

  return (
    <div className="flex items-center gap-2.5">
      <i className={`fa-solid fa-chevron-right text-slate-400 text-[10px] transition-transform duration-150 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>

      {color ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>
          {icon && <i className={`${icon} text-[9px]`} />}
          {label || 'Sin asignar'}
        </span>
      ) : (
        <span className="font-semibold text-slate-700 text-xs">{label || 'Sin asignar'}</span>
      )}

      <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">{row.subRows.length}</span>

      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-800">
        {subtotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </span>
    </div>
  );
};

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
              className={`inline-flex items-center justify-between gap-1.5 px-2 py-0.5 min-h-[20px] rounded text-[10px] font-semibold transition-all whitespace-nowrap ${disabled ? 'cursor-default' : 'hover:opacity-90 cursor-pointer'}`}
              style={{ backgroundColor: current?.color || '#94a3b8', color: '#ffffff' }}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                {current?.icon && (
                  <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
                    <i className={`${current.icon} text-[9px] leading-none`}></i>
                  </span>
                )}
                <span className="truncate">{current?.name || '—'}</span>
              </span>
              {!disabled && (
                <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-1 opacity-60">
                  <i className="fa-solid fa-chevron-down text-[7px] leading-none"></i>
                </span>
              )}
            </button>
            {isOpen && (
                <div 
                    onMouseLeave={() => setIsOpen(false)}
                className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
                >
                <div className="max-h-64 overflow-y-auto py-1">
                    {/* Estados arriba del actual */}
                    {itemsAbove.length > 0 && (
                  <div>
                            {itemsAbove.map(item => (
                                <button
                                    key={item.id}
                                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                        className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
                                >
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color || '#94a3b8' }}>
                          <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`}></i>
                                    </div>
                        <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {/* Estado actual (deshabilitado) */}
                <div className="bg-slate-50 border-y border-slate-100 px-3 py-1.5">
                  <div className="w-full flex items-center gap-2 opacity-50 cursor-not-allowed">
                    <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: current?.color || '#94a3b8' }}>
                      <i className={`${current?.icon || 'fa-solid fa-tag'} text-[8px] text-white`}></i>
                            </div>
                    <span className="text-[11px] font-medium text-slate-700">{current?.name || '—'}</span>
                            <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400"></i>
                        </div>
                    </div>
                    
                    {/* Estados abajo del actual */}
                    {itemsBelow.length > 0 && (
                  <div>
                            {itemsBelow.map(item => (
                                <button
                                    key={item.id}
                                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
                        className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
                                >
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color || '#94a3b8' }}>
                          <i className={`${item.icon || 'fa-solid fa-tag'} text-[8px] text-white`}></i>
                                    </div>
                        <span className="text-[11px] font-medium text-slate-700">{item.name}</span>
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

const QuoteActionsMenu: React.FC<{
  quote: Quote;
  user: any;
  onEdit: (quote: Quote) => void;
  onShare: (quote: Quote) => void;
  onArchive: (quote: Quote) => void;
  onDelete: (id: string) => void;
}> = ({ quote, user, onEdit, onShare, onArchive, onDelete }) => {
  const HOVER_CLOSE_DELAY_MS = 550;
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const canEdit = canUserAction(user, quote, 'edit');
  const canDelete = canUserAction(user, quote, 'delete');
  const canShare = canUserAction(user, quote, 'share');
  const canArchive = canUserAction(user, quote, 'archive');

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    clearCloseTimer();
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuH = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuH ? rect.top - menuH - 4 : rect.bottom + 4;
    setMenuStyle({ position: 'fixed', top, left: rect.left, zIndex: 9999 });
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={() => {
          if (isOpen) scheduleClose();
        }}
        onClick={openMenu}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0"
        title="Opciones"
      >
        <i className="fa-solid fa-ellipsis-vertical text-[11px]" />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-sm"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onEdit(quote);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
            >
              <i className="fa-solid fa-pen text-slate-400 w-3.5" /> Editar
            </button>
          )}
          {canShare && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onShare(quote);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
            >
              <i className="fa-solid fa-user-plus text-slate-400 w-3.5" /> Compartir
            </button>
          )}
          {canArchive && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onArchive(quote);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
            >
              <i className={`fa-solid ${(quote as any).archived ? 'fa-box-open' : 'fa-box-archive'} text-slate-400 w-3.5`} />
              {(quote as any).archived ? 'Desarchivar' : 'Archivar'}
            </button>
          )}
          {canDelete && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onDelete(quote.id_cotizacion);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2.5 text-xs transition-colors"
              >
                <i className="fa-solid fa-trash text-red-400 w-3.5" /> Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

const ToolbarGroupDropdown: React.FC<{
  grouping: string[];
  onGroupingChange: (g: string[]) => void;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  onGlobalFilterChange: (v: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onNew: () => void;
  onClearFilters: () => void;
}> = ({ grouping, onGroupingChange, columnFilters, globalFilter, onGlobalFilterChange, showArchived, onToggleArchived, onNew, onClearFilters }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasActiveGroup = grouping.length > 0;
  const hasActiveFilters = columnFilters.length > 0;
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
      <div className="relative flex-1 min-w-0">
        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none" />
        <input
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          placeholder="Buscar cotizacion…"
          className="w-full pl-8 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white placeholder:text-slate-300 text-slate-700 transition-all"
        />
        {globalFilter && (
          <button
            onClick={() => onGlobalFilterChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        )}
      </div>

      <div
        className="relative flex-shrink-0"
        ref={ref}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={() => {
          if (open && canUseHoverClose()) scheduleClose();
        }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className={`
            relative flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-md border text-sm sm:text-xs font-medium transition-all whitespace-nowrap
            ${open ? 'bg-slate-50 border-slate-300 text-slate-700' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}
          `}
        >
          <i className="fa-solid fa-layer-group text-[11px] sm:text-[10px]" />
          <span className="inline">Agrupar</span>
          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          {activeConfigCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center leading-none border-2 border-white">
              {activeConfigCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-full mt-1.5 right-0 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl shadow-[0_10px_24px_rgba(15,23,42,0.12)] py-1 z-50 w-60 max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto">
            <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Agrupado por</p>

            {GROUP_OPTIONS.map((opt) => {
              const isActive = grouping.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onGroupingChange(isActive ? [] : [opt.id]);
                    setOpen(false);
                  }}
                  className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left ${
                    isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <i className={`fa-solid ${opt.icon} text-[11px] sm:text-[10px] w-3.5 text-center ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                  {opt.label}
                  {isActive && <i className="fa-solid fa-check text-[9px] ml-auto text-blue-400" />}
                </button>
              );
            })}

            <button
              onClick={() => {
                onGroupingChange([]);
                setOpen(false);
              }}
              className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left ${
                hasActiveGroup ? 'text-red-600 bg-red-50 hover:bg-red-100/70' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid fa-xmark text-[11px] sm:text-[10px] w-3.5 text-center ${hasActiveGroup ? 'text-red-500' : 'text-slate-400'}`} />
              Sin agrupar
              {!hasActiveGroup && <i className="fa-solid fa-check text-[9px] ml-auto text-slate-400" />}
            </button>

            {hasActiveFilters && (
              <>
                <div className="border-t border-slate-100 mt-1.5 pt-1.5" />
                <button
                  onClick={() => {
                    onClearFilters();
                    setOpen(false);
                  }}
                  className="w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs text-slate-600 hover:bg-slate-50 rounded-md transition-colors text-left"
                >
                  <i className="fa-solid fa-filter text-[10px] w-3.5 text-center text-slate-400" />
                  <span>Limpiar {columnFilters.length} filtro{columnFilters.length > 1 ? 's' : ''}</span>
                </button>
              </>
            )}

            <div className="border-t border-slate-100 mt-1.5 pt-1.5" />
            <p className="px-2.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Opciones</p>

            <button
              onClick={() => {
                onToggleArchived();
                setOpen(false);
              }}
              className={`w-full h-8 flex items-center gap-2 px-2.5 text-sm sm:text-xs rounded-md transition-colors text-left ${
                showArchived ? 'text-amber-700 bg-amber-50 hover:bg-amber-100/70 font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid fa-box-archive text-[11px] sm:text-[10px] w-3.5 text-center ${showArchived ? 'text-amber-500' : 'text-slate-400'}`} />
              {showArchived ? 'Viendo archivadas' : 'Ver archivadas'}
              {showArchived && <i className="fa-solid fa-check text-[9px] ml-auto text-amber-500" />}
            </button>

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
        )}
      </div>

      <button
        onClick={onNew}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-800 text-white rounded-md text-sm sm:text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
      >
        <i className="fa-solid fa-plus text-[11px] sm:text-[10px]" />
        <span className="inline">Nueva cotizacion</span>
      </button>
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const saved = localStorage.getItem('quotesListColumnFilters');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    const saved = localStorage.getItem('quotesList_grouping');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((id: string) => VALID_GROUP_IDS.includes(id)) : [];
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const saved = localStorage.getItem('quotesListExpanded');
    return saved ? JSON.parse(saved) : {};
  });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [showArchived, setShowArchived] = useState(false);

  // --- UI STATE ---
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- MODALS ---
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState<string | null>(null);
  const [shareQuote, setShareQuote] = useState<Quote | null>(null);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; isDestructive?: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

  // --- FETCH DATA ---
  const fetchData = useCallback(async (force = false) => {
    if (!user?.id_tenant || !user?.id_user) return;

    const cacheKey = `quotes_list_cache_${user.id_user}_${showArchived ? 'archived' : 'active'}`;
    const now = Date.now();
    const cacheTtlMs = 2 * 60 * 1000; // 2 minutos

    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.timestamp && now - parsed.timestamp < cacheTtlMs && Array.isArray(parsed?.quotes)) {
            setQuotes(parsed.quotes);
            setMetadata(parsed.metadata || null);
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
      let quotesRes = await apiFetch(showArchived ? GATEWAY_CONFIG.API.QUOTES.ARCHIVED_LIST : GATEWAY_CONFIG.API.QUOTES.LIST);
      let usingArchivedFallback = false;

      if (!quotesRes.ok && showArchived) {
        quotesRes = await apiFetch(GATEWAY_CONFIG.API.QUOTES.LIST);
        usingArchivedFallback = true;
      }

      if (!quotesRes.ok && quotesRes.status !== 404) throw new Error('Error al cargar cotizaciones');
      
      const text = await quotesRes.text();
      const data = text ? JSON.parse(text) : null;
      
      // Estructuras soportadas:
      // - [{ response: { quotes: [...], metadata: {...} } }]
      // - [{ response: { quotes_archivadas: [...], metadata?: {...} } }]
      // - { quotes: [...], metadata: {...} }
      // - { quotes_archivadas: [...], metadata?: {...} }
      if (Array.isArray(data) && data[0]?.response) {
        const response = data[0].response;
        const sourceQuotes = response.quotes ?? response.quotes_archivadas ?? [];
        const nextQuotes = normalizeQuotesList(sourceQuotes);
        const filteredQuotes = usingArchivedFallback
          ? nextQuotes.filter((q) => (showArchived ? q.archived === true : q.archived !== true))
          : nextQuotes;
        setQuotes(filteredQuotes);
        const nextMetadata = response.metadata || metadata || null;
        setMetadata(nextMetadata);
        localStorage.setItem(cacheKey, JSON.stringify({ quotes: filteredQuotes, metadata: nextMetadata, timestamp: now }));
      } else if ((data?.quotes || data?.quotes_archivadas) && (data?.metadata || metadata)) {
        // Fallback: { quotes: [...], metadata?: {...} } o { quotes_archivadas: [...], metadata?: {...} }
        const sourceQuotes = data.quotes ?? data.quotes_archivadas ?? [];
        const nextQuotes = normalizeQuotesList(sourceQuotes);
        const filteredQuotes = usingArchivedFallback
          ? nextQuotes.filter((q) => (showArchived ? q.archived === true : q.archived !== true))
          : nextQuotes;
        setQuotes(filteredQuotes);
        const nextMetadata = data.metadata || metadata || null;
        setMetadata(nextMetadata);
        localStorage.setItem(cacheKey, JSON.stringify({ quotes: filteredQuotes, metadata: nextMetadata, timestamp: now }));
      } else if (Array.isArray(data)) {
        // Fallback: array directo
        const nextQuotes = normalizeQuotesList(data);
        const filteredQuotes = usingArchivedFallback
          ? nextQuotes.filter((q) => (showArchived ? q.archived === true : q.archived !== true))
          : nextQuotes;
        setQuotes(filteredQuotes);
        localStorage.setItem(cacheKey, JSON.stringify({ quotes: filteredQuotes, metadata: null, timestamp: now }));
      }

      if (usingArchivedFallback) {
        setToast({ message: 'Vista de archivadas en modo compatibilidad (filtro local).', type: 'success' });
      }

    } catch (e) {
      console.error('Error al cargar cotizaciones:', e);
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id_tenant, user?.id_user, showArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Guardar estado de agrupación en localStorage y limpiar expanded cuando cambia
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem('quotesList_grouping', JSON.stringify(grouping));
    // Limpiar el estado expandido cuando cambia el agrupamiento (no en el primer render)
    setExpanded({});
    localStorage.setItem('quotesListExpanded', JSON.stringify({}));
  }, [grouping]);

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('quotesListColumnFilters', JSON.stringify(columnFilters));
  }, [columnFilters]);

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
        // Manejo especial para collaborators (array de objetos)
        if (columnId === 'collaborators') {
            const collaborators = (quote as any).collaborators || [];
            if (collaborators.length === 0) {
                counts.set('Sin asignar', (counts.get('Sin asignar') || 0) + 1);
            } else {
                collaborators.forEach((collab: any) => {
                    const user = users.find((u: any) => u.id_user === collab.id);
                    const userName = user?.name_user || 'Usuario';
                    counts.set(userName, (counts.get(userName) || 0) + 1);
                });
            }
            return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        }

        // Para la columna de cliente, agregar empresas y contactos con prefijos
        if (columnId === 'client_company_name') {
            const comp = (quote as any).client_company_name || '(Vacío)';
            const contact = (quote as any).contact_full_name || 'Sin contacto';
            
            // Agregar empresa con prefijo
            const companyKey = `🏢 ${comp}`;
            counts.set(companyKey, (counts.get(companyKey) || 0) + 1);
            
            // Agregar contacto con prefijo
            const contactKey = `👤 ${contact}`;
            counts.set(contactKey, (counts.get(contactKey) || 0) + 1);
            return; // continuar con siguiente cotización
        }
        
        let val = (quote as any)[columnId];
        
        // Manejo especial para id_quote_status
        if (columnId === 'id_quote_status') {
            const status = (metadata?.statuses || []).find(s => s.id_status === val);
            val = status ? status.name : 'Desconocido';
        }
        
        if (!val) val = '(Vacío)';
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
          fetchData(true); 
      } catch {
          setToast({ message: 'Error al actualizar.', type: 'error' });
          fetchData(true); 
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
            fetchData(true);
        } catch {
            setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
            setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleArchive = (quote: Quote) => {
    const nextArchived = !Boolean((quote as any).archived);
    setConfirmState({
      isOpen: true,
      title: nextArchived ? 'Archivar Cotización' : 'Desarchivar Cotización',
      message: nextArchived
        ? 'La cotización se moverá a archivadas. ¿Deseas continuar?'
        : 'La cotización volverá a activas. ¿Deseas continuar?',
      onConfirm: async () => {
        try {
          const res = await apiFetch(GATEWAY_CONFIG.API.QUOTES.ARCHIVED, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cotizacion: quote.id_cotizacion,
              id_tenant: user?.id_tenant,
              id_user: user?.id_user,
              archived: nextArchived,
            }),
          });

          if (!res.ok) throw new Error('archive-failed');
          setToast({ message: nextArchived ? 'Cotización archivada.' : 'Cotización desarchivada.', type: 'success' });
          fetchData(true);
        } catch {
          setToast({ message: 'No se pudo actualizar el archivado.', type: 'error' });
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // --- COLUMNS DEFINITION ---
  const columns = useMemo<ColumnDef<Quote>[]>(() => [
    {
        accessorKey: 'id_quote_status',
        header: 'Estado',
      size: 190,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            // CORRECCIÓN: Renderizar cabecera de grupo solo si estamos agrupando por estado
            if (row.getIsGrouped()) {
                if (grouping.includes(column.id)) {
                    const status = (metadata?.statuses || []).find(s => String(s.id_status) === String(getValue()));
                    return renderGroupCell(row, status?.name || String(getValue() || 'Desconocido'), metadata?.statuses || []);
                }
                return null;
            }
            return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <QuoteActionsMenu
            quote={row.original}
            user={user}
            onEdit={(quote) => navigate(`/app/quotes/edit?id=${quote.id_cotizacion}`)}
            onShare={openShareModal}
            onArchive={handleArchive}
            onDelete={handleDelete}
            />
            <InlineBadgeSelector 
              valueId={getValue() as number}
              items={(metadata?.statuses || []).map(s => ({ id: s.id_status, name: s.name, color: s.color, icon: s.icon }))}
              onSelect={(id) => handleInlineUpdate(row.original, { id_quote_status: String(id) })}
              disabled={!canEditInline(user, row.original)}
            />
          </div>
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
      cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-slate-700 text-sm font-medium">{getValue() as string}</span>
    },
    {
        accessorKey: 'nombre_cotizacion',
        header: 'Nombre',
        size: 200,
        minSize: 150,
        maxSize: 250,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => {
            if (row.getIsGrouped()) return null;
            const nombre = getValue() as string;
            return (
                <div className="overflow-hidden" style={{ maxWidth: '250px' }}>
                    <span 
                className="text-slate-800 text-sm font-medium block truncate" 
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
      filterFn: (row, columnId, filterValue: string[]) => {
        if (filterValue.length === 0) return true;
        const companyName = row.getValue(columnId) as string;
        const contactName = row.original.contact_full_name || 'Sin contacto';
        
        return filterValue.some(val => {
          // Remover prefijos de emoji para comparar
          const cleanVal = val.replace(/^(🏢|👤)\s/, '');
          return (companyName && companyName.toLowerCase() === cleanVal.toLowerCase())
              || (contactName && contactName.toLowerCase() === cleanVal.toLowerCase());
        });
      },
      cell: ({ row, getValue, column }) => {
        // CORRECCIÓN PRINCIPAL: Solo renderizar grupo si ESTA columna es la agrupada
        if (row.getIsGrouped()) {
            return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string || 'Sin Cliente', metadata?.statuses || []) : null;
        }
        const companyName = getValue() as string;
        const contactName = row.original.contact_full_name || 'Sin contacto';
        return (
            <div className="flex flex-col gap-0" style={{ maxWidth: 180 }}>
                <span className="text-[13px] leading-tight text-slate-800 font-semibold truncate" title={companyName}>{companyName}</span>
                {contactName && <span className="text-[10px] leading-tight text-slate-600 truncate" title={contactName}>{contactName}</span>}
            </div>
        );
      }
    },
    {
        accessorKey: 'total',
        header: 'Total',
        size: 120,
        enableColumnFilter: false,
        // CORRECCIÓN: Retornar null si es grupo
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50">
            <span className="text-[11px] sm:text-[12px] font-semibold text-slate-800 whitespace-nowrap">
              {formatCurrency(getValue() as string)}
            </span>
          </span>
        )
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
                return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string || 'Sin Colaboradores', metadata?.statuses || []) : null;
            }
            
            const collaborators = (row.original as any).collaborators || [];
            if (collaborators.length === 0) return <span className="text-xs text-slate-300">-</span>;
            
            // Ordenar: Creador primero, luego Principal (EDIT), luego Secundario (VIEW)
            const sorted = [...collaborators].sort((a, b) => {
                if (a.is_owner !== b.is_owner) return b.is_owner ? 1 : -1;
                const levelOrder = { EDIT: 1, VIEW: 2, BLOCKED: 3 };
                return (levelOrder[a.access_level as keyof typeof levelOrder] || 3) - (levelOrder[b.access_level as keyof typeof levelOrder] || 3);
            });
            
            return (
              <div className="flex items-center gap-1 h-8 leading-none" onClick={(e) => e.stopPropagation()}>
                {sorted.slice(0, 4).map((collab: any, idx: number) => {
                        const user = users.find(u => u.id_user === collab.id);
                      const userName = user?.name_user || collab?.name || collab?.email || 'Usuario';
                      const userAvatar = user?.avatar_url || (user as any)?.avatar || collab?.avatar_url || collab?.avatar || null;
                        const isOwner = collab.is_owner;
                        const isPrincipal = collab.access_level === 'EDIT' && !isOwner;
                        const isSecondary = collab.access_level === 'VIEW';
                        
                        let badgeType: 'OWNER' | 'EDIT' | 'VIEW' = 'VIEW';
                        let tooltipLevel = '';
                        
                        if (isOwner) {
                            badgeType = 'OWNER';
                            tooltipLevel = 'Creador';
                        } else if (isPrincipal) {
                            badgeType = 'EDIT';
                            tooltipLevel = 'Principal';
                        } else if (isSecondary) {
                            badgeType = 'VIEW';
                            tooltipLevel = 'Secundario';
                        }
                        
                        return (
                          <div key={collab.id || idx} className="inline-flex items-center">
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
      accessorKey: 'fecha_emision',
      header: 'Emisión',
      size: 150,
      minSize: 150,
      maxSize: 150,
      filterFn: dateRangeFilter,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const fecha = row.original.fecha_emision_fmt || row.original.fecha_emision;
        return <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateTime(fecha)}</span>;
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Creado',
      size: 150,
      minSize: 150,
      maxSize: 150,
      enableColumnFilter: true,
      filterFn: dateRangeFilter,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const fecha = row.original.created_at_fmt || row.original.created_at;
        return <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateTime(fecha)}</span>;
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
        const inactiveText = row.original.inactive_time_text;
        if (days === undefined || days === null) {
          return <span className="text-xs text-slate-300">{inactiveText || '-'}</span>;
        }

        let color = 'text-slate-400';
        const fallbackText = days === 0 ? 'Al dia' : `${days}d`;
        if (days === 0)       color = 'text-emerald-500';
        else if (days > 30)   color = 'text-red-500';
        else if (days > 15)   color = 'text-orange-400';
        else if (days > 7)    color = 'text-amber-400';
        else                  color = 'text-emerald-400';

        const text = inactiveText || fallbackText;
        return <span className={`text-xs font-medium ${color}`}>{text}</span>;
      }
    }
  ], [grouping, metadata, users, user]);

  const table = useReactTable({
    data: quotes,
    columns,
    paginateExpandedRows: false,
    state: { sorting, columnFilters, globalFilter, grouping, expanded, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: (updater) => {
      const nextGrouping = applyUpdater(updater, grouping);
      setGrouping(nextGrouping);
      const groupedBy = nextGrouping[0];
      if (groupedBy && sorting.length === 0) {
        setSorting([{ id: groupedBy, desc: false }]);
      }
    },
    onExpandedChange: (updater) => {
      setExpanded((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('quotesListExpanded', JSON.stringify(next));
        return next;
      });
    },
    onPaginationChange: setPagination,
    autoResetExpanded: false,
    groupedColumnMode: false,
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

  const filteredRows = table.getFilteredRowModel().rows;
  const totalFiltered = useMemo(() => filteredRows.reduce((s, r) => s + (r.getIsGrouped() ? 0 : parseFloat(String(r.original.total || 0))), 0), [filteredRows]);
  const totalRows = useMemo(() => filteredRows.filter((r) => !r.getIsGrouped()).length, [filteredRows]);
  const applyUpdater = <T,>(updater: Updater<T>, current: T): T => {
    return typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;
  };
  const handleClearFilters = useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter('');
  }, []);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans text-slate-700">
      <ToolbarGroupDropdown
        grouping={grouping as string[]}
        onGroupingChange={(g) => setGrouping(g as GroupingState)}
        columnFilters={columnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((prev) => !prev)}
        onNew={() => navigate('/app/quotes/new')}
        onClearFilters={handleClearFilters}
      />

      <div className="flex-1 overflow-auto relative bg-white">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-30">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const isDate = header.column.id === 'fecha_emision' || header.column.id === 'created_at';
                  
                  return (
                    <th key={header.id} style={{ width: header.getSize() }} className="border-b border-slate-200 bg-white px-4 py-2 text-left relative">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {{ asc: <i className="fa-solid fa-sort-up text-slate-400 text-[9px]" />, desc: <i className="fa-solid fa-sort-down text-slate-400 text-[9px]" /> }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {header.column.id !== 'actions' && header.column.columnDef.enableColumnFilter !== false && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isFiltered ? 'text-slate-500 bg-slate-200' : 'text-slate-300 hover:text-slate-500'}`}
                          >
                            <i className={`fa-solid ${isDate ? 'fa-calendar-days' : 'fa-filter'} text-[9px]`}></i>
                          </button>
                        )}
                      </div>

                      {activeFilterMenu === header.column.id && (
                        <div 
                          ref={filterMenuRef} 
                          onMouseLeave={() => setActiveFilterMenu(null)}
                          className="absolute top-full left-0 mt-1 w-60 bg-white shadow-lg rounded-lg border border-slate-200 z-50 py-2"
                        >
                          {isDate ? (
                            <div className="px-3 space-y-2">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Rango de fechas</p>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Desde</label>
                                <input
                                  type="date"
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300"
                                  onChange={e => {
                                    const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                    header.column.setFilterValue({ ...val, start: e.target.value });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Hasta</label>
                                <input
                                  type="date"
                                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300"
                                  onChange={e => {
                                    const val = (columnFilters.find(f => f.id === header.column.id)?.value as any) || { start: '', end: '' };
                                    header.column.setFilterValue({ ...val, end: e.target.value });
                                  }}
                                />
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
                                            {isChecked && <i className="fa-solid fa-check text-[7px] text-white"></i>}
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
                              <button onClick={() => header.column.setFilterValue(undefined)} className="text-[10px] text-red-400 hover:text-red-600 font-medium">Limpiar filtro</button>
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
            {grouping.length > 0 && (
              <tr className="bg-slate-50 border-b border-slate-100">
                <td colSpan={columns.length} className="px-4 py-0.5">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button onClick={() => setExpanded(true)} className="text-slate-400 hover:text-slate-700 transition-colors leading-none">expandir</button>
                    <span className="text-slate-300">/</span>
                    <button onClick={() => setExpanded({})} className="text-slate-400 hover:text-slate-700 transition-colors leading-none">contraer</button>
                  </div>
                </td>
              </tr>
            )}
            {loading ? (
              <tr><td colSpan={columns.length} className="py-24 text-center"><BrandSpinner size="lg" /></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <i className="fa-regular fa-file-lines text-4xl text-slate-300"></i>
                      <p className="font-bold text-slate-600">{showArchived ? 'No hay cotizaciones archivadas' : 'No hay cotizaciones aún'}</p>
                      <p className="text-sm text-slate-400">{showArchived ? 'Puedes archivar cotizaciones desde el menú de acciones.' : 'Crea tu primera cotización para visualizarla aquí.'}</p>
                      {!showArchived && <button onClick={() => navigate('/app/quotes/new')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all text-sm font-bold">Crear cotización</button>}
                    </div>
                  </td>
                </tr>
            ) : table.getRowModel().rows.map(row => {
                const isGrouped = row.getIsGrouped();
                const handleRowClick = () => {
                    if (isGrouped) row.toggleExpanded();
                    else navigate(`/app/quotes/${row.original.id_cotizacion}`);
                };

                return (
                    <tr 
                        key={row.id} 
                        onClick={handleRowClick}
                        className={`
                            ${isGrouped 
                            ? 'bg-slate-50 hover:bg-slate-100 cursor-pointer' 
                            : 'bg-white hover:bg-blue-50/70 group cursor-pointer'} 
                            border-b border-slate-100 transition-colors
                        `}
                    >
                        {isGrouped ? (
                            <td colSpan={row.getVisibleCells().length} className="px-4 py-1">
                                {(() => {
                                  const groupedCell = row.getVisibleCells().find(
                                    (cell) => cell.column.id === row.groupingColumnId
                                  );
                                  const rawLabel = groupedCell ? groupedCell.getValue() : '';
                                  const label = rawLabel === null || rawLabel === undefined || rawLabel === ''
                                    ? 'Sin asignar'
                                    : String(rawLabel);
                                  return renderGroupCell(row, label, metadata?.statuses || []);
                                })()}
                            </td>
                        ) : (
                            row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="px-4 py-1 align-middle">
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

      <div className="border-t border-slate-100 px-3 py-2.5 bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs text-slate-600 min-w-0">
              <span className="font-semibold shrink-0">{totalRows} registros</span>
              <div className="inline-flex items-center justify-between sm:justify-start gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 min-w-0 w-[190px] sm:w-auto">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</span>
                <span className="text-[11px] sm:text-[12px] font-semibold text-slate-800">
                  {totalFiltered.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end sm:justify-start gap-1 text-xs text-slate-600 shrink-0">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
              <span className="px-2 py-0.5 text-[11px] font-semibold text-slate-700">{table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
            </div>
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
            fetchData(true); // Refrescar datos después de cambiar permisos
          }}
          currentCollaborators={shareCollaborators}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default QuotesList;

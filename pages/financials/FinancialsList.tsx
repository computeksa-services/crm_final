import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrandSpinner } from '../../components/AppLoaders';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { financialService } from '../../services/financials.service';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import CollectionModal from '../../components/CollectionModal';
import AppModalViewport from '../../components/AppModalViewport';
import type { FinancialTransaction } from '../../types';
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

// --- TIPOS ADICIONALES ---
type KpiSummary = { ventasMes: number; porCobrarTotal: number; vencidoTotal: number; cobradoMes: number; };
type YearWithMonths = { year: number; months_available: { month: number; count: number }[]; };

// --- HELPERS ---
const formatDateDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '-';
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
};

const normalizeTransactionType = (value: any): FinancialTransaction['transaction_type'] => {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'VENTA') return 'VENTA';
    if (raw === 'COMPRA' || raw === 'GASTO') return 'GASTO';
    return 'OTRO';
};

const deriveBalanceDue = (rawBalance: any, totalValue: any, paidAmount: any) => {
    const explicitBalance = Number(rawBalance);
    if (!Number.isNaN(explicitBalance) && rawBalance !== null && rawBalance !== undefined && rawBalance !== '') {
        return Math.max(explicitBalance, 0);
    }
    return Math.max(Number(totalValue || 0) - Number(paidAmount || 0), 0);
};

// Función de filtro de rango de fechas para TanStack Table
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
    const { start, end } = value as { start: string; end: string };
    const cellValue = row.getValue(columnId) as string;
    if (!cellValue) return false;
    // Normalizar a YYYY-MM-DD para comparar strings
    let dateStr = cellValue;
    if (cellValue.includes('/')) {
        const [d, m, y] = cellValue.split('/');
        dateStr = `${y}-${m}-${d}`;
    }
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
};

// --- COMPONENTES UI ---

const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
  return isNaN(num) ? '$0.00' : num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// 1. KPI Card (Diseño compacto)
const KpiCard: React.FC<{ title: string; value: number; icon: string; color: 'blue' | 'green' | 'red' | 'orange'; subtext?: string; }> = ({ title, value, icon, color, subtext }) => {
    const styles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
    orange: 'bg-amber-50 text-amber-600',
    };
    return (
    <div className="bg-white flex flex-col p-3 md:p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-default min-w-0 h-full">
      <div className="flex items-center gap-3 mb-2 min-w-0">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${styles[color]}`}>
          <i className={`fa-solid ${icon} text-sm md:text-base`}></i>
        </div>
        <p className="text-xl md:text-2xl font-bold text-slate-800 truncate">{formatCurrency(value)}</p>
            </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-slate-500 font-medium truncate">{title}</span>
        {subtext && <span className="text-[11px] text-slate-400 truncate">{subtext}</span>}
            </div>
        </div>
    );
};

// 2. Selector de Año y Mes (Mejorado)
const DateRangeSelector: React.FC<{ availableList: YearWithMonths[], selectedYear: number; selectedMonth: number; onChange: (start: string, end: string) => void; onYearChange: (year: number) => void; onMonthChange: (month: number) => void; }> = ({ availableList, selectedYear, selectedMonth, onChange, onYearChange, onMonthChange }) => {
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const monthMenuRef = useRef<HTMLDivElement>(null);
    const currentYearData = availableList.find(y => y.year === selectedYear);
    const monthsForYear = currentYearData?.months_available || [];
    
    // Ordenar meses descendentemente (más recientes primero)
    const sortedMonths = [...monthsForYear].sort((a, b) => b.month - a.month);
    
    // Obtener el primer mes disponible para el año seleccionado
    const firstMonthForYear = sortedMonths[0]?.month;
    
    // Usar selectedMonth si existe en los meses disponibles, sino usar el primero disponible
    const monthToUse = sortedMonths.some(m => m.month === selectedMonth) ? selectedMonth : firstMonthForYear;
    
    const handleYearChange = (year: number) => {
        // Obtener meses del año seleccionado
        const yearData = availableList.find(y => y.year === year);
        const months = yearData?.months_available || [];
        const sorted = [...months].sort((a, b) => b.month - a.month);
        
        // Usar el primer mes disponible del nuevo año
        const firstMonth = sorted[0]?.month;
        
        if (firstMonth) {
            // Establecer año y mes
            onYearChange(year);
            const start = new Date(year, firstMonth-1, 1).toISOString().split('T')[0];
            const end = new Date(year, firstMonth, 0).toISOString().split('T')[0];
            onMonthChange(firstMonth);
            onChange(start, end);
        }
    };
    
    const handleMonthSelect = (month: number) => {
        const start = new Date(selectedYear, month-1, 1).toISOString().split('T')[0];
        const end = new Date(selectedYear, month, 0).toISOString().split('T')[0];
        onMonthChange(month);
        onChange(start, end);
      setIsMonthMenuOpen(false);
    };

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (yearMenuRef.current && !yearMenuRef.current.contains(e.target as Node)) {
          setIsYearMenuOpen(false);
        }
        if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
          setIsMonthMenuOpen(false);
        }
      };
      if (isMonthMenuOpen || isYearMenuOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMonthMenuOpen, isYearMenuOpen]);

    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const selectedMonthData = sortedMonths.find(m => m.month === monthToUse);
    
    return (
      <div className="flex items-center gap-1.5 bg-white h-8 px-2 rounded-md border border-slate-200">
            {/* Selector de Año */}
            <div className="relative" ref={yearMenuRef}>
              <button
                type="button"
                onClick={() => setIsYearMenuOpen(v => !v)}
                className="h-6 px-1.5 text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer inline-flex items-center gap-1.5 border-r border-slate-200 pr-2"
              >
                <span>{selectedYear}</span>
                <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform ${isYearMenuOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isYearMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-24 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                  {availableList.map(y => {
                    const isActive = y.year === selectedYear;
                    return (
                      <button
                        key={y.year}
                        type="button"
                        onClick={() => {
                          handleYearChange(y.year);
                          setIsYearMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {y.year}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Selector de Mes con count circular */}
            <div className="relative" ref={monthMenuRef}>
              <button
                type="button"
                onClick={() => setIsMonthMenuOpen(v => !v)}
                disabled={sortedMonths.length === 0}
                className="h-6 px-1.5 text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="lowercase">{selectedMonthData ? monthNames[selectedMonthData.month - 1] : 'sin meses'}</span>
                {selectedMonthData && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {selectedMonthData.count}
                  </span>
                )}
                <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform ${isMonthMenuOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isMonthMenuOpen && sortedMonths.length > 0 && (
                <div className="absolute top-full right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                  {sortedMonths.map(m => {
                    const isActive = m.month === monthToUse;
                    return (
                      <button
                        key={`${selectedYear}-${m.month}`}
                        type="button"
                        onClick={() => handleMonthSelect(m.month)}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <span className="text-xs font-semibold lowercase">{monthNames[m.month - 1]}</span>
                        <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {m.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
    );
}

// 3. Selector Inline (Estilo QuotesList)
const STATUS_OPTIONS = [
  { val: 'PENDIENTE', label: 'Pendiente', color: '#f59e0b', icon: 'fa-solid fa-clock' },
  { val: 'PAGADO', label: 'Pagado', color: '#10b981', icon: 'fa-solid fa-check-circle' },
  { val: 'VENCIDO', label: 'Vencido', color: '#ef4444', icon: 'fa-solid fa-circle-exclamation', system_only: true },
  { val: 'ANULADO', label: 'Anulado', color: '#6b7280', icon: 'fa-solid fa-ban' },
];

const InlineStatusSelector: React.FC<{ status: string; onChange: (val: string) => void }> = ({ status, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Filtrar opciones editables (excluir VENCIDO, que es automático)
    const EDITABLE_STATUS = STATUS_OPTIONS.filter(o => o.val !== 'VENCIDO');
    const current = STATUS_OPTIONS.find(o => o.val === status) || STATUS_OPTIONS[0];
    const currentIndex = EDITABLE_STATUS.findIndex(i => i.val === current.val);
    const itemsAbove = currentIndex > 0 ? EDITABLE_STATUS.slice(0, currentIndex) : [];
    const itemsBelow = currentIndex < EDITABLE_STATUS.length - 1 ? EDITABLE_STATUS.slice(currentIndex + 1) : [];

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setDropdownPosition(spaceAbove > spaceBelow && spaceBelow < 200 ? 'top' : 'bottom');
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
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="inline-flex items-center justify-between gap-2 px-2.5 py-1 min-h-[24px] rounded-md text-[11px] font-semibold transition-all whitespace-nowrap hover:opacity-90 uppercase"
                style={{ backgroundColor: current.color, color: '#ffffff' }}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none">
                  <i className={`${current.icon} text-[9px] leading-none`}></i>
                </span>
                <span className="truncate">{current.label}</span>
              </span>
              <span className="inline-flex w-3.5 h-3.5 items-center justify-center leading-none ml-1 opacity-60">
                <i className="fa-solid fa-chevron-down text-[7px] leading-none"></i>
              </span>
            </button>
            {isOpen && (
                <div
                    onMouseLeave={() => setIsOpen(false)}
                    className={`absolute z-[200] ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
                >
                  <div className="max-h-64 overflow-y-auto py-1">
                    {itemsAbove.length > 0 && (
                      <div>
                        {itemsAbove.map(item => (
                          <button
                            key={item.val}
                            onClick={(e) => { e.stopPropagation(); onChange(item.val); setIsOpen(false); }}
                            className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
                          >
                            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color }}>
                              <i className={`${item.icon} text-[8px] text-white`}></i>
                            </div>
                            <span className="text-[11px] font-medium text-slate-700 uppercase">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="bg-slate-50 border-y border-slate-100 px-3 py-2">
                      <div className="w-full flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: current.color }}>
                          <i className={`${current.icon} text-[8px] text-white`}></i>
                        </div>
                        <span className="text-[11px] font-medium text-slate-700 uppercase">{current.label}</span>
                        <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400"></i>
                      </div>
                    </div>
                    {itemsBelow.length > 0 && (
                      <div>
                        {itemsBelow.map(item => (
                          <button
                            key={item.val}
                            onClick={(e) => { e.stopPropagation(); onChange(item.val); setIsOpen(false); }}
                            className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-left transition-colors"
                          >
                            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: item.color }}>
                              <i className={`${item.icon} text-[8px] text-white`}></i>
                            </div>
                            <span className="text-[11px] font-medium text-slate-700 uppercase">{item.label}</span>
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

// 3. Helper Group Cell
const renderGroupCell = (row: any, label: string) => {
  const subtotal = row.subRows.reduce((sum: number, subRow: any) => sum + Number(subRow.original?.total_value || 0), 0);
  const colId = row.groupingColumnId;
  const matchedStatus = colId === 'status'
    ? STATUS_OPTIONS.find((item) => item.val === String(label || '').toUpperCase() || item.label.toUpperCase() === String(label || '').toUpperCase())
    : null;

  return (
    <div className="flex items-center gap-3 py-0.5">
      <i className={`fa-solid fa-chevron-right text-slate-400 text-[10px] transition-transform duration-150 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
      {matchedStatus ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: matchedStatus.color }}>
          <i className={`${matchedStatus.icon} text-[9px]`} />
          {matchedStatus.label}
        </span>
      ) : (
        <span className="font-semibold text-slate-700 text-xs">{label || 'Sin asignar'}</span>
      )}
      <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{row.subRows.length}</span>
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-800 tabular-nums">
        {formatCurrency(subtotal)}
      </span>
    </div>
  );
};

// 4. Badges Extras
const getTypeBadge = (type: string) => {
    const map: any = { VENTA: { color: '#10b981', icon: 'fa-arrow-trend-up' }, GASTO: { color: '#ef4444', icon: 'fa-arrow-trend-down' }, OTRO: { color: '#6b7280', icon: 'fa-circle-question' } };
    const t = map[type] || map.OTRO;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white whitespace-nowrap uppercase" style={{ backgroundColor: t.color }}><i className={`fa-solid ${t.icon} text-[9px]`}></i>{type}</span>;
};

const getPaymentStatusColor = (code?: string) => {
    if (code === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (code === 'OVERDUE') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (code === 'WARNING') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
};

const FinancialActionsMenu: React.FC<{
  tx: FinancialTransaction;
  hasEmailIntegration: boolean;
  onCollect: (tx: FinancialTransaction) => void;
  onEdit: (tx: FinancialTransaction) => void;
  onDelete: (tx: FinancialTransaction) => void;
}> = ({ tx, hasEmailIntegration, onCollect, onEdit, onDelete }) => {
  const HOVER_CLOSE_DELAY_MS = 550;
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const showCollect = tx.status === 'VENCIDO';

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
    const menuH = showCollect ? 150 : 112;
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
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
        onMouseLeave={() => { if (isOpen) scheduleClose(); }}
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
          {showCollect && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                onCollect(tx);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-xs transition-colors ${hasEmailIntegration ? 'hover:bg-slate-50 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}
              title={hasEmailIntegration ? 'Notificar Cobranza' : 'Integración de correo no configurada'}
            >
              <i className="fa-solid fa-bell w-3.5 text-orange-500" /> Enviar Notificación
            </button>
          )}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              onEdit(tx);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 text-xs transition-colors"
          >
            <i className="fa-solid fa-pen text-slate-400 w-3.5" /> Editar
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              onDelete(tx);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2.5 text-xs transition-colors"
          >
            <i className="fa-solid fa-trash text-red-500 w-3.5" /> Eliminar
          </button>
        </div>
      )}
    </>
  );
};

// 5. Grouping Dropdown (Phase C - Toolbar parity with QuotesList)
const FINANCIALS_GROUP_OPTIONS = [
  { id: 'client_company_name', icon: 'fa-building', label: 'Cliente' },
  { id: 'status', icon: 'fa-list-check', label: 'Estado' },
  { id: 'transaction_type', icon: 'fa-tag', label: 'Tipo' },
];

const GroupingDropdown: React.FC<{
  grouping: string[];
  onGroupingChange: (g: string[]) => void;
  columnFilters: ColumnFiltersState;
  onClearFilters: () => void;
}> = ({ grouping, onGroupingChange, columnFilters, onClearFilters }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveGroup = grouping.length > 0;
  const hasActiveFilters = columnFilters.length > 0;
  const activeConfigCount = (hasActiveGroup ? 1 : 0) + columnFilters.length;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  };
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => { setOpen(false); closeTimerRef.current = null; }, 650);
  };
  const canUseHoverClose = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  };

  return (
    <div
      className="relative flex-shrink-0"
      ref={ref}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={() => { if (open && canUseHoverClose()) scheduleClose(); }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-md border text-sm sm:text-xs font-medium transition-all whitespace-nowrap ${open ? 'bg-slate-50 border-slate-300 text-slate-700' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
      >
        <i className="fa-solid fa-layer-group text-[10px]" />
        <span>Agrupar</span>
        <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        {activeConfigCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center leading-none border-2 border-white">
            {activeConfigCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 right-0 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl shadow-[0_10px_24px_rgba(15,23,42,0.12)] py-1 z-50 w-56 max-w-[calc(100vw-1rem)]">
          <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Agrupado por</p>
          {FINANCIALS_GROUP_OPTIONS.map(opt => {
            const isActive = grouping.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => { onGroupingChange(isActive ? [] : [opt.id]); setOpen(false); }}
                className={`w-full h-8 flex items-center gap-2 px-2.5 text-xs rounded-md transition-colors text-left ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <i className={`fa-solid ${opt.icon} text-[10px] w-3.5 text-center ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                {opt.label}
                {isActive && <i className="fa-solid fa-check text-[9px] ml-auto text-blue-400" />}
              </button>
            );
          })}
          <button
            onClick={() => { onGroupingChange([]); setOpen(false); }}
            className={`w-full h-8 flex items-center gap-2 px-2.5 text-xs rounded-md transition-colors text-left ${hasActiveGroup ? 'text-red-600 bg-red-50 hover:bg-red-100/70' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <i className={`fa-solid fa-xmark text-[10px] w-3.5 text-center ${hasActiveGroup ? 'text-red-500' : 'text-slate-400'}`} />
            Sin agrupar
            {!hasActiveGroup && <i className="fa-solid fa-check text-[9px] ml-auto text-slate-400" />}
          </button>
          {hasActiveFilters && (
            <>
              <div className="border-t border-slate-100 mt-1.5 pt-1.5" />
              <button
                onClick={() => { onClearFilters(); setOpen(false); }}
                className="w-full h-8 flex items-center gap-2 px-2.5 text-xs text-slate-600 hover:bg-slate-50 rounded-md transition-colors text-left"
              >
                <i className="fa-solid fa-filter text-[10px] w-3.5 text-center text-slate-400" />
                <span>Limpiar {columnFilters.length} filtro{columnFilters.length > 1 ? 's' : ''}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

const FinancialsList: React.FC = () => {
  const { user } = useAuth();
    const { financialsCache, invalidateFinancials } = useDataCache();
  const navigate = useNavigate();

  // --- STATE ---
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary | null>(null);
  const [availableList, setAvailableList] = useState<YearWithMonths[]>([]);
    const [loading, setLoading] = useState(true);

  // Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>(() => {
    try { const s = localStorage.getItem('financials_grouping'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // Custom Filters & View State
  const [dateRange, setDateRange] = useState(() => {
    try { const s = localStorage.getItem('financials-range'); if(s) return JSON.parse(s); } catch {}
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] };
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    try { const s = localStorage.getItem('financials-year'); if(s) return parseInt(s); } catch {}
    return now.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    try { const s = localStorage.getItem('financials-month'); if(s) return parseInt(s); } catch {}
    return now.getMonth() + 1;
  });
  const [includeOpen, setIncludeOpen] = useState(() => localStorage.getItem('financials-include-open') === 'true');
  
  // UI State
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Actions State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<FinancialTransaction | null>(null);
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, tx: FinancialTransaction | null, date: string, amount: number, method: string, ref: string}>({ isOpen: false, tx: null, date: '', amount: 0, method: 'TRANSFERENCIA', ref: '' });

  // Verificar si hay integración de correo activa
  const hasEmailIntegration = () => {
    return !!(user?.provider && user?.send_emails && user?.email_connected);
  };

  // Persistence
  useEffect(() => { localStorage.setItem('financials-range', JSON.stringify(dateRange)); }, [dateRange]);
  useEffect(() => { localStorage.setItem('financials-include-open', String(includeOpen)); }, [includeOpen]);
  useEffect(() => { localStorage.setItem('financials_grouping', JSON.stringify(grouping)); }, [grouping]);

  // Click Outside Filter Menu
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setActiveFilterMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // --- DATA LOADING ---
    const didInitRef = useRef(false);
        const didFirstFilterEffectRef = useRef(false);

    const computeKey = useCallback(() => {
        return `${dateRange.start || ''}|${dateRange.end || ''}|${includeOpen ? 1 : 0}`;
    }, [dateRange.start, dateRange.end, includeOpen]);

    // Hidratar desde cache cuando haya datos para la clave actual
    useEffect(() => {
        const key = computeKey();
        const entry = financialsCache[key];
        if (entry && entry.result) {
            const result = entry.result;
            if (result.kpis) {
                setKpiSummary({
                    ventasMes: Number(result.kpis.ventas_periodo || 0),
                    porCobrarTotal: Number(result.kpis.por_cobrar_total || 0),
                    vencidoTotal: Number(result.kpis.vencido_total || 0),
                    cobradoMes: Number(result.kpis.cobrado_periodo || 0)
                });
            } else {
                setKpiSummary(null);
            }
            if (result.meses_disponibles) {
                setAvailableList(result.meses_disponibles);
            }
            const txList = (result.data || []).filter((t: any) => t && Object.keys(t).length > 0);
            setTransactions(txList.map((t: any) => ({
                ...t,
                id_transaction: t.id_transaction || t.id_transaccion,
                invoice_number: t.invoice_number || t.numero_factura,
                description: t.description || t.descripcion_concepto,
              is_urgent: Boolean(t.is_urgent ?? t.es_urgente),
                client_company_name: t.client_company_name || t.nombre_cliente_proveedor,
                status: t.status || t.estado_registro,
                transaction_type: normalizeTransactionType(t.tipo_transaccion || t.transaction_type),
                total_value: Number(t.total_value || t.total_factura || 0),
                paid_amount: Number(t.paid_amount || t.monto_pagado_caja || t.v_total_abonado || 0),
                retention_value: Number(t.retention_value || t.valor_retencion || 0),
                balance_due: deriveBalanceDue(t.v_saldo_pendiente || t.saldo_pendiente || t.balance_due, t.total_value || t.total_factura, t.paid_amount || t.monto_pagado_caja || t.v_total_abonado),
                issue_date: t.issue_date || t.fecha_emision,
                due_date: t.due_date || t.fecha_vencimiento,
                subtotal: Number(t.subtotal || 0),
                tax_amount: Number(t.tax_amount || t.impuestos || 0),
                payment_status_code: t.v_codigo_estado,
                payment_status_label: t.v_etiqueta_estado
            })));
            setLoading(false);
        }
    }, [financialsCache, computeKey]);

  // Carga inicial - solo una vez
    useEffect(() => { 
        if (didInitRef.current) return;
        didInitRef.current = true;
        if (!user?.id_tenant) return;
        const key = computeKey();
        const hasCache = Boolean(financialsCache[key]);
        if (!hasCache) setLoading(true);
        // Sync en segundo plano; al completar, el efecto de cache hidratará
        invalidateFinancials({ start: dateRange.start, end: dateRange.end, include_open: includeOpen });
    }, [user?.id_tenant]);

  // Recargar solo cuando el usuario cambia los filtros MANUALMENTE (después de la carga inicial)
    useEffect(() => {
        if (!didInitRef.current) return;
        if (!didFirstFilterEffectRef.current) {
            didFirstFilterEffectRef.current = true;
            return;
        }
        const key = computeKey();
        const hasCache = Boolean(financialsCache[key]);
        if (!hasCache) setLoading(true);
        invalidateFinancials({ start: dateRange.start, end: dateRange.end, include_open: includeOpen });
    }, [dateRange, includeOpen]);

  // Actualizar selectedYear y selectedMonth cuando lleguen los datos disponibles (sin disparar nuevo fetch)
  useEffect(() => {
    if (!didInitRef.current || availableList.length === 0) return;
    
    const yearExists = availableList.some((y: any) => y.year === selectedYear);
    if (!yearExists) {
      // Solo actualizar el estado sin disparar loadData (disponibleList ya tiene los meses)
      const firstYear = availableList[0].year;
      const months = availableList[0].months_available || [];
      const sorted = [...months].sort((a: any, b: any) => b.month - a.month);
      if (sorted.length > 0) {
        const firstMonth = sorted[0].month;
        setSelectedYear(firstYear);
        setSelectedMonth(firstMonth);
      }
    }
  }, [availableList, selectedYear]);

  // --- ACTIONS ---
  const handleStatusChange = async (tx: FinancialTransaction, newStatus: string) => {
      // Validación: nunca permitir cambio manual a VENCIDO (lo determina el sistema)
      if (newStatus === 'VENCIDO') {
          setToast({ message: 'El estado "Vencido" se determina automáticamente por el sistema', type: 'error' });
          return;
      }
      if (newStatus === 'PAGADO') {
          const amount = Number((tx as any).balance_due || tx.total_value || 0);
          setPaymentModal({ isOpen: true, tx, date: new Date().toISOString().split('T')[0], amount, method: 'TRANSFERENCIA', ref: '' });
      } else {
          try {
              await financialService.update({ id_transaction: tx.id_transaction, id_tenant: user?.id_tenant, status: newStatus });
              setToast({ message: 'Estado actualizado', type: 'success' });
              invalidateFinancials({ start: dateRange.start, end: dateRange.end, include_open: includeOpen });
          } catch (e) { setToast({ message: 'Error al actualizar', type: 'error' }); }
      }
  };

  const confirmPayment = async () => {
      if (!paymentModal.tx || !user) return;
      try {
          const currentBalance = Number(paymentModal.tx.balance_due || paymentModal.tx.total_value || 0);
          const amount = Math.min(Number(paymentModal.amount || 0), currentBalance);
          if (amount <= 0) {
              setToast({ message: 'Ingrese un monto válido.', type: 'error' });
              return;
          }

          await financialService.addPayment({
              id_transaction: paymentModal.tx.id_transaction,
              id_tenant: user.id_tenant,
              created_by: user.id_user,
              amount,
              payment_date: paymentModal.date,
              payment_method: paymentModal.method,
              reference: paymentModal.ref || undefined,
          });
          setPaymentModal(prev => ({ ...prev, isOpen: false }));
          setToast({ message: 'Abono registrado', type: 'success' });
          invalidateFinancials({ start: dateRange.start, end: dateRange.end, include_open: includeOpen });
      } catch (e) { setToast({ message: 'Error registrando abono', type: 'error' }); }
  };

  const handleDelete = async () => {
      if (!deleteId || !user) return;
      try {
          await financialService.delete(deleteId, user.id_tenant, user.id_user);
          setToast({ message: 'Eliminado correctamente', type: 'success' });
          setDeleteId(null);
          invalidateFinancials({ start: dateRange.start, end: dateRange.end, include_open: includeOpen });
      } catch (e) { setToast({ message: 'Error al eliminar', type: 'error' }); }
  };

  // --- FACETED FILTER HELPER ---
  const getFacetedValues = (columnId: string) => {
    const counts = new Map<string, number>();
    transactions.forEach(row => {
        let val = (row as any)[columnId] || '(Vacío)';
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  // --- TABLE COLUMNS ---
  const columns = useMemo<ColumnDef<FinancialTransaction>[]>(() => [
    {
        accessorKey: 'invoice_number',
        header: 'Factura',
        size: 300,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
        <div className="flex items-center gap-2 min-w-0">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <FinancialActionsMenu
              tx={row.original}
              hasEmailIntegration={hasEmailIntegration()}
              onCollect={(selectedTx) => {
                if (!hasEmailIntegration()) {
                  alert('No tienes una integración de correo configurada. Ve a Configuración → Integraciones para conectar Gmail o Outlook.');
                  return;
                }
                setCollectionData(selectedTx);
              }}
              onEdit={(selectedTx) => navigate(`/app/financials/edit?id=${selectedTx.id_transaction}`)}
              onDelete={(selectedTx) => setDeleteId(selectedTx.id_transaction)}
            />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-slate-800 truncate">{getValue() as string}</span>
          </div>
        </div>
        )
    },
    {
        accessorKey: 'description',
        header: 'Descripción',
        size: 225,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <div className="flex items-start gap-1.5 w-[225px]">
            {row.original.is_urgent && <i className="fa-solid fa-triangle-exclamation text-red-500 text-[11px] shrink-0 mt-[2px]" title="Urgente"></i>}
            <div className="text-xs leading-tight text-slate-700 line-clamp-2 font-medium">{getValue() as string}</div>
          </div>
        )
    },
    {
        accessorKey: 'client_company_name',
        header: 'Cliente',
        size: 140,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            if (row.getIsGrouped()) return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string) : null;
          return <div className="text-[13px] leading-tight text-slate-800 font-semibold w-[140px] truncate">{getValue() as string || 'Sin Cliente'}</div>;
        }
    },
    {
        accessorKey: 'transaction_type',
        header: 'Tipo',
        size: 100,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            if (row.getIsGrouped()) return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string) : null;
            return getTypeBadge(getValue() as string);
        }
    },
    {
        accessorKey: 'status',
        header: 'Estado',
        size: 120,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            if (row.getIsGrouped()) return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string) : null;
            return <InlineStatusSelector status={getValue() as string} onChange={(v) => handleStatusChange(row.original, v)} />;
        }
    },
    {
        accessorKey: 'issue_date',
        header: 'Emisión',
        size: 100,
        filterFn: dateRangeFilter,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateDDMMYYYY(getValue() as string)}</span>
    },
    {
        accessorKey: 'due_date',
        header: 'Vence',
        size: 100,
        filterFn: dateRangeFilter,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-[11px] text-slate-700 whitespace-nowrap">{formatDateDDMMYYYY(getValue() as string)}</span>
    },
    {
        accessorKey: 'subtotal',
        header: 'Subtotal',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50">
            <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap tabular-nums">{formatCurrency(getValue() as number)}</span>
          </span>
        )
    },
    {
        accessorKey: 'tax_amount',
        header: 'IVA',
        size: 80,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50">
            <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap tabular-nums">{formatCurrency((row.original.subtotal||0) * (getValue() as number||0)/100)}</span>
          </span>
        )
    },
    {
        accessorKey: 'retention_value',
        header: 'Retención',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-indigo-200 bg-indigo-50">
            <span className="text-[11px] font-semibold text-indigo-700 whitespace-nowrap tabular-nums">{formatCurrency(getValue() as number)}</span>
          </span>
        )
    },
    {
        accessorKey: 'total_value',
        header: 'Total',
        size: 110,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50">
            <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap tabular-nums">{formatCurrency(getValue() as number)}</span>
          </span>
        )
    },
    {
        accessorKey: 'paid_amount',
        header: 'Pagado',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50">
            <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap tabular-nums">{formatCurrency(getValue() as number)}</span>
          </span>
        )
    },
    {
        accessorKey: 'balance_due',
        header: 'Saldo',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-red-200 bg-red-50">
            <span className="text-[11px] font-semibold text-red-700 whitespace-nowrap tabular-nums">{formatCurrency(getValue() as number)}</span>
          </span>
        )
    },
    {
        id: 'payment_status',
        header: 'Estado Pago',
        size: 120,
        cell: ({ row }) => {
            if (row.getIsGrouped()) return null;
          return <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap uppercase ${getPaymentStatusColor(row.original.payment_status_code)}`}>{row.original.payment_status_label || '-'}</span>
        }
    },
  ], [grouping]);

  // --- TABLE INSTANCE ---
  const table = useReactTable({
    data: transactions,
    columns,
        paginateExpandedRows: false,
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
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const totalRows = useMemo(() => filteredRows.filter(r => !r.getIsGrouped()).length, [filteredRows]);
  const totalValue = useMemo(() => filteredRows.reduce((s, r) => s + (r.getIsGrouped() ? 0 : Number(r.original.total_value || 0)), 0), [filteredRows]);

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return null;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans text-slate-700">
      
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* 1. KPIs SECTION (Encima de la tabla) */}
      {kpiSummary && (
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
          <KpiCard title="Ventas Mes" value={kpiSummary.ventasMes} icon="fa-chart-line" color="blue" subtext="Emitido en periodo" />
          <KpiCard title="Ingresos Reales" value={kpiSummary.cobradoMes} icon="fa-sack-dollar" color="green" subtext="Dinero ingresado a caja" />
          <KpiCard title="Por Cobrar" value={kpiSummary.porCobrarTotal} icon="fa-wallet" color="orange" subtext="Deuda total histórica" />
          <KpiCard title="Vencido" value={kpiSummary.vencidoTotal} icon="fa-triangle-exclamation" color="red" subtext="Cartera vencida acumulada" />
        </div>
      )}

      {/* 2. TOOLBAR */}
      <div className="border-b border-slate-200 px-3 py-2 bg-white flex flex-wrap items-center gap-2 shrink-0">

        {/* BUSCADOR */}
        <div className="relative w-full sm:flex-1 sm:min-w-0">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Buscar factura, cliente..."
            className="w-full pl-8 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white placeholder:text-slate-300 text-slate-700 transition-all"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <i className="fa-solid fa-xmark text-[10px]" />
            </button>
          )}
        </div>

        {/* Selector Año/Mes + Hoy */}
        {(() => {
            const validYears = availableList.filter(y => Array.isArray(y.months_available) && y.months_available.length > 0);
            if (validYears.length > 0) return (
              <>
                <DateRangeSelector
                  availableList={availableList}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onChange={(start, end) => setDateRange({ start, end })}
                  onYearChange={(year) => setSelectedYear(year)}
                  onMonthChange={(month) => setSelectedMonth(month)}
                />
                <button
                  onClick={() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = today.getMonth() + 1;
                    const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
                    const end = new Date(year, month, 0).toISOString().split('T')[0];
                    setSelectedYear(year);
                    setSelectedMonth(month);
                    setDateRange({ start, end });
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  title="Ir al mes actual"
                >
                  <i className="fa-solid fa-calendar-check text-[10px]" /> Hoy
                </button>
              </>
            );
            return null;
        })()}

        {/* Toggle Pendientes primero */}
        <button
          type="button"
          role="switch"
          aria-checked={includeOpen}
          onClick={() => setIncludeOpen(!includeOpen)}
          className="h-8 px-2.5 flex items-center gap-2 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
          title="Mostrar pendientes y vencidos históricos independientemente del mes seleccionado"
        >
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${includeOpen ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </span>
          <span className="text-xs font-medium text-slate-600">Pendientes primero</span>
        </button>

        {/* Agrupar + Nueva */}
        <GroupingDropdown
          grouping={grouping as string[]}
          onGroupingChange={setGrouping}
          columnFilters={columnFilters}
          onClearFilters={() => { setColumnFilters([]); setGlobalFilter(''); }}
        />

        <button
          onClick={() => navigate('/app/financials/new')}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-800 text-white rounded-md text-sm sm:text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          <i className="fa-solid fa-plus text-[10px]" /> Nuevo Registro
        </button>
      </div>

      {/* 3. TABLA */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-50/10">
        <table className="w-auto min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40 shadow-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const isFiltered = columnFilters.some(f => f.id === header.column.id);
                  const isDate = ['issue_date', 'due_date'].includes(header.column.id);
                  const canFilter = header.column.getCanFilter();

                  return (
                    <th key={header.id} style={{ width: header.getSize() }} className="border-b border-r border-zinc-200 bg-zinc-50 px-4 py-2 text-left relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {{ asc: <i className="fa-solid fa-sort-up text-brand-600"></i>, desc: <i className="fa-solid fa-sort-down text-brand-600"></i> }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {header.column.id !== 'actions' && canFilter && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }} className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isFiltered ? 'text-slate-500 bg-slate-200' : 'text-slate-300 hover:text-slate-500'}`}><i className={`fa-solid ${isDate ? 'fa-calendar-days' : 'fa-filter'} text-[9px]`}></i></button>
                        )}
                      </div>

                      {/* MENÚ DE FILTRO */}
                      {activeFilterMenu === header.column.id && (
                        <div
                          ref={filterMenuRef}
                          onMouseLeave={() => setActiveFilterMenu(null)}
                          className="absolute top-full left-0 mt-1.5 w-60 bg-white shadow-lg rounded-lg border border-slate-200 z-50 py-2.5"
                        >
                          {isDate ? (
                            <div className="px-3 space-y-2">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Rango de fechas</p>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Desde</label>
                                <input type="date" className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300" onChange={e => header.column.setFilterValue((old:any) => ({ ...old, start: e.target.value }))} />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-500 font-medium block mb-0.5">Hasta</label>
                                <input type="date" className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300" onChange={e => header.column.setFilterValue((old:any) => ({ ...old, end: e.target.value }))} />
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
                <td colSpan={columns.length} className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button onClick={() => setExpanded(true)} className="text-slate-400 hover:text-slate-700 transition-colors leading-none">expandir</button>
                    <span className="text-slate-300">/</span>
                    <button onClick={() => setExpanded({})} className="text-slate-400 hover:text-slate-700 transition-colors leading-none">contraer</button>
                  </div>
                </td>
              </tr>
            )}
            {loading ? (
                <tr><td colSpan={columns.length} className="py-24 text-center"><div className="flex flex-col items-center gap-2"><BrandSpinner size="lg" /><p className="text-slate-400 text-sm font-medium">Cargando datos...</p></div></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <i className="fa-regular fa-file-lines text-4xl text-slate-300"></i>
                      <p className="font-bold text-slate-600">No hay transacciones aún</p>
                      <p className="text-sm text-slate-400">Crea tu primer registro financiero para visualizarlo aquí.</p>
                      <button
                        onClick={() => navigate('/app/financials/new')}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-800 text-white rounded-md text-sm sm:text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
                      >
                        <i className="fa-solid fa-plus text-[10px]" /> Nuevo Registro
                      </button>
                    </div>
                  </td>
                </tr>
            ) : table.getRowModel().rows.map(row => {
                const isGrouped = row.getIsGrouped();
                if (isGrouped) {
                    const groupedCell = row.getVisibleCells().find(cell => cell.column.id === row.groupingColumnId);
                    const rawLabel = groupedCell ? groupedCell.getValue() : '';
                    const label = rawLabel === null || rawLabel === undefined || rawLabel === '' ? 'Sin asignar' : String(rawLabel);
                    return (
                        <tr
                            key={row.id}
                            onClick={() => row.toggleExpanded()}
                            className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <td colSpan={row.getVisibleCells().length} className="px-4 py-2">
                                {renderGroupCell(row, label)}
                            </td>
                        </tr>
                    );
                }
                return (
                    <tr
                        key={row.id}
                        onClick={() => navigate(`/app/financials/${row.original.id_transaction}`)}
                        className="bg-white hover:bg-blue-50/70 group cursor-pointer border-b border-slate-100 transition-colors"
                    >
                        {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="px-4 py-2.5 align-middle">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="border-t border-zinc-200 px-4 py-1.5 bg-zinc-50 shrink-0">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs text-slate-600 min-w-0">
            <span className="font-semibold shrink-0">{totalRows} registros</span>
            <div className="inline-flex items-center justify-between sm:justify-start gap-2 px-2.5 py-0.5 rounded-md bg-white border border-zinc-200 min-w-0 w-[190px] sm:w-auto">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</span>
              <span className="text-[11px] sm:text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(totalValue)}</span>
            </div>
          </div>
          <div className="flex items-center justify-end sm:justify-start gap-1.5 text-xs text-slate-600 shrink-0">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 disabled:opacity-30 transition-colors"><i className="fa-solid fa-chevron-left text-[9px]"></i></button>
            <span className="px-2 py-0.5 text-[10px] font-semibold text-slate-700">{table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 disabled:opacity-30 transition-colors"><i className="fa-solid fa-chevron-right text-[9px]"></i></button>
          </div>
        </div>
      </div>

      {/* MODALS (Iguales que antes) */}
      <ConfirmModal isOpen={Boolean(deleteId)} title="¿Seguro desea eliminar este registro?" message="Esta acción es irreversible." onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      
      {collectionData && (
        <CollectionModal isOpen={true} onClose={() => setCollectionData(null)} onSend={async (data) => { await financialService.notifyOverdue({ id_transaction: collectionData.id_transaction, id_tenant: user.id_tenant, id_user: user.id_user, ...data }); setCollectionData(null); setToast({ message: 'Notificación enviada', type: 'success' }); }} transactionData={{ id_transaction: collectionData.id_transaction, invoice_number: collectionData.invoice_number, id_client_company: collectionData.id_client_company || (collectionData as any).id_empresa_cliente, automation_enabled: collectionData.enable_automation, automation_frequency: collectionData.automation_frequency, automation_recipients: collectionData.automation_recipients }} />
      )}

        {paymentModal.isOpen && (
          <AppModalViewport className="z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800">Registrar Abono</h3><button onClick={() => setPaymentModal(p => ({...p, isOpen:false}))} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button></div>
                  <div className="p-6 space-y-4">
                      {paymentModal.tx && (
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-xs font-bold text-slate-500 uppercase">Saldo Pendiente</span>
                          <span className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(Number(paymentModal.tx.balance_due || paymentModal.tx.total_value || 0))}</span>
                        </div>
                      )}
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label><input type="date" value={paymentModal.date} onChange={e => setPaymentModal(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto del Abono</label><div className="relative"><span className="absolute left-3 top-2 text-slate-400">$</span><input type="number" max={paymentModal.tx?.balance_due || undefined} value={paymentModal.amount} onChange={e => setPaymentModal(p => ({...p, amount: parseFloat(e.target.value) || 0}))} className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" /></div></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Método</label><select value={paymentModal.method} onChange={e => setPaymentModal(p => ({...p, method: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="CHEQUE">Cheque</option><option value="TARJETA">Tarjeta</option></select></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Referencia</label><input type="text" placeholder="Ej: #12345" value={paymentModal.ref} onChange={e => setPaymentModal(p => ({...p, ref: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2"><button onClick={() => setPaymentModal(p => ({...p, isOpen:false}))} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">Cancelar</button><button onClick={confirmPayment} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm">Registrar Abono</button></div>
                </div>
              </AppModalViewport>
      )}
    </div>
  );
};



export default FinancialsList;

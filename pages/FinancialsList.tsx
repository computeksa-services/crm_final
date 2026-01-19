import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { financialService } from '../services/financials.service';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CollectionModal from '../components/CollectionModal';
import type { FinancialTransaction } from '../types';
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

// 1. KPI Card (Diseño original mantenido)
const KpiCard: React.FC<{ title: string; value: number; icon: string; color: 'blue' | 'green' | 'red' | 'orange'; subtext?: string; }> = ({ title, value, icon, color, subtext }) => {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    orange: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <div className={`p-4 rounded-xl border ${styles[color]} flex flex-col justify-between h-full shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold uppercase opacity-70 tracking-widest">{title}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white bg-opacity-60`}>
            <i className={`fa-solid ${icon} text-lg`}></i>
        </div>
      </div>
      <div>
        <div className="text-2xl font-black font-mono tracking-tight">
          ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        {subtext && <div className="text-[11px] mt-1 opacity-80 font-medium">{subtext}</div>}
      </div>
    </div>
  );
};

// 2. Selector de Año y Mes (Mejorado)
const DateRangeSelector: React.FC<{ availableList: YearWithMonths[], selectedYear: number; selectedMonth: number; onChange: (start: string, end: string) => void; onYearChange: (year: number) => void; onMonthChange: (month: number) => void; }> = ({ availableList, selectedYear, selectedMonth, onChange, onYearChange, onMonthChange }) => {
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
    };
    
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    
    return (
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            {/* Selector de Año */}
            <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer border-r border-slate-200 pr-2"
            >
                {availableList.map(y => (
                    <option key={y.year} value={y.year}>{y.year}</option>
                ))}
            </select>
            
            {/* Selector de Mes con Count */}
            <select
                value={monthToUse || ""}
                onChange={(e) => handleMonthSelect(parseInt(e.target.value))}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
                {sortedMonths.length === 0 ? (
                    <option value="">-- Sin meses disponibles --</option>
                ) : (
                    sortedMonths.map(m => (
                        <option key={`${selectedYear}-${m.month}`} value={m.month}>
                            {monthNames[m.month-1]} ({m.count} registros)
                        </option>
                    ))
                )}
            </select>
        </div>
    );
}

// 3. Selector Inline (Estilo QuotesList)
const InlineStatusSelector: React.FC<{ status: string; onChange: (val: string) => void }> = ({ status, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const options = [
        { val: 'PENDIENTE', label: 'Pendiente', color: '#f59e0b', icon: 'fa-solid fa-clock' },
        { val: 'PAGADO', label: 'Pagado', color: '#10b981', icon: 'fa-solid fa-check-circle' },
        { val: 'VENCIDO', label: 'Vencido', color: '#ef4444', icon: 'fa-solid fa-circle-exclamation' },
        { val: 'ANULADO', label: 'Anulado', color: '#6b7280', icon: 'fa-solid fa-ban' },
    ];

    const current = options.find(o => o.val === status) || options[0];

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
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-black uppercase tracking-tight transition-all hover:bg-white active:scale-95"
                style={{ backgroundColor: `${current.color}15`, color: current.color, borderColor: `${current.color}30` }}
            >
                <i className={current.icon}></i>
                {current.label}
                <i className="fa-solid fa-chevron-down opacity-50 text-[8px] ml-1"></i>
            </button>
            {isOpen && (
                <div className="absolute z-[100] mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                    {options.map(opt => (
                        <button
                            key={opt.val}
                            onClick={(e) => { e.stopPropagation(); onChange(opt.val); setIsOpen(false); }}
                            className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-left border-b border-slate-50 last:border-0"
                        >
                            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${opt.color}20`, color: opt.color }}>
                                <i className={opt.icon}></i>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{opt.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// 3. Helper Group Cell
const renderGroupCell = (row: any, label: string) => (
  <div className="flex items-center gap-3">
    <i className={`fa-solid fa-chevron-right text-slate-400 text-xs transition-transform duration-200 ${row.getIsExpanded() ? 'rotate-90' : ''}`}></i>
    <span className="font-bold text-slate-700 uppercase tracking-tight">{label || 'No asignado'}</span>
    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{row.subRows.length}</span>
  </div>
);

// 4. Badges Extras
const getTypeBadge = (type: string) => {
    const map: any = { VENTA: { color: '#10b981', icon: 'fa-arrow-trend-up' }, GASTO: { color: '#ef4444', icon: 'fa-arrow-trend-down' }, OTRO: { color: '#6b7280', icon: 'fa-circle-question' } };
    const t = map[type] || map.OTRO;
    return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold" style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}30` }}><i className={`fa-solid ${t.icon}`}></i> {type}</span>;
};

const getPaymentStatusColor = (code?: string) => {
    if (code === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (code === 'OVERDUE') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (code === 'WARNING') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
};

// --- MAIN COMPONENT ---

const FinancialsList: React.FC = () => {
  const { user } = useAuth();
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
  
  const loadData = useCallback(async () => {
      if (!user?.id_tenant) return;
      setLoading(true);
      try {
          const data = await financialService.getAll(user.id_tenant, { ...dateRange, include_open: includeOpen });
          const result = Array.isArray(data) ? data[0] : data;

          if (result.kpis) {
              setKpiSummary({
                  ventasMes: Number(result.kpis.ventas_periodo || 0),
                  porCobrarTotal: Number(result.kpis.por_cobrar_total || 0),
                  vencidoTotal: Number(result.kpis.vencido_total || 0),
                  cobradoMes: Number(result.kpis.cobrado_periodo || 0)
              });
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
              client_company_name: t.client_company_name || t.nombre_cliente_proveedor,
              status: t.status || t.estado_registro,
              transaction_type: t.tipo_transaccion,
              total_value: Number(t.total_value || t.total_factura || 0),
              paid_amount: Number(t.paid_amount || t.monto_pagado_caja || 0),
              retention_value: Number(t.retention_value || t.valor_retencion || 0),
              balance_due: Math.max(Number(t.v_saldo_pendiente || t.saldo_pendiente || 0) - Number(t.valor_retencion || 0), 0),
              issue_date: t.issue_date || t.fecha_emision,
              due_date: t.due_date || t.fecha_vencimiento,
              subtotal: Number(t.subtotal || 0),
              tax_amount: Number(t.tax_amount || t.impuestos || 0),
              payment_status_code: t.v_codigo_estado,
              payment_status_label: t.v_etiqueta_estado
          })));
      } catch (e) { console.error(e); setToast({ message: 'Error de conexión', type: 'error' }); } finally { setLoading(false); }
  }, [user, dateRange, includeOpen]);

  // Carga inicial - solo una vez
  useEffect(() => { 
    if (didInitRef.current) return;
    didInitRef.current = true;
    
    const fetchInitial = async () => {
      if (!user?.id_tenant) return;
      setLoading(true);
      try {
        const data = await financialService.getAll(user.id_tenant, { ...dateRange, include_open: includeOpen });
        const result = Array.isArray(data) ? data[0] : data;

        if (result.kpis) {
          setKpiSummary({
            ventasMes: Number(result.kpis.ventas_periodo || 0),
            porCobrarTotal: Number(result.kpis.por_cobrar_total || 0),
            vencidoTotal: Number(result.kpis.vencido_total || 0),
            cobradoMes: Number(result.kpis.cobrado_periodo || 0)
          });
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
          client_company_name: t.client_company_name || t.nombre_cliente_proveedor,
          status: t.status || t.estado_registro,
          transaction_type: t.tipo_transaccion,
          total_value: Number(t.total_value || t.total_factura || 0),
          paid_amount: Number(t.paid_amount || t.monto_pagado_caja || 0),
          retention_value: Number(t.retention_value || t.valor_retencion || 0),
          balance_due: Math.max(Number(t.v_saldo_pendiente || t.saldo_pendiente || 0) - Number(t.valor_retencion || 0), 0),
          issue_date: t.issue_date || t.fecha_emision,
          due_date: t.due_date || t.fecha_vencimiento,
          subtotal: Number(t.subtotal || 0),
          tax_amount: Number(t.tax_amount || t.impuestos || 0),
          payment_status_code: t.v_codigo_estado,
          payment_status_label: t.v_etiqueta_estado
        })));
      } catch (e) { 
        console.error(e); 
        setToast({ message: 'Error de conexión', type: 'error' }); 
      } finally { 
        setLoading(false); 
      }
    };
    
    fetchInitial();
  }, [user?.id_tenant]);

  // Recargar solo cuando el usuario cambia los filtros MANUALMENTE (después de la carga inicial)
  useEffect(() => {
    if (!didInitRef.current) return;
    loadData();
  }, [dateRange, includeOpen, loadData]);

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
      if (newStatus === 'PAGADO') {
          const amount = Number((tx as any).balance_due || tx.total_value || 0);
          setPaymentModal({ isOpen: true, tx, date: new Date().toISOString().split('T')[0], amount, method: 'TRANSFERENCIA', ref: '' });
      } else {
          try {
              await financialService.update({ id_transaction: tx.id_transaction, id_tenant: user?.id_tenant, status: newStatus, paid_amount: 0, balance_due: tx.total_value });
              setToast({ message: 'Estado actualizado', type: 'success' });
              loadData();
          } catch (e) { setToast({ message: 'Error al actualizar', type: 'error' }); }
      }
  };

  const confirmPayment = async () => {
      if (!paymentModal.tx) return;
      try {
          await financialService.update({
              id_transaction: paymentModal.tx.id_transaction, id_tenant: user?.id_tenant,
              status: 'PAGADO', payment_date: paymentModal.date, payment_method: paymentModal.method, payment_reference: paymentModal.ref, paid_amount: paymentModal.amount,
              total_value: paymentModal.tx.total_value, subtotal: paymentModal.tx.subtotal, tax_amount: paymentModal.tx.tax_amount
          });
          setPaymentModal(prev => ({ ...prev, isOpen: false }));
          setToast({ message: 'Pago registrado', type: 'success' });
          loadData();
      } catch (e) { setToast({ message: 'Error registrando pago', type: 'error' }); }
  };

  const handleDelete = async () => {
      if (!deleteId || !user) return;
      try {
          await financialService.delete(deleteId, user.id_tenant, user.id_user);
          setToast({ message: 'Eliminado correctamente', type: 'success' });
          setDeleteId(null);
          loadData();
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
            <div className="font-bold text-brand-600 text-xs flex items-center gap-1 whitespace-nowrap">
                {getValue() as string}
                {row.original.is_urgent && <i className="fa-solid fa-triangle-exclamation text-red-500" title="Urgente"></i>}
            </div>
        )
    },
    {
        accessorKey: 'description',
        header: 'Descripción',
        size: 225,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <div className="text-slate-600 text-xs italic line-clamp-2 w-[225px]">{getValue() as string}</div>
    },
    {
        accessorKey: 'client_company_name',
        header: 'Cliente',
        size: 140,
        enableColumnFilter: true,
        cell: ({ row, getValue, column }) => {
            if (row.getIsGrouped()) return grouping.includes(column.id) ? renderGroupCell(row, getValue() as string) : null;
            return <div className="text-xs font-bold text-slate-700 uppercase w-[140px]">{getValue() as string || 'Sin Cliente'}</div>;
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
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs text-slate-500">{formatDateDDMMYYYY(getValue() as string)}</span>
    },
    {
        accessorKey: 'due_date',
        header: 'Vence',
        size: 100,
        filterFn: dateRangeFilter,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs text-slate-500">{formatDateDDMMYYYY(getValue() as string)}</span>
    },
    {
        accessorKey: 'subtotal',
        header: 'Subtotal',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs font-mono text-slate-600 text-right block">${(getValue() as number).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
    },
    {
        accessorKey: 'tax_amount',
        header: 'IVA',
        size: 80,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs font-mono text-slate-500 text-right block">${((row.original.subtotal||0) * (getValue() as number||0)/100).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
    },
    {
        accessorKey: 'retention_value',
        header: 'Retención',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : (
            (getValue() as number) > 0 
                ? <span className="text-xs font-mono text-indigo-600 text-right block">${(getValue() as number).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                : <span className="text-xs text-slate-400 text-right block">-</span>
        )
    },
    {
        accessorKey: 'total_value',
        header: 'Total',
        size: 110,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100 text-right block">${(getValue() as number).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
    },
    {
        accessorKey: 'paid_amount',
        header: 'Pagado',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs font-mono text-emerald-600 font-medium text-right block">${(getValue() as number).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
    },
    {
        accessorKey: 'balance_due',
        header: 'Saldo',
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue, row }) => row.getIsGrouped() ? null : <span className="text-xs font-mono font-bold text-red-600 text-right block">${(getValue() as number).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
    },
    {
        id: 'payment_status',
        header: 'Estado Pago',
        size: 120,
        cell: ({ row }) => {
            if (row.getIsGrouped()) return null;
            return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase whitespace-nowrap ${getPaymentStatusColor(row.original.payment_status_code)}`}>{row.original.payment_status_label || '-'}</span>
        }
    },
    {
        id: 'actions',
        header: 'Acciones',
        size: 100,
        cell: ({ row }) => {
            if (row.getIsGrouped()) return null;
            const tx = row.original;
            return (
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {tx.status === 'VENCIDO' && <button onClick={(e) => { e.stopPropagation(); setCollectionData(tx); }} className="w-7 h-7 flex items-center justify-center text-orange-500 hover:bg-orange-50 rounded transition-colors" title="Cobranza"><i className="fa-solid fa-bell text-[10px]"></i></button>}
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/app/financials/edit?id=${tx.id_transaction}`); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id_transaction); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                </div>
            );
        }
    }
  ], [grouping]);

  // --- TABLE INSTANCE ---
  const table = useReactTable({
    data: transactions,
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
  });

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans text-slate-700">
      
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* 1. KPIs SECTION (Encima de la tabla) */}
      {kpiSummary && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <KpiCard title="Ventas Mes" value={kpiSummary.ventasMes} icon="fa-chart-line" color="blue" subtext="Emitido en periodo" />
          <KpiCard title="Ingresos Reales" value={kpiSummary.cobradoMes} icon="fa-sack-dollar" color="green" subtext="Dinero ingresado a caja" />
          <KpiCard title="Por Cobrar" value={kpiSummary.porCobrarTotal} icon="fa-wallet" color="orange" subtext="Deuda total histórica" />
          <KpiCard title="Vencido" value={kpiSummary.vencidoTotal} icon="fa-triangle-exclamation" color="red" subtext="Cartera vencida acumulada" />
        </div>
      )}

      {/* 2. TOOLBAR */}
      <div className="bg-white border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* BUSCADOR */}
        <div className="relative order-3 lg:order-1 w-full lg:flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
                value={globalFilter} 
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Buscar factura, cliente..." 
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
        </div>

        {/* CONTROLES EXTRA (Fechas, Toggle, Agrupar) */}
        <div className="order-2 lg:order-2 w-full lg:w-auto flex items-center justify-start lg:justify-center flex-wrap gap-3">
            
            {/* Selector Año/Mes */}
            {(() => {
                // Filtrar años válidos (que tengan months_available y al menos un mes)
                const validYears = availableList.filter(y => Array.isArray(y.months_available) && y.months_available.length > 0);
                if (validYears.length > 0) {
                    return <>
                        <DateRangeSelector 
                            availableList={availableList}
                            selectedYear={selectedYear}
                            selectedMonth={selectedMonth}
                            onChange={(start, end) => setDateRange({ start, end })}
                            onYearChange={(year) => setSelectedYear(year)}
                            onMonthChange={(month) => setSelectedMonth(month)}
                        />
                        {/* Botón Ir a Hoy */}
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
                            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold uppercase text-slate-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap flex items-center gap-2"
                            title="Ir al mes actual"
                        >
                            <i className="fa-solid fa-calendar-check"></i>Hoy
                        </button>
                    </>;
                } else {
                    return <span className="text-xs text-slate-400">No hay registros disponibles aún.</span>;
                }
            })()}

            {/* Toggle Pendientes */}
            <button 
                onClick={() => setIncludeOpen(!includeOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-[11px] font-bold uppercase whitespace-nowrap ${includeOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                title="Marcar esto hará que siempre se vean los pendientes y vencidos primero sin importar el mes o año de selección"
            >
                <div className={`w-2 h-2 rounded-full ${includeOpen ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                Ver Pendientes
            </button>

            {/* Agrupar */}
            <div className="flex items-center justify-start lg:justify-center flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                <span className="text-[11px] font-black text-slate-400 px-2 uppercase">Agrupar:</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {[
                        { id: 'client_company_name', icon: 'fa-building', label: 'Cliente' },
                        { id: 'status', icon: 'fa-list-check', label: 'Estado' },
                        { id: 'transaction_type', icon: 'fa-tag', label: 'Tipo' }
                    ].map(opt => (
                        <button 
                            key={opt.id} 
                            onClick={() => setGrouping(prev => prev.includes(opt.id) ? [] : [opt.id])}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                                grouping.includes(opt.id) ? 'bg-brand-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <i className={`fa-solid ${opt.icon} text-[11px]`}></i> {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* BOTÓN NUEVA */}
        <button 
          onClick={() => navigate('/app/financials/new')} 
          className="order-1 lg:order-3 w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm border border-emerald-700 transition-all flex items-center justify-center gap-2"
        >
            <i className="fa-solid fa-plus"></i> Nueva
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
                    <th key={header.id} style={{ width: header.getSize() }} className="border-b border-r border-slate-200 bg-slate-50 px-4 py-2 text-left relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {{ asc: <i className="fa-solid fa-sort-up text-brand-600"></i>, desc: <i className="fa-solid fa-sort-down text-brand-600"></i> }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        {header.column.id !== 'actions' && canFilter && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveFilterMenu(activeFilterMenu === header.column.id ? null : header.column.id); }} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isFiltered ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}><i className={`fa-solid ${isDate ? 'fa-calendar' : 'fa-filter'} text-[10px]`}></i></button>
                        )}
                      </div>

                      {/* MENÚ DE FILTRO */}
                      {activeFilterMenu === header.column.id && (
                        <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 py-3 animate-in fade-in slide-in-from-top-1">
                          {isDate ? (
                            <div className="px-4 space-y-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rango de fechas</span>
                                <input type="date" className="w-full text-xs border rounded p-1.5 outline-none focus:border-brand-500" onChange={e => header.column.setFilterValue((old:any) => ({ ...old, start: e.target.value }))} />
                                <input type="date" className="w-full text-xs border rounded p-1.5 outline-none focus:border-brand-500" onChange={e => header.column.setFilterValue((old:any) => ({ ...old, end: e.target.value }))} />
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto px-1 custom-scrollbar">
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
                <tr><td colSpan={columns.length} className="py-24 text-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-3"></i><p className="text-slate-400 text-sm font-medium">Cargando datos...</p></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-24 text-center text-slate-500">No se encontraron transacciones.</td></tr>
            ) : table.getRowModel().rows.map(row => {
                const isGrouped = row.getIsGrouped();
                return (
                    <tr 
                        key={row.id} 
                        onClick={() => { if(isGrouped) row.toggleExpanded(); else navigate(`/app/financials/${row.original.id_transaction}`); }}
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

      {/* FOOTER */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-6">
            <span>{transactions.length} REGISTROS</span>
            <span className="text-brand-600">TOTAL: {formatCurrency(transactions.reduce((acc, t) => acc + Number(t.total_value || 0), 0))}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="bg-white px-3 py-1 border border-slate-200 rounded shadow-sm text-brand-600 font-black tracking-normal">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 hover:text-brand-600 disabled:opacity-20 transition-colors"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
      </div>

      {/* MODALS (Iguales que antes) */}
      <ConfirmModal isOpen={Boolean(deleteId)} title="¿Seguro desea eliminar este registro?" message="Esta acción es irreversible." onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
      
      {collectionData && (
        <CollectionModal isOpen={true} onClose={() => setCollectionData(null)} onSend={async (data) => { await financialService.notifyOverdue({ id_transaction: collectionData.id_transaction, id_tenant: user.id_tenant, id_user: user.id_user, ...data }); setCollectionData(null); setToast({ message: 'Notificación enviada', type: 'success' }); }} transactionData={{ id_transaction: collectionData.id_transaction, invoice_number: collectionData.invoice_number, id_client_company: collectionData.id_client_company || (collectionData as any).id_empresa_cliente, automation_enabled: collectionData.enable_automation, automation_frequency: collectionData.automation_frequency, automation_recipients: collectionData.automation_recipients }} />
      )}

      {paymentModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800">Registrar Pago</h3><button onClick={() => setPaymentModal(p => ({...p, isOpen:false}))} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button></div>
                  <div className="p-6 space-y-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label><input type="date" value={paymentModal.date} onChange={e => setPaymentModal(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto</label><div className="relative"><span className="absolute left-3 top-2 text-slate-400">$</span><input type="number" value={paymentModal.amount} onChange={e => setPaymentModal(p => ({...p, amount: parseFloat(e.target.value)}))} className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" /></div></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Método</label><select value={paymentModal.method} onChange={e => setPaymentModal(p => ({...p, method: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="CHEQUE">Cheque</option></select></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Referencia</label><input type="text" placeholder="Ej: #12345" value={paymentModal.ref} onChange={e => setPaymentModal(p => ({...p, ref: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2"><button onClick={() => setPaymentModal(p => ({...p, isOpen:false}))} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">Cancelar</button><button onClick={confirmPayment} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm">Confirmar Pago</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

// Helper faltante (debe estar arriba o importado)
const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default FinancialsList;
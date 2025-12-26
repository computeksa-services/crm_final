import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CollectionModal from '../components/CollectionModal';
import type { FinancialTransaction, ClientCompany } from '../types';

type KpiSummary = {
  ventasMes: number;
  porCobrarTotal: number;
  vencidoTotal: number;
  cobradoMes: number;
};

type MonthAvailable = {
  month: number;
  count: number;
};

type YearWithMonths = {
  year: number;
  months_available: MonthAvailable[];
};

type FiltersState = {
  status: string;
  transactionType: string;
  clientCompany: string;
  searchTerm: string;
};

// Función auxiliar para obtener el rango del mes actual
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  return {
    start: formatDate(start),
    end: formatDate(end)
  };
};

// --- COMPONENTE INTERNO: Tarjeta KPI ---
const KpiCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'orange';
  subtext?: string;
}> = ({ title, value, icon, color, subtext }) => {
  const colors: Record<'blue' | 'green' | 'red' | 'orange', string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]} flex flex-col justify-between h-full`}>
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] font-bold uppercase opacity-70 tracking-wider">{title}</span>
        <i className={`fa-solid ${icon} text-sm opacity-80`}></i>
      </div>
      <div>
        <div className="text-lg font-black font-mono">
          ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        {subtext && <div className="text-[9px] mt-0.5 opacity-70 font-medium">{subtext}</div>}
      </div>
    </div>
  );
};

// --- COMPONENTE INTERNO: Selector Inline con Posicionamiento Inteligente ---
const InlineBadgeSelector: React.FC<{
  valueId: string;
  items: { id: string; name: string; color?: string; icon?: string }[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}> = ({ valueId, items, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 224 });
  const current = items.find(i => i.id === valueId);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => setIsOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !buttonRef.current) return;

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(items.length * 36 + 10, 256);
    const dropdownWidth = 224;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownHeight && rect.top > spaceBelow;
    const top = openUpwards ? rect.top - dropdownHeight - 5 : rect.bottom + 5;

    const spaceRight = window.innerWidth - rect.left;
    let left = rect.left;
    if (spaceRight < dropdownWidth) {
      left = rect.right - dropdownWidth;
    }

    setCoords({ top, left, width: dropdownWidth });
    setIsOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`inline-flex items-center px-2 py-1 rounded-lg border text-[13px] font-bold whitespace-nowrap ${
          disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-slate-300'
        }`}
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

      {isOpen && (
        <div
          ref={dropdownRef}
          onMouseLeave={() => {
            leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), 300);
          }}
          onMouseEnter={() => {
            if (leaveTimeoutRef.current) {
              clearTimeout(leaveTimeoutRef.current);
              leaveTimeoutRef.current = null;
            }
          }}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-auto animate-fade-in"
          style={{
            top: coords.top,
            left: coords.left,
            width: coords.width,
            maxHeight: '256px'
          }}
        >
          {items.filter(item => item.id !== valueId).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(item.id); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm border-b border-slate-50 last:border-0"
            >
              <span
                className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px] font-bold"
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
    </>
  );
};

// --- COMPONENTE INTERNO: Dropdown de Filtro Superior (Barra de búsqueda) ---
const StatusInterestFilter: React.FC<{
  placeholder: string;
  selectedId: string;
  onChange: (val: string) => void;
  items: { id: string; name: string; color?: string; icon?: string; count?: number }[];
}> = ({ placeholder, selectedId, onChange, items }) => {
  const [open, setOpen] = useState(false);
  const current = items.find(i => i.id === selectedId);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

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

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem] lg:min-w-[18rem] max-w-[26rem]" onMouseLeave={handleMouseLeave} onMouseEnter={handleMouseEnter}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
      >
        {current ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
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
                className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
                style={{
                  backgroundColor: `${item.color || '#cccccc'}15`,
                  color: item.color || '#333333',
                  borderColor: `${item.color || '#cccccc'}40`
                }}
              >
                {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                {item.name}
              </span>
              {item.count !== undefined && (
                <span className="text-xs text-slate-400 ml-2">({item.count})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE INTERNO: Dropdown de Filtro ---
const FilterDropdown: React.FC<{
  placeholder: string;
  selectedId: string;
  onChange: (val: string) => void;
  items: { id: string; name: string; color?: string; icon?: string; count?: number }[];
}> = ({ placeholder, selectedId, onChange, items }) => {
  const [open, setOpen] = useState(false);
  const current = items.find(i => i.id === selectedId);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

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

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-auto md:min-w-[16rem] lg:min-w-[18rem] max-w-[26rem]" onMouseLeave={handleMouseLeave} onMouseEnter={handleMouseEnter}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
      >
        {current ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
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
                className="inline-flex items-center px-2 py-0.5 rounded-lg border text-[13px] font-bold"
                style={{
                  backgroundColor: `${item.color || '#cccccc'}15`,
                  color: item.color || '#333333',
                  borderColor: `${item.color || '#cccccc'}40`
                }}
              >
                {item.icon && <i className={`${item.icon} mr-1.5`}></i>}
                {item.name}
              </span>
              {item.count !== undefined && (
                <span className="text-xs text-slate-400 ml-2">({item.count})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Componente auxiliar para mostrar icono de ordenamiento (igual que DealsList) ---
const SortIcon: React.FC<{ column: string; sortConfig: { key: string; direction: 'asc' | 'desc' } }> = ({ column, sortConfig }) => {
  if (sortConfig.key !== column) return <i className="fa-solid fa-sort text-slate-300 ml-1 text-xs"></i>;
  return <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-brand-600 ml-1 text-xs`}></i>;
};

const FinancialsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary | null>(null);
  const [availableList, setAvailableList] = useState<YearWithMonths[]>([]);
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  
  // dateRange - con persistencia en localStorage
  const [dateRange, setDateRange] = useState(() => {
    try {
      const saved = localStorage.getItem('financials-date-range');
      return saved ? JSON.parse(saved) : getCurrentMonthRange();
    } catch {
      return getCurrentMonthRange();
    }
  });
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Confirm modal
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filters - con persistencia en localStorage
  const [filters, setFilters] = useState<FiltersState>(() => {
    try {
      const saved = localStorage.getItem('financials-filters');
      return saved ? JSON.parse(saved) : {
        status: '',
        transactionType: '',
        clientCompany: '',
        searchTerm: '',
      };
    } catch {
      return {
        status: '',
        transactionType: '',
        clientCompany: '',
        searchTerm: '',
      };
    }
  });

  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string[] }>(() => {
    try {
      const saved = localStorage.getItem('financials-column-filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const [dateFilters, setDateFilters] = useState<Record<string, { start: string; end: string }>>(() => {
    try {
      const saved = localStorage.getItem('financials-date-filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => {
    try {
      const saved = localStorage.getItem('financials-sort-config');
      return saved ? JSON.parse(saved) : { key: '', direction: 'asc' };
    } catch {
      return { key: '', direction: 'asc' };
    }
  });
  const initializedDateFilter = useRef(false);

  // Dropdowns
  const [dropdownStates, setDropdownStates] = useState({
    status: false,
    transactionType: false,
    clientCompany: false,
  });
  const leaveTimeoutRef = useRef<number | null>(null);

  // Payment details modal for PAGADO status
  const [paymentModalState, setPaymentModalState] = useState<{
    isOpen: boolean;
    transaction: FinancialTransaction | null;
    paymentDate: string;
    paymentMethod: string;
    paymentReference: string;
  }>({
    isOpen: false,
    transaction: null,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    paymentReference: '',
  });

  // Status change confirmation
  const [statusConfirmState, setStatusConfirmState] = useState<{
    isOpen: boolean;
    transaction: FinancialTransaction | null;
    newStatus: string;
  }>({ isOpen: false, transaction: null, newStatus: '' });

  // Edit modal state
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<FinancialTransaction>>({});
  const [editHasChanges, setEditHasChanges] = useState(false);

  // Cobranza manual (enviar notificación y configurar recordatorios)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionTransaction, setCollectionTransaction] = useState<FinancialTransaction | null>(null);
  const [sendingCollection, setSendingCollection] = useState(false);

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('financials-filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('financials-column-filters', JSON.stringify(columnFilters));
  }, [columnFilters]);

  useEffect(() => {
    localStorage.setItem('financials-date-filters', JSON.stringify(dateFilters));
  }, [dateFilters]);

  useEffect(() => {
    localStorage.setItem('financials-sort-config', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    localStorage.setItem('financials-date-range', JSON.stringify(dateRange));
  }, [dateRange]);

  // Verificar acceso
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.rol_user !== 'admin' && user.rol_user !== 'superadmin') {
      setToast({ message: 'Acceso denegado. Solo administradores pueden ver finanzas.', type: 'error' });
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [user, navigate]);

  // Cuando se abre el modal de edición, inicializar el formulario
  useEffect(() => {
    if (editingTransaction) {
      setEditFormData({ ...editingTransaction });
      setEditHasChanges(false);
    }
  }, [editingTransaction]);

  // Normaliza fechas a formato YYYY-MM-DD
  const normalizeDateStr = (dateStr?: string) => {
    if (!dateStr) return '';
    // Si viene en DD/MM/YYYY, convertir
    if (dateStr.includes('/')) {
      const [dd, mm, yyyy] = dateStr.split('/');
      if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    // Si viene con tiempo ISO, tomar solo la fecha
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    return dateStr;
  };

  const updateDateFilter = (column: string, type: 'start' | 'end', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [column]: { ...(prev[column] || { start: '', end: '' }), [type]: value }
    }));
  };

  const clearDateFilter = (column: string) => {
    setDateFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
  };

  const getUniqueValues = (column: string) => {
    const values = new Map<string, number>();
    transactions.forEach(tx => {
      let val = '';
      if (column === 'status') val = tx.status;
      else if (column === 'transaction_type') val = tx.transaction_type;
      else if (column === 'client_name') val = tx.client_company_name || '';
      else if (column === 'invoice_number') val = tx.invoice_number || '';
      if (val) {
        values.set(val, (values.get(val) || 0) + 1);
      }
    });
    return Array.from(values.entries()).map(([value, count]) => ({ value, label: value, count }));
  };

  const fetchTransactions = useCallback(async () => {
    if (!user?.id_tenant) return;
    
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        id_tenant: user.id_tenant,
        start_date: dateRange.start,
        end_date: dateRange.end
      });
      
      const response = await fetch(`https://service.computeksa.com/webhook/api/financials?${queryParams.toString()}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al cargar transacciones');
      const data = await response.json();
      console.log('Financials API Response:', data);
      console.log('Transactions array:', (data as any)?.transactions || data);

      const parseNumber = (value: any) => {
        const numeric = parseFloat(value ?? 0);
        return Number.isFinite(numeric) ? numeric : 0;
      };

      let kpiBlock: any = null;
      let listaBlock: any = null;
      let transactionsArray: any[] = [];

      // Nuevo formato: [{ kpis: {...}, lista: {...}, transactions: [...] }]
      if (Array.isArray(data)) {
        const first = data[0] || {};
        if (first.kpis) {
          kpiBlock = first.kpis;
          listaBlock = first.lista;
          transactionsArray = Array.isArray(first.transactions) ? first.transactions : [];
        } else if (Array.isArray(first.transactions)) {
          transactionsArray = first.transactions;
        } else {
          transactionsArray = data as any[];
        }
      } else if (data && typeof data === 'object') {
        if ((data as any).kpis) kpiBlock = (data as any).kpis;
        if ((data as any).lista) listaBlock = (data as any).lista;
        if (Array.isArray((data as any).transactions)) {
          transactionsArray = (data as any).transactions;
        }
      }

      // Formato legado: primera fila trae KPIs y el resto son transacciones
      if (!kpiBlock && transactionsArray.length === 0 && Array.isArray(data)) {
        const rawArray = data as any[];
        if (rawArray.length > 0) {
          const firstRow = rawArray[0] || {};
          const hasKpiFields = ['ventas_mes', 'por_cobrar_total', 'vencido_total', 'cobrado_mes'].some(key => firstRow[key] !== undefined && firstRow[key] !== null);
          if (hasKpiFields) {
            kpiBlock = firstRow;
            transactionsArray = rawArray.slice(1);
          } else {
            transactionsArray = rawArray;
          }
        }
      }

      if (kpiBlock) {
        setKpiSummary({
          ventasMes: parseNumber(kpiBlock.ventas_periodo ?? kpiBlock.ventas_mes ?? kpiBlock.ventasMes),
          porCobrarTotal: parseNumber(kpiBlock.por_cobrar_total ?? kpiBlock.porCobrarTotal),
          vencidoTotal: parseNumber(kpiBlock.vencido_total ?? kpiBlock.vencidoTotal),
          cobradoMes: parseNumber(kpiBlock.cobrado_periodo ?? kpiBlock.cobrado_mes ?? kpiBlock.cobradoMes),
        });
      } else {
        setKpiSummary(null);
      }

      if (listaBlock && Array.isArray(listaBlock)) {
        setAvailableList(listaBlock.filter((item: any) => 
          item && item.year && Array.isArray(item.months_available)
        ));
      } else {
        setAvailableList([]);
      }

      if (!Array.isArray(transactionsArray)) transactionsArray = [];

      // Filtrar objetos vacíos (registros fantasma)
      transactionsArray = transactionsArray.filter((tx: any) => 
        tx && typeof tx === 'object' && (tx.id_transaction || tx.id_transaccion)
      );

      // Normalizar montos para soportar campos del backend (monto_total, monto_abonado, saldo_pendiente)
      const normalized = transactionsArray.map((tx: any) => {
        const totalValue = parseFloat(tx.total_factura || tx.monto_total || tx.total_value || 0) || 0;
        const paidAmount = parseFloat(tx.v_total_abonado || tx.monto_pagado_caja || tx.monto_abonado || tx.paid_amount || 0) || 0;
        const balanceDue = tx.v_saldo_pendiente !== undefined && tx.v_saldo_pendiente !== null
          ? parseFloat(tx.v_saldo_pendiente)
          : (tx.saldo_pendiente !== undefined && tx.saldo_pendiente !== null
            ? parseFloat(tx.saldo_pendiente)
            : totalValue - paidAmount);

        return {
          ...tx,
          id_transaction: tx.id_transaction || tx.id_transaccion,
          transaction_type: tx.transaction_type || tx.tipo_transaccion,
          invoice_number: tx.invoice_number || tx.numero_factura,
          description: tx.description || tx.descripcion_concepto,
          status: tx.status || tx.estado_registro,
          issue_date_input: tx.issue_date_input || tx.v_input_fecha_emision,
          due_date_input: tx.due_date_input || tx.v_input_fecha_vencimiento,
          payment_date_input: tx.payment_date_input || tx.v_input_fecha_pago,
          retention_date_input: tx.retention_date_input || tx.v_input_fecha_retencion,
          payment_status_code: tx.payment_status_code || tx.v_codigo_estado,
          payment_status_label: tx.payment_status_label || tx.v_etiqueta_estado,
          client_name: tx.client_name || tx.nombre_cliente_proveedor,
          client_company_name: tx.client_company_name || tx.nombre_cliente_proveedor,
          client_ruc: tx.client_ruc || tx.ruc_cliente_proveedor,
          total_value: totalValue,
          paid_amount: paidAmount,
          balance_due: balanceDue,
          subtotal: parseFloat(tx.subtotal || 0) || 0,
          tax_amount: parseFloat(tx.impuestos || tx.tax_amount || 0) || 0,
          retention_value: parseFloat(tx.valor_retencion || tx.retention_value || 0) || 0,
        } as FinancialTransaction;
      });

      console.log('Setting transactions:', normalized);
      setTransactions(normalized);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setToast({ message: 'Error al cargar transacciones financieras', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, dateRange]);

  // Función ligera para actualizar solo los KPIs sin recargar todas las transacciones
  const updateKpisOnly = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const queryParams = new URLSearchParams({
        id_tenant: user.id_tenant,
        start_date: dateRange.start,
        end_date: dateRange.end
      });
      
      const response = await fetch(`https://service.computeksa.com/webhook/api/financials?${queryParams.toString()}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) return;
      const data = await response.json();

      const parseNumber = (value: any) => {
        const numeric = parseFloat(value ?? 0);
        return Number.isFinite(numeric) ? numeric : 0;
      };

      let kpiBlock: any = null;

      // Extraer KPIs de la respuesta
      if (Array.isArray(data)) {
        const first = data[0] || {};
        if (first.kpis) {
          kpiBlock = first.kpis;
        }
      } else if (data && typeof data === 'object') {
        if ((data as any).kpis) kpiBlock = (data as any).kpis;
      }

      // Formato legado
      if (!kpiBlock && Array.isArray(data)) {
        const rawArray = data as any[];
        if (rawArray.length > 0) {
          const firstRow = rawArray[0] || {};
          const hasKpiFields = ['ventas_mes', 'por_cobrar_total', 'vencido_total', 'cobrado_mes'].some(key => firstRow[key] !== undefined && firstRow[key] !== null);
          if (hasKpiFields) {
            kpiBlock = firstRow;
          }
        }
      }

      if (kpiBlock) {
        setKpiSummary({
          ventasMes: parseNumber(kpiBlock.ventas_periodo ?? kpiBlock.ventas_mes ?? kpiBlock.ventasMes),
          porCobrarTotal: parseNumber(kpiBlock.por_cobrar_total ?? kpiBlock.porCobrarTotal),
          vencidoTotal: parseNumber(kpiBlock.vencido_total ?? kpiBlock.vencidoTotal),
          cobradoMes: parseNumber(kpiBlock.cobrado_periodo ?? kpiBlock.cobrado_mes ?? kpiBlock.cobradoMes),
        });
      }
    } catch (error) {
      console.error('Error updating KPIs:', error);
    }
  }, [user, dateRange]);

  const handleStatusClick = (tx: FinancialTransaction, newStatus: string) => {
    setStatusConfirmState({ isOpen: true, transaction: tx, newStatus });
  };

  const confirmStatusChange = () => {
    const { transaction: tx, newStatus } = statusConfirmState;
    if (!tx) return;

    setStatusConfirmState({ isOpen: false, transaction: null, newStatus: '' });

    if (newStatus === 'PAGADO') {
      setPaymentModalState({
        isOpen: true,
        transaction: tx,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        paymentReference: '',
      });
    } else {
      handleStatusUpdate(tx, newStatus, {});
    }
  };

  const handleSavePaymentDetails = async () => {
    const { transaction: tx, paymentDate, paymentMethod, paymentReference } = paymentModalState;
    if (!tx) return;

    // Convert date from YYYY-MM-DD to DD/MM/YYYY
    const convertDateFormat = (dateStr: string) => {
      if (!dateStr) return null;
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };

    const paymentDetails = {
      payment_date: convertDateFormat(paymentDate),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
    };

    setPaymentModalState(prev => ({ ...prev, isOpen: false }));
    await handleStatusUpdate(tx, 'PAGADO', paymentDetails);
  };

  const handleStatusUpdate = async (tx: FinancialTransaction, newStatus: string, paymentDetails: any = {}) => {
    if (!user) return;
    try {
      const payload: any = {
        ...tx,
        status: newStatus,
        id_transaction: tx.id_transaction,
        id_tenant: user.id_tenant,
        created_by: tx.created_by || user.id_user,
        total_value: tx.total_value,
        paid_amount: tx.paid_amount,
        balance_due: tx.balance_due,
        subtotal: tx.subtotal,
        tax_amount: tx.tax_amount,
        retention_value: tx.retention_value,
        ...paymentDetails,
      };

      // Cuando se marca como pagado, enviamos también el saldo pendiente actual
      if (newStatus === 'PAGADO') {
        payload.balance_due = parseFloat((tx.balance_due || tx.balance || 0) as any) || 0;
        payload.paid_amount = parseFloat(tx.paid_amount as any || 0) || 0;
        payload.total_value = parseFloat(tx.total_value as any || 0) || 0;
        payload.subtotal = parseFloat(tx.subtotal as any || 0) || 0;
        payload.tax_amount = parseFloat(tx.tax_amount as any || 0) || 0;
        payload.retention_value = parseFloat(tx.retention_value as any || 0) || 0;
      }

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al actualizar el estado');

      // Actualizar estado local SIN tocar KPIs
      setTransactions(prev => prev.map(item => {
        if (item.id_transaction === tx.id_transaction) {
          return {
            ...item,
            status: newStatus as 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO',
            balance_due: payload.balance_due !== undefined ? payload.balance_due : item.balance_due,
            payment_date: paymentDetails.payment_date || item.payment_date,
            payment_method: paymentDetails.payment_method || item.payment_method,
            payment_reference: paymentDetails.payment_reference || item.payment_reference,
          };
        }
        return item;
      }));
      
      setToast({ message: 'Estado actualizado correctamente.', type: 'success' });
      
      // Recargar solo KPIs (sin parpadear la tabla)
      setTimeout(() => updateKpisOnly(), 300);
    } catch (error: any) {
      console.error('Error updating status:', error);
      setToast({ message: error?.message || 'No se pudo actualizar el estado.', type: 'error' });
    } finally {
      setStatusConfirmState({ isOpen: false, transaction: null, newStatus: '' });
    }
  };

  const fetchClientCompanies = async () => {
    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${user?.id_tenant}&id_user=${user?.id_user}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setClientCompanies([]);
          return;
        }
        throw new Error('Error al cargar empresas');
      }
      
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      console.log('Client Companies loaded:', data.length);
      setClientCompanies(data);
    } catch (error) {
      console.error('Error fetching client companies:', error);
      setClientCompanies([]);
    }
  };

  // Fetch client companies once
  useEffect(() => {
    if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return;
    fetchClientCompanies();
  }, [user]);

  // Fetch transactions when dateRange changes
  useEffect(() => {
    if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return;
    fetchTransactions();
  }, [user, dateRange, fetchTransactions]);

  // Sorting
  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: newValues };
    });
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('https://service.computeksa.com/webhook/api/financials/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaction: id }),
      });

      if (!response.ok) throw new Error('Error al eliminar');
      
      setToast({ message: 'Transacción eliminada correctamente', type: 'success' });
      fetchTransactions();
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al eliminar la transacción', type: 'error' });
    }
  };

  // Abrir modal de cobranza manual
  const openCollectionModal = (transaction: FinancialTransaction) => {
    setCollectionTransaction(transaction);
    setIsCollectionModalOpen(true);
  };

  // Enviar notificación manual con selección de destinatarios
  const handleSendCollection = async (modalData: { recipients: Array<{ email: string; name: string; type: string; id: string | null }>; update_automation: { enabled: boolean; frequency: number } }) => {
    if (!collectionTransaction || !user) return;
    setSendingCollection(true);
    try {
      const payload = {
        id_transaction: collectionTransaction.id_transaction,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        recipients: modalData.recipients,
        update_automation: modalData.update_automation,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/notify-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al notificar al cliente.');

      setToast({ message: 'Notificación enviada correctamente.', type: 'success' });
      setIsCollectionModalOpen(false);
      setCollectionTransaction(null);
      fetchTransactions();
    } catch (error: any) {
      console.error('Error notifying client:', error);
      setToast({ message: error?.message || 'No se pudo notificar al cliente.', type: 'error' });
    } finally {
      setSendingCollection(false);
    }
  };

  // Confirm handlers
  const openDeleteConfirm = (transaction: FinancialTransaction) => {
    setConfirmState({
      isOpen: true,
      title: '¿Eliminar transacción?',
      message: `Se eliminará la transacción #${transaction.invoice_number}. Esta acción no se puede deshacer.`,
      onConfirm: () => {
        handleDelete(transaction.id_transaction);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const openNotifyConfirm = (transaction: FinancialTransaction) => {
    openCollectionModal(transaction);
  };

  // Edit handlers
  const handleEditChange = (field: string, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    setEditHasChanges(true);
  };

  const handleCloseEditModal = () => {
    if (editHasChanges) {
      setConfirmState({
        isOpen: true,
        title: '¿Descartar cambios?',
        message: 'Has realizado cambios que no se han guardado. ¿Estás seguro de que deseas descartar los cambios?',
        onConfirm: () => {
          setEditingTransaction(null);
          setEditFormData({});
          setEditHasChanges(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        },
      });
    } else {
      setEditingTransaction(null);
      setEditFormData({});
      setEditHasChanges(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !user) return;
    try {
      const payload: any = {
        ...editFormData,
        id_transaction: editingTransaction.id_transaction,
        id_tenant: user.id_tenant,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar cambios');

      setToast({ message: 'Transacción actualizada correctamente', type: 'success' });
      setEditingTransaction(null);
      setEditFormData({});
      setEditHasChanges(false);
      
      // Recargar y recalcular KPIs
      fetchTransactions();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      setToast({ message: error?.message || 'Error al guardar la transacción', type: 'error' });
    }
  };

  // Filter and sort logic with useMemo
  const processedTransactions = React.useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(t =>
        t.invoice_number?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.client_company_name?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filters.status) {
      result = result.filter(t => t.status === filters.status);
    }

    // Type filter
    if (filters.transactionType) {
      result = result.filter(t => t.transaction_type === filters.transactionType);
    }

    // Client filter
    if (filters.clientCompany) {
      result = result.filter(t => t.id_client_company === filters.clientCompany);
    }

    // Column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        result = result.filter(tx => {
          let val = '';
          if (column === 'status') val = tx.status;
          else if (column === 'transaction_type') val = tx.transaction_type;
          else if (column === 'client_name') val = tx.client_company_name || '';
          return values.includes(val);
        });
      }
    });

    // Date range filters
    Object.entries(dateFilters).forEach(([column, range]) => {
      const start = range?.start || '';
      const end = range?.end || '';
      if (!start && !end) return;

      result = result.filter(tx => {
        let raw = '';
        if (column === 'issue_date_input') {
          raw = tx.invoice_date || tx.issue_date || tx.issue_date_input || '';
        } else if (column === 'due_date_input') {
          raw = tx.due_date || tx.due_date_input || '';
        }
        const dateVal = normalizeDateStr(raw);
        if (!dateVal) return false;
        if (start && dateVal < start) return false;
        if (end && dateVal > end) return false;
        return true;
      });
    });

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal: any = (a as any)[sortConfig.key];
        let bVal: any = (b as any)[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [transactions, filters, columnFilters, sortConfig, dateFilters]);

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: string; label: string }> = {
      PENDIENTE: { color: '#f59e0b', icon: 'fa-clock', label: 'Pendiente' },
      PAGADO: { color: '#10b981', icon: 'fa-circle-check', label: 'Pagado' },
      VENCIDO: { color: '#ef4444', icon: 'fa-circle-exclamation', label: 'Vencido' },
      ANULADO: { color: '#6b7280', icon: 'fa-ban', label: 'Anulado' },
    };
    const s = statusMap[status] || statusMap.PENDIENTE;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[13px] font-bold"
        style={{
          backgroundColor: `${s.color}15`,
          color: s.color,
          borderColor: `${s.color}40`,
        }}
      >
        <i className={`fa-solid ${s.icon}`}></i>
        {s.label}
      </span>
    );
  };

  // Type badge
  const getTypeBadge = (type: string) => {
    const typeMap: Record<string, { color: string; icon: string }> = {
      VENTA: { color: '#10b981', icon: 'fa-arrow-trend-up' },
      GASTO: { color: '#ef4444', icon: 'fa-arrow-trend-down' },
      OTRO: { color: '#6b7280', icon: 'fa-circle-question' },
    };
    const t = typeMap[type] || typeMap.OTRO;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[13px] font-bold"
        style={{
          backgroundColor: `${t.color}15`,
          color: t.color,
          borderColor: `${t.color}40`,
        }}
      >
        <i className={`fa-solid ${t.icon}`}></i>
        {type}
      </span>
    );
  };

  const getPaymentStatusColor = (code?: string) => {
    if (code === 'PAID') return 'bg-green-100 text-green-700 border-green-200';
    if (code === 'OVERDUE') return 'bg-red-100 text-red-700 border-red-200';
    if (code === 'WARNING') return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const formatDaysRemaining = (days?: number) => {
    if (days === undefined || days === null) return 'Sin dato';
    if (days === 0) return 'Hoy vence';
    if (days > 0) return `${days} días restantes`;
    return `${Math.abs(days)} días vencidos`;
  };

  // Dropdown handlers
  const handleMouseLeave = (key: keyof typeof dropdownStates) => {
    leaveTimeoutRef.current = setTimeout(() => {
      setDropdownStates(prev => ({ ...prev, [key]: false }));
    }, 300);
  };

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const clearAllFilters = () => {
    setFilters({
      status: '',
      transactionType: '',
      clientCompany: '',
      searchTerm: '',
    });
    setColumnFilters({});
    setDateFilters({});
    setSortConfig({ key: '', direction: 'asc' });
    setDateRange(getCurrentMonthRange());
    
    // Limpiar también el localStorage
    localStorage.removeItem('financials-filters');
    localStorage.removeItem('financials-column-filters');
    localStorage.removeItem('financials-date-filters');
    localStorage.removeItem('financials-sort-config');
    localStorage.removeItem('financials-date-range');
  };

  const handleMonthYearChange = (year: number, month: number) => {
    const newStart = new Date(year, month - 1, 1);
    const newEnd = new Date(year, month, 0);
    
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    setDateRange({
      start: formatDate(newStart),
      end: formatDate(newEnd)
    });
  };

  const getCurrentYearMonth = () => {
    const [year, month] = dateRange.start.split('-').map(Number);
    return { year, month };
  };

  const getMonthName = (monthNum: number) => {
    const date = new Date(2000, monthNum - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long' });
  };

  const resetToCurrentMonth = () => {
    setDateRange(getCurrentMonthRange());
  };

  const hasActiveFilters = React.useMemo(() => {
    const hasColumnFilters = Object.values(columnFilters).some(v => (v || []).length > 0);
    const hasDateFilters = Object.values(dateFilters).some(d => d?.start || d?.end);
    return Boolean(filters.status || filters.transactionType || filters.clientCompany || filters.searchTerm || hasColumnFilters || hasDateFilters);
  }, [filters, columnFilters, dateFilters]);

  // New transaction template
  const createNewTransaction = () => {
    navigate('/financials/new');
  };

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
        {processedTransactions.length > 0 && (
          <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span>Mostrando <span className="font-semibold text-slate-700">{processedTransactions.length}</span> de <span className="font-semibold text-slate-700">{transactions.length}</span> registros</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transacciones Financieras</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de facturas, pagos y gastos del tenant.</p>
        </div>
        <button
          onClick={createNewTransaction}
          className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <i className="fa-solid fa-plus"></i>
          Nueva Transacción
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-calendar text-slate-500 text-lg"></i>
          
            {availableList.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">Año:</label>
                  <select
                    value={getCurrentYearMonth().year}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      const yearData = availableList.find(y => y.year === newYear);
                      const firstMonth = yearData?.months_available[0]?.month || getCurrentYearMonth().month;
                      handleMonthYearChange(newYear, firstMonth);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-700"
                  >
                    {availableList.map((yearData) => (
                      <option key={yearData.year} value={yearData.year}>
                        {yearData.year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">Mes:</label>
                  <select
                    value={getCurrentYearMonth().month}
                    onChange={(e) => handleMonthYearChange(getCurrentYearMonth().year, parseInt(e.target.value))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-700 capitalize min-w-[140px]"
                  >
                    {availableList
                      .find(y => y.year === getCurrentYearMonth().year)
                      ?.months_available.sort((a, b) => b.month - a.month)
                      .map((m) => (
                        <option key={m.month} value={m.month}>
                          {getMonthName(m.month)} ({m.count})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="text-xs text-slate-500">
                  <i className="fa-solid fa-info-circle mr-1"></i>
                  {availableList.reduce((sum, yearData) => 
                    sum + yearData.months_available.reduce((s, m) => s + m.count, 0), 0
                  )} registros totales históricos.
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-500">Cargando periodos disponibles...</span>
              </div>
            )}
          </div>

          <button
            onClick={resetToCurrentMonth}
            className="px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-2"
            title="Volver al mes actual"
          >
            <i className="fa-solid fa-calendar-day"></i>
            Mes actual
          </button>
        </div>
      </div>

      {kpiSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KpiCard
              title="Ventas (Este Mes)"
              value={kpiSummary.ventasMes}
              icon="fa-chart-line"
              color="blue"
              subtext="Facturación emitida"
            />
            <KpiCard
              title="Ingresos Reales"
              value={kpiSummary.cobradoMes}
              icon="fa-hand-holding-dollar"
              color="green"
              subtext="Dinero recibido este mes"
            />
            <KpiCard
              title="Por Cobrar (Total)"
              value={kpiSummary.porCobrarTotal}
              icon="fa-wallet"
              color="orange"
              subtext="Pendiente de cobro histórico"
            />
            <KpiCard
              title="Vencido (Urgente)"
              value={kpiSummary.vencidoTotal}
              icon="fa-triangle-exclamation"
              color="red"
              subtext="Facturas expiradas"
            />
          </div>
        )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Reset button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Restablecer filtros"
            >
              <i className="fa-solid fa-filter-circle-xmark text-lg"></i>
            </button>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Buscar por factura, descripción o cliente..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Status filter */}
          <FilterDropdown
            placeholder="Todos los estados"
            selectedId={filters.status}
            onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
            items={[
              { id: 'PENDIENTE', name: 'Pendiente', color: '#f59e0b', icon: 'fa-solid fa-clock' },
              { id: 'PAGADO', name: 'Pagado', color: '#10b981', icon: 'fa-solid fa-circle-check' },
              { id: 'VENCIDO', name: 'Vencido', color: '#ef4444', icon: 'fa-solid fa-circle-exclamation' },
              { id: 'ANULADO', name: 'Anulado', color: '#6b7280', icon: 'fa-solid fa-ban' },
            ]}
          />

          {/* Type filter */}
          <FilterDropdown
            placeholder="Todos los tipos"
            selectedId={filters.transactionType}
            onChange={(val) => setFilters(prev => ({ ...prev, transactionType: val }))}
            items={[
              { id: 'VENTA', name: 'Venta', color: '#10b981', icon: 'fa-solid fa-arrow-trend-up' },
              { id: 'GASTO', name: 'Gasto', color: '#ef4444', icon: 'fa-solid fa-arrow-trend-down' },
              { id: 'OTRO', name: 'Otro', color: '#6b7280', icon: 'fa-solid fa-circle-question' },
            ]}
          />

         
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-visible w-full flex flex-col">
        <div style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '350px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="min-w-full text-left border-collapse" style={{ tableLayout: 'auto' }}>
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('invoice_number')}>
                      Factura <SortIcon column="invoice_number" sortConfig={sortConfig} />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('description')}>
                      Descripción <SortIcon column="description" sortConfig={sortConfig} />
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('client_company_name')}>
                      Cliente <SortIcon column="client_company_name" sortConfig={sortConfig} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'client_name' ? null : 'client_name'); }}
                      className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['client_name'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                      title="Filtrar por Cliente"
                    >
                      <i className="fa-solid fa-filter text-xs"></i>
                    </button>
                  </div>
                  {openFilterColumn === 'client_name' && (
                    <div
                      onMouseLeave={() => setOpenFilterColumn(null)}
                      className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-64 overflow-auto z-20"
                    >
                      {getUniqueValues('client_name').map(val => (
                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                          <input type="checkbox" checked={(columnFilters['client_name'] || []).includes(val.value)} onChange={() => toggleColumnFilter('client_name', val.value)} className="w-4 h-4" />
                          <span className="flex-1">{val.label}</span>
                          <span className="text-xs text-slate-400">({val.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('transaction_type')}>
                      Tipo <SortIcon column="transaction_type" sortConfig={sortConfig} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'transaction_type' ? null : 'transaction_type'); }}
                      className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['transaction_type'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                      title="Filtrar por Tipo"
                    >
                      <i className="fa-solid fa-filter text-xs"></i>
                    </button>
                  </div>
                  {openFilterColumn === 'transaction_type' && (
                    <div
                      onMouseLeave={() => setOpenFilterColumn(null)}
                      className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-64 overflow-auto z-20"
                    >
                      {getUniqueValues('transaction_type').map(val => (
                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                          <input type="checkbox" checked={(columnFilters['transaction_type'] || []).includes(val.value)} onChange={() => toggleColumnFilter('transaction_type', val.value)} className="w-4 h-4" />
                          <span className="flex-1">{val.label}</span>
                          <span className="text-xs text-slate-400">({val.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('status')}>
                      Estado <SortIcon column="status" sortConfig={sortConfig} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'status' ? null : 'status'); }}
                      className={`p-1 rounded hover:bg-slate-200 transition-colors ${(columnFilters['status'] || []).length > 0 ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                      title="Filtrar por Estado"
                    >
                      <i className="fa-solid fa-filter text-xs"></i>
                    </button>
                  </div>
                  {openFilterColumn === 'status' && (
                    <div
                      onMouseLeave={() => setOpenFilterColumn(null)}
                      className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-64 max-h-64 overflow-auto z-20"
                    >
                      {getUniqueValues('status').map(val => (
                        <label key={val.value} className="px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer text-sm text-slate-600 border-b border-slate-100 last:border-b-0">
                          <input type="checkbox" checked={(columnFilters['status'] || []).includes(val.value)} onChange={() => toggleColumnFilter('status', val.value)} className="w-4 h-4" />
                          <span className="flex-1">{val.label}</span>
                          <span className="text-xs text-slate-400">({val.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('issue_date_input')}>
                      Emisión <SortIcon column="issue_date_input" sortConfig={sortConfig} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'issue_date_input' ? null : 'issue_date_input'); }}
                      className={`p-1 rounded hover:bg-slate-200 transition-colors ${(dateFilters['issue_date_input']?.start || dateFilters['issue_date_input']?.end) ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                      title="Filtrar por fecha de emisión"
                    >
                      <i className="fa-solid fa-calendar text-xs"></i>
                    </button>
                  </div>
                  {openFilterColumn === 'issue_date_input' && (
                    <div
                      onMouseLeave={() => setOpenFilterColumn(null)}
                      className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 z-20"
                    >
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                          <input type="date" value={dateFilters['issue_date_input']?.start || ''} onChange={(e) => updateDateFilter('issue_date_input', 'start', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                          <input type="date" value={dateFilters['issue_date_input']?.end || ''} onChange={(e) => updateDateFilter('issue_date_input', 'end', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                        {(dateFilters['issue_date_input']?.start || dateFilters['issue_date_input']?.end) && (
                          <button type="button" onClick={() => clearDateFilter('issue_date_input')} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors">
                            <i className="fa-solid fa-times mr-1"></i> Limpiar filtro
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors relative group whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => requestSort('due_date_input')}>
                      Vence <SortIcon column="due_date_input" sortConfig={sortConfig} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(openFilterColumn === 'due_date_input' ? null : 'due_date_input'); }}
                      className={`p-1 rounded hover:bg-slate-200 transition-colors ${(dateFilters['due_date_input']?.start || dateFilters['due_date_input']?.end) ? 'bg-brand-100 text-brand-600' : 'text-slate-400'}`}
                      title="Filtrar por fecha de vencimiento"
                    >
                      <i className="fa-solid fa-calendar text-xs"></i>
                    </button>
                  </div>
                  {openFilterColumn === 'due_date_input' && (
                    <div
                      onMouseLeave={() => setOpenFilterColumn(null)}
                      className="absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 z-20"
                    >
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                          <input type="date" value={dateFilters['due_date_input']?.start || ''} onChange={(e) => updateDateFilter('due_date_input', 'start', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Hasta</label>
                          <input type="date" value={dateFilters['due_date_input']?.end || ''} onChange={(e) => updateDateFilter('due_date_input', 'end', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                        {(dateFilters['due_date_input']?.start || dateFilters['due_date_input']?.end) && (
                          <button type="button" onClick={() => clearDateFilter('due_date_input')} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors">
                            <i className="fa-solid fa-times mr-1"></i> Limpiar filtro
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-4 py-3 text-right bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort('subtotal')}>
                  <div className="flex items-center gap-2 justify-end">
                    Subtotal
                    <SortIcon column="subtotal" sortConfig={sortConfig} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right bg-slate-50 whitespace-nowrap">IVA %</th>
                <th className="px-4 py-3 text-right bg-slate-50 whitespace-nowrap">Valor IVA</th>
                <th className="px-4 py-3 text-right bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort('total_value')}>
                  <div className="flex items-center gap-2 justify-end">
                    Subtotal+IVA
                    <SortIcon column="total_value" sortConfig={sortConfig} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort('paid_amount')}>
                  <div className="flex items-center gap-2 justify-end">
                    Pagado
                    <SortIcon column="paid_amount" sortConfig={sortConfig} />
                  </div>
                </th>
                <th className="px-4 py-3 text-right bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => requestSort('balance_due')}>
                  <div className="flex items-center gap-2 justify-end">
                    Saldo
                    <SortIcon column="balance_due" sortConfig={sortConfig} />
                  </div>
                </th>
                <th className="px-4 py-3 bg-slate-50 whitespace-nowrap">Pago / Días</th>
                <th className="px-4 py-3 text-center bg-slate-50 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-slate-500">
                    <i className="fa-solid fa-inbox text-4xl mb-2 block text-slate-300"></i>
                    No hay transacciones que mostrar
                  </td>
                </tr>
              ) : (
                processedTransactions.map(transaction => (
                  <tr
                    key={transaction.id_transaction}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/financials/${transaction.id_transaction}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-sm text-slate-800">{transaction.invoice_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-400 max-w-xs italic">{transaction.description || 'Sin descripción'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-400 italic">{transaction.client_company_name || 'Sin cliente'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{getTypeBadge(transaction.transaction_type)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <InlineBadgeSelector
                        valueId={transaction.status}
                        items={[
                          { id: 'PENDIENTE', name: 'Pendiente', color: '#f59e0b', icon: 'fa-solid fa-clock' },
                          { id: 'PAGADO', name: 'Pagado', color: '#10b981', icon: 'fa-solid fa-circle-check' },
                          { id: 'VENCIDO', name: 'Vencido', color: '#ef4444', icon: 'fa-solid fa-circle-exclamation' },
                          { id: 'ANULADO', name: 'Anulado', color: '#6b7280', icon: 'fa-solid fa-ban' },
                        ]}
                        onSelect={(newStatus) => handleStatusClick(transaction, newStatus)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{transaction.issue_date_input || transaction.invoice_date?.split('T')[0] || transaction.issue_date?.split('T')[0] || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{transaction.due_date_input || transaction.due_date?.split('T')[0] || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 whitespace-nowrap">
                      ${parseFloat(transaction.subtotal as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 whitespace-nowrap">
                      {(() => {
                        const taxValue = parseFloat(transaction.tax_amount as any || 0);
                        return taxValue % 1 === 0 ? taxValue : taxValue.toFixed(2);
                      })()}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 whitespace-nowrap">
                      ${parseFloat(((parseFloat(transaction.subtotal as any || 0) * parseFloat(transaction.tax_amount as any || 0)) / 100).toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 whitespace-nowrap">
                      ${parseFloat(transaction.total_value as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600 whitespace-nowrap">
                      ${parseFloat(transaction.paid_amount as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 font-semibold whitespace-nowrap">
                      ${parseFloat((transaction.balance_due || transaction.balance) as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`inline-flex px-3 py-2 rounded-lg border text-sm font-semibold ${getPaymentStatusColor(transaction.payment_status_code)}`}>
                        <span className="leading-tight">{transaction.payment_status_label || 'Sin estado'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {transaction.status === 'VENCIDO' && (transaction.id_client_company || transaction.client_company_name) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openNotifyConfirm(transaction); }}
                            className={`p-2 rounded-lg transition-colors ${transaction.enable_automation ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                            title={transaction.enable_automation ? 'Automatización activa: se enviarán recordatorios' : 'Notificar vencimiento (activar automatización)'}
                          >
                            <i className="fa-solid fa-bell"></i>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTransaction(transaction); }}
                          className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteConfirm(transaction); }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {processedTransactions.length > 0 && (
          <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span>Mostrando <span className="font-semibold text-slate-700">{processedTransactions.length}</span> de <span className="font-semibold text-slate-700">{transactions.length}</span> registros</span>
            <span className="text-lg font-bold text-brand-700">Total: ${processedTransactions.reduce((sum, t) => {
              const val = typeof t.total_value === 'string' ? parseFloat(t.total_value) : (t.total_value || 0);
              return sum + (isNaN(val) ? 0 : val);
            }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </div>

    {/* Delete Confirm Modal */}
    <ConfirmModal
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      onConfirm={confirmState.onConfirm}
      onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
    />

    {/* Status Change Confirm Modal */}
    <ConfirmModal
      isOpen={statusConfirmState.isOpen}
      title="¿Cambiar estado?"
      message={`Se cambiará el estado a ${statusConfirmState.newStatus}. ¿Desea continuar?`}
      onConfirm={confirmStatusChange}
      onClose={() => setStatusConfirmState({ isOpen: false, transaction: null, newStatus: '' })}
    />

    {/* Cobranza manual (notificación + recordatorios) */}
    {isCollectionModalOpen && collectionTransaction && (
      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => { setIsCollectionModalOpen(false); setCollectionTransaction(null); }}
        onSend={handleSendCollection}
        transactionData={{
          // Identificadores (Mapeo seguro Inglés || Español)
          id_transaction: collectionTransaction.id_transaction || (collectionTransaction as any).id_transaccion,
          
          invoice_number: collectionTransaction.invoice_number || (collectionTransaction as any).numero_factura,
          
          // --- AQUÍ ESTABA EL ERROR ---
          // El SQL devuelve 'id_empresa_cliente', el modal quiere 'id_client_company'
          id_client_company: collectionTransaction.id_client_company || (collectionTransaction as any).id_empresa_cliente,
          
          // Datos de Automatización
          automation_enabled: (collectionTransaction as any)?.enable_automation,
          automation_frequency: (collectionTransaction as any)?.automation_frequency,
          
          // Importante: Pasar los destinatarios guardados para que aparezcan marcados
          automation_recipients: (collectionTransaction as any)?.automation_recipients
        }}
      />
    )}

    {/* Payment Details Modal */}
    {paymentModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Detalles del Pago</h2>
              <button
                onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de pago</label>
                <input
                  type="date"
                  value={paymentModalState.paymentDate}
                  onChange={(e) => setPaymentModalState(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de pago</label>
                <select
                  value={paymentModalState.paymentMethod}
                  onChange={(e) => setPaymentModalState(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                >
                  <option value="">Seleccione...</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Referencia de pago</label>
                <input
                  type="text"
                  value={paymentModalState.paymentReference}
                  onChange={(e) => setPaymentModalState(prev => ({ ...prev, paymentReference: e.target.value }))}
                  placeholder="Ej: Número de comprobante, transacción..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePaymentDetails}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold transition-colors"
              >
                Guardar y cambiar estado
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Edit Transaction Modal */}
    {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Editar Transacción</h2>
              <button
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Factura</label>
                  <input
                    type="text"
                    value={editFormData.invoice_number || ''}
                    onChange={(e) => handleEditChange('invoice_number', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                  <input
                    type="text"
                    value={editFormData.description || ''}
                    onChange={(e) => handleEditChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtotal</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.subtotal || ''}
                    onChange={(e) => handleEditChange('subtotal', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IVA %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.tax_amount || ''}
                    onChange={(e) => handleEditChange('tax_amount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    value={editFormData.issue_date_input || editFormData.invoice_date?.split('T')[0] || ''}
                    onChange={(e) => handleEditChange('issue_date_input', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={editFormData.due_date_input || editFormData.due_date?.split('T')[0] || ''}
                    onChange={(e) => handleEditChange('due_date_input', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Pagado</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.paid_amount || ''}
                    onChange={(e) => handleEditChange('paid_amount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo Pendiente</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.balance_due || ''}
                    onChange={(e) => handleEditChange('balance_due', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={handleCloseEditModal}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editHasChanges}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  editHasChanges
                    ? 'bg-brand-500 hover:bg-brand-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Toast */}
    {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default FinancialsList;

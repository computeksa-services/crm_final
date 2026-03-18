import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import CollectionModal from '../../components/CollectionModal';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { apiFetch } from '../../services/apiClient';
import { financialService } from '../../services/financials.service';
import { BrandSpinner } from '../../components/AppLoaders';
import type { FinancialTransaction } from '../../types';

// --- HELPERS ---

const formatCurrency = (val: string | number | undefined) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    include_open: true,
  };
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

const getInitials = (fullName?: string) => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getPaymentStatusColor = (code?: string) => {
    if (code === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (code === 'OVERDUE') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (code === 'WARNING') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
};

const toNumberSafe = (val: unknown) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

const normalizeAutomationRecipients = (raw: unknown) => {
  if (!Array.isArray(raw)) return [] as Array<{ name: string; email: string; type: 'contact' | 'team' | 'external' }>;
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const value = item.trim();
        if (!value) return null;
        return { name: value, email: value, type: 'external' as const };
      }
      if (!item || typeof item !== 'object') return null;
      const rec = item as any;
      const email = String(rec.email || rec.address || '').trim();
      const name = String(rec.name || email || 'Destinatario').trim();
      const type = rec.type === 'team' ? 'team' : rec.type === 'contact' ? 'contact' : 'external';
      if (!email && !name) return null;
      return { name: name || email, email: email || name, type };
    })
    .filter(Boolean) as Array<{ name: string; email: string; type: 'contact' | 'team' | 'external' }>;
};

const normalizeNotificationType = (rawType: unknown) => {
  const normalized = String(rawType || '').trim().toUpperCase();
  if (normalized === 'AUTO' || normalized === 'AUTOMATICO' || normalized === 'AUTOMATIC') return 'AUTOMATICO';
  return 'MANUAL';
};

const normalizeNotificationLogs = (rawLogs: unknown) => {
  if (!Array.isArray(rawLogs)) return [] as Array<{ fecha: string; hora: string; tipo: string; enviado_por: string; accionado_por: string; destinatarios: string }>;
  return rawLogs.map((item: any) => {
    const recipientsRaw = item?.destinatarios;
    const recipients = Array.isArray(recipientsRaw)
      ? recipientsRaw.join(', ')
      : String(recipientsRaw || '').trim();
    return {
      fecha: String(item?.fecha_human || item?.fecha || item?.fecha_raw || '-'),
      hora: String(item?.hora || ''),
      tipo: normalizeNotificationType(item?.tipo),
      enviado_por: String(item?.enviado_por || 'Sistema'),
      accionado_por: String(item?.accionado_por || '-'),
      destinatarios: recipients || '-',
    };
  });
};

// --- COMPONENTE: Selector de Estado Estilo Deal ---
const StatusSelector: React.FC<{
  currentStatus: string;
  onSelect: (val: string) => void;
  disabled: boolean;
}> = ({ currentStatus, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  
  const allOptions = [
    { id: 'PENDIENTE', name: 'Pendiente', color: '#f59e0b', icon: 'fa-clock' },
    { id: 'PAGADO', name: 'Pagado', color: '#10b981', icon: 'fa-circle-check' },
    { id: 'ANULADO', name: 'Anulado', color: '#6b7280', icon: 'fa-ban' },
    { id: 'VENCIDO', name: 'Vencido', color: '#ef4444', icon: 'fa-circle-exclamation' },
  ];

  const editableOptions = allOptions.filter(opt => opt.id !== 'VENCIDO');
  const current = allOptions.find(o => o.id === currentStatus) || allOptions[0];
  const currentIndex = editableOptions.findIndex(o => o.id === current.id);
  const optionsAbove = currentIndex > 0 ? editableOptions.slice(0, currentIndex) : [];
  const optionsBelow = currentIndex >= 0 && currentIndex < editableOptions.length - 1 ? editableOptions.slice(currentIndex + 1) : editableOptions;

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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block w-full sm:w-auto" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`w-full sm:w-auto flex items-center justify-between gap-3 px-3 py-2 rounded-lg font-bold text-xs border transition-all ${disabled ? 'opacity-70' : 'hover:brightness-95 active:scale-95'}`}
        style={{ backgroundColor: `${current.color}15`, color: current.color, borderColor: `${current.color}40` }}
      >
        <div className="flex items-center gap-2">
            <i className={`fa-solid ${current.icon}`}></i>
            <span className="uppercase tracking-wider">{current.name}</span>
        </div>
        {!disabled && <i className="fa-solid fa-chevron-down text-[10px] opacity-70"></i>}
      </button>

      {isOpen && !disabled && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute z-50 ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 w-full sm:w-52 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2`}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {optionsAbove.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onSelect(opt.id); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <i className={`fa-solid ${opt.icon} text-[10px]`} style={{ color: opt.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{opt.name}</span>
              </button>
            ))}

            <div className="bg-slate-50 border-y border-slate-100 px-4 py-2.5">
              <div className="w-full flex items-center gap-2 opacity-60 cursor-not-allowed">
                <i className={`fa-solid ${current.icon} text-[10px]`} style={{ color: current.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{current.name}</span>
                {current.id === 'VENCIDO' ? (
                  <span className="text-[9px] ml-auto text-slate-500 italic">(automático)</span>
                ) : (
                  <i className="fa-solid fa-check text-[8px] ml-auto text-slate-400"></i>
                )}
              </div>
            </div>

            {optionsBelow.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onSelect(opt.id); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <i className={`fa-solid ${opt.icon} text-[10px]`} style={{ color: opt.color }}></i>
                <span className="text-xs font-bold text-slate-700 uppercase">{opt.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

const FinancialDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { invalidateFinancials } = useDataCache();

  const [transaction, setTransaction] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Verificar si hay integración de correo activa
  const hasEmailIntegration = () => {
    return !!(user?.provider && user?.send_emails && user?.email_connected);
  };

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant) return;
    setLoading(true);
    try {
      const txResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${id}`);
      if (!txResponse.ok) throw new Error('Error de red');
      const data = await txResponse.json();
      const tx = Array.isArray(data) ? data[0] : data;

      if (!tx) { navigate('/app/financials'); return; }

      const subtotal = toNumberSafe(tx.subtotal);
      const taxAmount = toNumberSafe(tx.impuestos ?? tx.tax_amount);
      const totalValue = toNumberSafe(tx.total_factura ?? tx.total_value);
      const paidAmount = toNumberSafe(tx.monto_pagado_caja ?? tx.v_total_abonado ?? tx.paid_amount);

      const normalizedTx = {
        ...tx,
        id_transaction: tx.id_transaccion,
        transaction_type: normalizeTransactionType(tx.tipo_transaccion || tx.transaction_type),
        invoice_number: tx.numero_factura,
        description: tx.descripcion_concepto,
        status: tx.estado_registro,
        issue_date_input: tx.v_input_fecha_emision,
        due_date_input: tx.v_input_fecha_vencimiento,
        payment_date_input: tx.v_input_fecha_pago,
        retention_date_input: tx.v_input_fecha_retencion,
        issue_date_human: tx.v_texto_fecha_emision_human,
        due_date_human: tx.v_texto_fecha_vencimiento_human,
        payment_date_human: tx.v_texto_fecha_pago_human,
        payment_status_code: tx.v_codigo_estado,
        payment_status_label: tx.v_etiqueta_estado,
        client_company_name: tx.nombre_cliente_proveedor,
        client_ruc: tx.ruc_cliente_proveedor,
        client_address: tx.direccion_cliente,
        client_phone: tx.telefono_cliente,
        client_email: tx.email_cliente,
        id_client_company: tx.id_empresa_cliente,
        subtotal,
        tax_amount: taxAmount,
        tax_rate: toNumberSafe(tx.impuestos_porcentaje ?? tx.tax_rate ?? tx.v_tax_rate),
        retention_value: toNumberSafe(tx.valor_retencion),
        total_value: totalValue,
        paid_amount: paidAmount,
        balance_due: deriveBalanceDue(tx.v_saldo_pendiente || tx.balance_due, totalValue, paidAmount),
        enable_automation: tx.enable_automation === true,
        automation_frequency: toNumberSafe(tx.automation_frequency),
        automation_recipients: normalizeAutomationRecipients(tx.automation_recipients),
        next_reminder_label: tx.v_texto_proximo_recordatorio_human || tx.v_proximo_recordatorio || tx.v_input_proximo_recordatorio,
        notification_logs: normalizeNotificationLogs(tx.notification_logs),
        usuario_creador: tx.usuario_creador
      };

      setTransaction(normalizedTx);
      navigate(location.pathname, { state: { breadcrumb: normalizedTx.invoice_number }, replace: true });

      if (normalizedTx.id_client_company) {
        const cRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies_contacts/detail?id_client_company=${normalizedTx.id_client_company}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
        if (cRes.ok) setCompanyContacts(await cRes.json());
      }
    } catch (error) {
      setToast({ message: 'Error de carga', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- HANDLERS ---
  const handleStatusChange = async (newStatus: string) => {
    if (!transaction) return;
    if (newStatus === 'VENCIDO') {
      setToast({ message: 'El estado VENCIDO lo determina automáticamente el sistema.', type: 'error' });
      return;
    }
    setProcessing(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, status: newStatus, id_tenant: user?.id_tenant, id_user: user?.id_user })
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Estado actualizado', type: 'success' });
      await invalidateFinancials(getCurrentMonthRange());
      fetchData(); 
    } catch {
      setToast({ message: 'Error al actualizar', type: 'error' });
    } finally { setProcessing(false); }
  };

  const handleAddPayment = async () => {
    if (!transaction || paymentAmount <= 0) return;
    setProcessing(true);
    try {
      const currentBalance = parseFloat(transaction.balance_due as any) || 0;
      const appliedAmount = Math.min(paymentAmount, currentBalance);
      if (appliedAmount <= 0) {
        setToast({ message: 'El monto del abono no es válido.', type: 'error' });
        return;
      }

      const newPaid = (parseFloat(transaction.paid_amount as any) || 0) + appliedAmount;
      const newBalance = Math.max(currentBalance - appliedAmount, 0);
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, paid_amount: newPaid, balance_due: newBalance, status: newBalance === 0 ? 'PAGADO' : transaction.status, id_tenant: user?.id_tenant })
      });
      if (!res.ok) throw new Error();
      setIsPaymentModalOpen(false); setPaymentAmount(0);
      setToast({ message: 'Abono registrado', type: 'success' });
      await invalidateFinancials(getCurrentMonthRange());
      fetchData();
    } catch { setToast({ message: 'Error en abono', type: 'error' }); } finally { setProcessing(false); }
  };

  const handleDelete = async () => {
    if (!transaction?.id_transaction || !user) return;
    try {
      setProcessing(true);
      await financialService.delete(transaction.id_transaction, user.id_tenant, user.id_user);
      await invalidateFinancials(getCurrentMonthRange());
      setConfirmState(p => ({ ...p, isOpen: false }));
      setToast({ message: 'Eliminado', type: 'success' });
      navigate('/app/financials');
    } catch { 
      setToast({ message: 'Error al eliminar', type: 'error' }); 
    } finally {
      setProcessing(false);
      setConfirmState(p => ({ ...p, isOpen: false }));
    }
  };

  const handleSendCollection = async (modalData: any) => {
    if (!transaction?.id_transaction || !user) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/notify-overdue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_transaction: transaction.id_transaction,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
            recipients: modalData.recipients,
            update_automation: modalData.update_automation,
        })
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Notificación enviada', type: 'success' });
      setIsCollectionModalOpen(false);
      await invalidateFinancials(getCurrentMonthRange());
      fetchData();
    } catch { setToast({ message: 'Error en envío', type: 'error' }); } finally { setProcessing(false); }
  };

  if (loading) return (
    <div className="flex h-[calc(100vh-200px)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <BrandSpinner size="xl" />
        <p className="text-slate-400 font-medium animate-pulse">Cargando detalles financieros...</p>
      </div>
    </div>
  );

  if (!transaction) return null;

  return (
    <div className="min-h-screen bg-[#F9F9F8] text-zinc-800 pb-20 font-sans selection:bg-orange-100 selection:text-orange-900 animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />

      {/* --- HEADER PRINCIPAL --- */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                  <i className={`fa-solid ${transaction.transaction_type === 'VENTA' ? 'fa-arrow-trend-up text-emerald-500' : transaction.transaction_type === 'GASTO' ? 'fa-arrow-trend-down text-rose-500' : 'fa-circle text-slate-400'} text-[9px]`}></i>
                  {transaction.transaction_type || 'OTRO'}
                </span>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${getPaymentStatusColor(transaction.payment_status_code)}`}>
                  {transaction.payment_status_label || 'SIN ESTADO'}
                </span>
                {transaction.is_urgent && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-600">
                    <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                    Urgente
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 truncate">
                  Factura #{transaction.invoice_number}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Link to={`/app/client-companies/${transaction.id_client_company}`} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
                    <i className="fa-solid fa-building text-zinc-400"></i>
                    <span className="font-semibold uppercase">{transaction.client_company_name}</span>
                  </Link>
                  {transaction.description && (
                    <span className="max-w-2xl truncate text-[13px] italic text-zinc-500">{transaction.description}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end w-full lg:w-auto shrink-0">
              <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white px-5 py-4 shadow-sm min-w-[240px]">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-rose-400 mb-1">Saldo por cobrar</div>
                <div className="text-3xl font-semibold tracking-tight text-rose-600 tabular-nums">
                  {formatCurrency(transaction.balance_due)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
                <StatusSelector 
                  currentStatus={transaction.status || ''} 
                  onSelect={handleStatusChange} 
                  disabled={processing}
                />
                <button onClick={() => navigate(`/app/financials/edit?id=${transaction.id_transaction}`)} className="h-9 px-4 bg-zinc-900 text-white rounded-md font-medium text-[13px] hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
                  <i className="fa-solid fa-pen text-[11px]"></i>
                  Editar
                </button>
                <button onClick={() => setConfirmState({ isOpen: true, title: '¿Seguro desea eliminar este registro?', message: 'Esta acción es irreversible.', onConfirm: handleDelete })} className="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-sm">
                  <i className="fa-solid fa-trash text-[12px]"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- GRID DE CONTENIDO (4/8) --- */}
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIDEBAR */}
        <aside className="lg:col-span-4 space-y-6">
            
            {/* Registro de Pago Rápido */}
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 p-5 text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-600/30"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-xl shadow-inner shadow-white/10">
                  <i className="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">Acción rápida</p>
                  <p className="text-lg font-bold leading-tight">Registrar Abono</p>
                  <p className="text-xs text-emerald-100/90">Aplica un pago parcial o total al documento.</p>
                </div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-emerald-100">
                <i className="fa-solid fa-chevron-right"></i>
              </span>
            </button>

            {/* Datos del Cliente */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
                    <span className="h-6 w-2 rounded-full bg-blue-500"></span>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">Empresa Cliente</h3>
                      <p className="text-[11px] text-zinc-500">Ficha de referencia</p>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    <Link to={`/app/client-companies/${transaction.id_client_company}`} className="block rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 transition-colors hover:bg-zinc-100">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Empresa</p>
                      <div className="mt-1 flex items-center gap-2 text-[13px] font-bold text-zinc-800">
                        <i className="fa-solid fa-building text-zinc-400"></i>
                        <span className="truncate uppercase">{transaction.client_company_name || 'Sin empresa'}</span>
                      </div>
                    </Link>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">RUC / Identificación</p>
                        <p className="mt-1 text-sm font-bold text-zinc-700 font-mono">{transaction.client_ruc || 'N/A'}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Email</p>
                        <p className="mt-1 truncate text-[13px] font-semibold text-zinc-700">{transaction.client_email || 'No registrado'}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Dirección</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{transaction.client_address || 'No registrada'}</p>
                      </div>
                    </div>
                </div>
            </div>

            {/* Automatización (OCULTAR SI ESTÁ PAGADO) */}
            {transaction.status !== 'PAGADO' && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="h-6 w-2 rounded-full bg-indigo-500"></span>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-900">Cobranza Automática</h3>
                            <p className="text-[11px] text-zinc-500">Seguimiento programado</p>
                        </div>
                    </div>
                    {/* Botón de Campaña Condicional */}
                    {transaction.status === 'VENCIDO' && (
                        <button 
                            onClick={() => {
                              if (!hasEmailIntegration()) {
                                alert('No tienes una integración de correo configurada. Ve a Configuración → Integraciones para conectar Gmail o Outlook.');
                                return;
                              }
                              setIsCollectionModalOpen(true);
                            }} 
                            disabled={!hasEmailIntegration()}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${!hasEmailIntegration() ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' : transaction.enable_automation ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'}`}
                            title={!hasEmailIntegration() ? 'Integración de correo no configurada. Ve a Configuración → Integraciones' : transaction.enable_automation ? 'Automatización encendida. Haz clic para enviar una notificación manual extra.' : 'Enviar notificación manual'}
                        >
                        <i className="fa-solid fa-bell text-sm"></i>
                        </button>
                    )}
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Estado</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${transaction.enable_automation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                {transaction.enable_automation ? 'Activado' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                        {transaction.enable_automation && (
                        <>
                            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Frecuencia</span>
                            <span className="text-[13px] font-bold text-zinc-700">Cada {transaction.automation_frequency} días</span>
                            </div>
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">Próximo envío estimado</p>
                            <p className="text-[13px] font-bold text-indigo-700">{transaction.next_reminder_label || 'Calculando...'}</p>
                            </div>
                            
                            {/* DESTINATARIOS CONFIGURADOS */}
                            <div className="space-y-2 mt-4">
                                <p className="border-b border-zinc-100 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Enviando alertas a</p>
                                {transaction.automation_recipients?.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {transaction.automation_recipients.map((r: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm border border-zinc-100 shrink-0">
                                                    <i className={`fa-solid ${r.type === 'team' ? 'fa-user-group text-blue-500' : 'fa-user text-indigo-500'} text-[10px]`}></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-bold text-zinc-700 truncate">{r.name}</p>
                                                    <p className="text-[10px] text-zinc-400 truncate leading-none">{r.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] italic text-zinc-400">No hay destinatarios guardados.</p>
                                )}
                            </div>
                        </>
                        )}
                    </div>
                </div>
            )}
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <section className="lg:col-span-8 space-y-6">
            
            {/* Resumen Financiero */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="h-6 w-2 rounded-full bg-brand-500"></span>
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900">Resumen del Documento</h3>
                          <p className="text-[11px] text-zinc-500">Detalle financiero principal</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${getPaymentStatusColor(transaction.payment_status_code)} shadow-sm`}>
                        {transaction.payment_status_label}
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Subtotal</p>
                          <p className="mt-2 text-2xl font-mono font-bold text-zinc-700 tabular-nums">{formatCurrency(transaction.subtotal)}</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">IVA{transaction.tax_rate > 0 ? ` (${transaction.tax_rate}%)` : ''}</p>
                          <p className="mt-2 text-2xl font-mono font-bold text-zinc-700 tabular-nums">{formatCurrency(transaction.tax_amount)}</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Total Factura</p>
                          <p className="mt-2 text-2xl font-mono font-black text-white tabular-nums">{formatCurrency(transaction.total_value)}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Monto Abonado</p>
                          <p className="mt-2 text-2xl font-mono font-black text-emerald-700 tabular-nums">{formatCurrency(transaction.paid_amount)}</p>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-rose-100 bg-gradient-to-r from-rose-50 via-white to-white px-5 py-5 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-400">Saldo pendiente actual</p>
                          <p className="mt-2 text-3xl font-mono font-black text-rose-600 tabular-nums">{formatCurrency(transaction.balance_due)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-3 lg:min-w-[420px]">
                          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Emisión</p>
                            <p className="mt-1 text-[13px] font-bold text-zinc-700">{transaction.issue_date_human || transaction.issue_date_input}</p>
                          </div>
                          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Vencimiento</p>
                            <p className="mt-1 text-[13px] font-bold text-zinc-700">{transaction.due_date_human || transaction.due_date_input}</p>
                          </div>
                          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Registrado por</p>
                            <p className="mt-1 text-[13px] font-bold text-zinc-700 truncate">{transaction.usuario_creador || 'Sistema'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500 shrink-0">
                                    {getInitials(transaction.usuario_creador)}
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Autor del registro</p>
                                  <p className="text-[13px] font-bold text-zinc-700">{transaction.usuario_creador || 'Sistema'}</p>
                                </div>
                            </div>
                        </div>
                        {transaction.retention_value > 0 ? (
                          <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 shadow-sm">
                            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400 mb-0.5">Retención</p><p className="text-[13px] font-bold text-indigo-700">{transaction.retention_date_input || 'S/F'}</p></div>
                            <p className="text-xl font-mono font-black text-indigo-600 tabular-nums">{formatCurrency(transaction.retention_value)}</p>
                          </div>
                        ) : <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-[11px] italic text-zinc-400 flex items-center justify-center">Sin retención asociada</div>}
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Control de Fechas</p>
                            <div className="space-y-1.5">
                                <p className="text-[12px] font-medium text-zinc-500">EMISIÓN: <span className="text-zinc-700 font-bold">{transaction.issue_date_human || transaction.issue_date_input}</span></p>
                                <p className="text-[12px] font-medium text-zinc-500">VENCE: <span className="text-zinc-700 font-bold">{transaction.due_date_human || transaction.due_date_input}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Historial de Notificaciones (5 Columnas - Eliminado Estado Envío) */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="h-6 w-2 rounded-full bg-slate-500"></span>
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900">Historial de Notificaciones</h3>
                          <p className="text-[11px] text-zinc-500">Seguimiento de envíos manuales y automáticos</p>
                        </div>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      {transaction.notification_logs?.length || 0} registros
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] border-b border-zinc-200">
                          <th className="px-6 py-3">Fecha</th>
                          <th className="px-6 py-3">Tipo</th>
                          <th className="px-6 py-3">Enviado por</th>
                          <th className="px-6 py-3">Accionado por</th>
                          <th className="px-6 py-3">Destinatarios</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {transaction.notification_logs?.length ? transaction.notification_logs.map((log: any, idx: number) => (
                          <tr key={idx} className="transition-colors hover:bg-zinc-50/80">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>{log.fecha}</div>
                              {log.hora && <div className="text-[10px] font-medium text-zinc-500">{log.hora}</div>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${log.tipo === 'AUTOMATICO' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {log.tipo}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-semibold text-zinc-700">{log.enviado_por}</td>
                            <td className="px-6 py-4 text-[11px] text-zinc-500">{log.accionado_por || '-'}</td>
                            <td className="px-6 py-4 max-w-xs text-[11px] italic text-zinc-500 truncate" title={log.destinatarios}>{log.destinatarios}</td>
                          </tr>
                        )) : <tr><td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic text-xs">Sin registros de cobranza.</td></tr>}
                      </tbody>
                    </table>
                </div>
            </div>
        </section>
      </div>
      </div>

      {/* --- MODALES --- */}
      
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 space-y-6">
               <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Registrar Abono</h3>
                    <p className="text-sm text-slate-500 font-medium italic">#{transaction.invoice_number}</p>
                  </div>
                  <button onClick={() => setIsPaymentModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all"><i className="fa-solid fa-times"></i></button>
               </div>
               <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-600 uppercase">Saldo Pendiente:</span>
                <span className="text-xl font-mono font-black text-rose-700 tabular-nums">{formatCurrency(transaction.balance_due)}</span>
               </div>
               <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-2xl">$</span>
                  <input autoFocus type="number" max={transaction.balance_due || undefined} value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl py-5 pl-10 pr-4 outline-none text-3xl font-mono font-black text-slate-800 transition-all" placeholder="0.00" />
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={handleAddPayment} disabled={processing || paymentAmount <= 0} className="flex-[2] py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all uppercase tracking-wide">Confirmar Pago</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {isCollectionModalOpen && (
        <CollectionModal 
          isOpen={true} 
          onClose={() => setIsCollectionModalOpen(false)} 
          onSend={handleSendCollection} 
          transactionData={{ 
            id_transaction: transaction.id_transaction, 
            invoice_number: transaction.invoice_number, 
            id_client_company: transaction.id_client_company, 
            automation_enabled: transaction.enable_automation, 
            automation_frequency: transaction.automation_frequency,
            automation_recipients: transaction.automation_recipients // Pasamos los destinatarios actuales al modal
          }} 
        />
      )}
    </div>
  );
};

export default FinancialDetail;

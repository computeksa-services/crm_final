import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import CollectionModal from '../components/CollectionModal';
import FinancialFormModal from '../components/FinancialFormModal';
import { useAuth } from '../contexts/AuthContext';
import type { FinancialTransaction, ClientCompany, Quote } from '../types';

// --- HELPERS ---

const formatCurrency = (val: string | number | undefined) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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

// --- COMPONENTE: Selector de Estado Estilo Deal ---
const StatusSelector: React.FC<{
  currentStatus: string;
  onSelect: (val: string) => void;
  disabled: boolean;
}> = ({ currentStatus, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const options = [
    { id: 'PENDIENTE', name: 'Pendiente', color: '#f59e0b', icon: 'fa-clock' },
    { id: 'PAGADO', name: 'Pagado', color: '#10b981', icon: 'fa-circle-check' },
    { id: 'ANULADO', name: 'Anulado', color: '#6b7280', icon: 'fa-ban' },
    { id: 'VENCIDO', name: 'Vencido', color: '#ef4444', icon: 'fa-circle-exclamation' },
  ];

  const current = options.find(o => o.id === currentStatus) || options[0];

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
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
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
        <div className="absolute right-0 mt-1 w-full sm:w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onSelect(opt.id); setIsOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors border-b border-slate-50 last:border-0"
            >
              <i className={`fa-solid ${opt.icon} text-[10px]`} style={{ color: opt.color }}></i>
              <span className="text-xs font-bold text-slate-700 uppercase">{opt.name}</span>
            </button>
          ))}
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

  const [transaction, setTransaction] = useState<any | null>(null);
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant) return;
    setLoading(true);
    try {
      const [txResponse, companiesRes, quotesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${id}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
      ]);

      if (companiesRes.ok) setClientCompanies(await companiesRes.json());
      if (quotesRes.ok) setQuotes(await quotesRes.json());

      if (!txResponse.ok) throw new Error('Error de red');
      const data = await txResponse.json();
      const tx = Array.isArray(data) ? data[0] : data;

      if (!tx) { navigate('/app/financials'); return; }

      const normalizedTx = {
        ...tx,
        id_transaction: tx.id_transaccion,
        transaction_type: tx.tipo_transaccion,
        invoice_number: tx.numero_factura,
        description: tx.descripcion_concepto,
        status: tx.estado_registro,
        issue_date_input: tx.v_input_fecha_emision,
        due_date_input: tx.v_input_fecha_vencimiento,
        payment_status_code: tx.v_codigo_estado,
        payment_status_label: tx.v_etiqueta_estado,
        client_company_name: tx.nombre_cliente_proveedor,
        client_ruc: tx.ruc_cliente_proveedor,
        client_address: tx.direccion_cliente,
        id_client_company: tx.id_empresa_cliente,
        subtotal: parseFloat(tx.subtotal || 0),
        tax_amount: parseFloat(tx.impuestos || 0),
        retention_value: parseFloat(tx.valor_retencion || 0),
        total_value: parseFloat(tx.total_factura || 0),
        paid_amount: parseFloat(tx.monto_pagado_caja || tx.v_total_abonado || 0),
        balance_due: Math.max(parseFloat(tx.v_saldo_pendiente || 0) - parseFloat(tx.valor_retencion || 0), 0),
        enable_automation: tx.enable_automation === true,
        automation_frequency: tx.automation_frequency,
        automation_recipients: Array.isArray(tx.automation_recipients) ? tx.automation_recipients : [],
        next_reminder_label: tx.v_proximo_recordatorio,
        notification_logs: Array.isArray(tx.notification_logs) ? tx.notification_logs : [],
        usuario_creador: tx.usuario_creador
      };

      setTransaction(normalizedTx);
      navigate(location.pathname, { state: { breadcrumb: normalizedTx.invoice_number }, replace: true });

      if (normalizedTx.id_client_company) {
        const cRes = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies_contacts/detail?id_client_company=${normalizedTx.id_client_company}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
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
    setProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, status: newStatus, id_tenant: user?.id_tenant, id_user: user?.id_user })
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Estado actualizado', type: 'success' });
      fetchData(); 
    } catch {
      setToast({ message: 'Error al actualizar', type: 'error' });
    } finally { setProcessing(false); }
  };

  const handleAddPayment = async () => {
    if (!transaction || paymentAmount <= 0) return;
    setProcessing(true);
    try {
      const newPaid = (parseFloat(transaction.paid_amount as any) || 0) + paymentAmount;
      const newBalance = Math.max((parseFloat(transaction.balance_due as any) || 0) - paymentAmount, 0);
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, paid_amount: newPaid, balance_due: newBalance, id_tenant: user?.id_tenant })
      });
      if (!res.ok) throw new Error();
      setIsPaymentModalOpen(false); setPaymentAmount(0);
      setToast({ message: 'Abono registrado', type: 'success' });
      fetchData();
    } catch { setToast({ message: 'Error en abono', type: 'error' }); } finally { setProcessing(false); }
  };

  const handleDelete = async () => {
    try {
      setProcessing(true);
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaction: transaction?.id_transaction })
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Eliminado', type: 'success' });
      navigate('/app/financials');
    } catch { setToast({ message: 'Error al eliminar', type: 'error' }); }
  };

  const handleSendCollection = async (modalData: any) => {
    if (!transaction?.id_transaction || !user) return;
    setProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/notify-overdue`, {
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
      fetchData();
    } catch { setToast({ message: 'Error en envío', type: 'error' }); } finally { setProcessing(false); }
  };

  if (loading) return (
    <div className="flex h-[calc(100vh-200px)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-400 font-medium animate-pulse">Cargando detalles financieros...</p>
      </div>
    </div>
  );

  if (!transaction) return null;

  return (
    <div className="w-full px-4 md:px-6 pb-20 animate-fade-in font-sans">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />

      {/* --- HEADER PRINCIPAL --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex-1 min-w-0 space-y-1 w-full">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        Factura #{transaction.invoice_number}
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs pl-0">
                    <Link to={`/app/client-companies/${transaction.id_client_company}`} className="flex items-center gap-2 group px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                        <i className="fa-solid fa-building text-slate-400"></i>
                        <span className="font-semibold text-slate-600 group-hover:text-brand-600 transition-colors uppercase">{transaction.client_company_name}</span>
                    </Link>
                    {transaction.description && (
                        <>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 italic truncate max-w-md">{transaction.description}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2 w-full lg:w-auto">
                <div className="text-left lg:text-right w-full lg:w-auto">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Saldo por Cobrar</div>
                    <div className="text-2xl font-mono font-bold text-rose-600 tracking-tight">
                        {formatCurrency(transaction.balance_due)}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    <StatusSelector 
                        currentStatus={transaction.status || ''} 
                        onSelect={handleStatusChange} 
                        disabled={processing}
                    />
                    <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none px-3 py-2 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-brand-600 hover:bg-brand-50 transition-all shadow-sm">
                        <i className="fa-solid fa-pen"></i> Editar
                    </button>
                    <button onClick={() => setConfirmState({ isOpen: true, title: '¿Eliminar?', message: 'Esta acción es irreversible.', onConfirm: handleDelete })} className="flex-1 sm:flex-none px-3 py-2 flex items-center justify-center gap-2 rounded-lg border border-rose-100 text-rose-600 font-bold text-xs hover:bg-rose-50 transition-all shadow-sm">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
      </div>
      {/* --- GRID DE CONTENIDO (2/3 y 1/3) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SIDEBAR (1/3) */}
        <div className="space-y-6">
            
            {/* Registro de Pago Rápido */}
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                  <i className="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest text-left">Acción</p>
                  <p className="font-bold text-lg leading-tight">Registrar Abono</p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-emerald-300"></i>
            </button>

            {/* Datos del Cliente */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    <h3 className="font-bold text-slate-800 text-sm">Empresa Cliente</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">RUC / Identificación</p>
                        <p className="text-sm font-bold text-slate-700 font-mono">{transaction.client_ruc || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Dirección</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{transaction.client_address || 'No registrada'}</p>
                    </div>
                </div>
            </div>

            {/* Automatización (OCULTAR SI ESTÁ PAGADO) */}
            {transaction.status !== 'PAGADO' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Cobranza Automática</h3>
                            <p className="text-xs text-slate-500">Seguimiento</p>
                        </div>
                    </div>
                    {/* Botón de Campaña Condicional */}
                    {transaction.status === 'VENCIDO' && (
                        <button 
                            onClick={() => setIsCollectionModalOpen(true)} 
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${transaction.enable_automation ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'}`}
                            title={transaction.enable_automation ? 'Automatización encendida. Haz clic para enviar una notificación manual extra.' : 'Enviar notificación manual'}
                        >
                        <i className="fa-solid fa-bell text-sm"></i>
                        </button>
                    )}
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Estado</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${transaction.enable_automation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                {transaction.enable_automation ? 'Activado' : 'Inactivo'}
                            </span>
                        </div>
                        {transaction.enable_automation && (
                        <>
                            <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Frecuencia</span>
                            <span className="text-sm font-bold text-slate-700">Cada {transaction.automation_frequency} días</span>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1">Próximo Envío Estimado</p>
                            <p className="text-xs font-bold text-indigo-700">{transaction.next_reminder_label || 'Calculando...'}</p>
                            </div>
                            
                            {/* DESTINATARIOS CONFIGURADOS */}
                            <div className="space-y-2 mt-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Enviando Alertas A:</p>
                                {transaction.automation_recipients?.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {transaction.automation_recipients.map((r: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                                                    <i className={`fa-solid ${r.type === 'team' ? 'fa-user-group text-blue-500' : 'fa-user text-indigo-500'} text-[10px]`}></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{r.name}</p>
                                                    <p className="text-[9px] text-slate-400 truncate leading-none">{r.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">No hay destinatarios guardados.</p>
                                )}
                            </div>
                        </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* CONTENIDO PRINCIPAL (2/3) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Resumen Financiero */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-brand-500 rounded-full"></span>
                        <h3 className="font-bold text-slate-800 text-sm">Resumen del Documento</h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${getPaymentStatusColor(transaction.payment_status_code)} shadow-sm`}>
                        {transaction.payment_status_label}
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal</p>
                          <p className="text-lg font-mono font-bold text-slate-700">{formatCurrency(transaction.subtotal)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA ({transaction.tax_amount}%)</p>
                          <p className="text-lg font-mono font-bold text-slate-700">{formatCurrency((transaction.subtotal||0) * (transaction.tax_amount||0)/100)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Factura</p>
                          <p className="text-lg font-mono font-black text-slate-900">{formatCurrency(transaction.total_value)}</p>
                        </div>
                        <div className="space-y-1 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Monto Abonado</p>
                          <p className="text-lg font-mono font-black text-emerald-700">{formatCurrency(transaction.paid_amount)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-100">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                                    {getInitials(transaction.usuario_creador)}
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase">Registrado por</p>
                                  <p className="text-xs font-bold text-slate-700">{transaction.usuario_creador || 'Sistema'}</p>
                                </div>
                            </div>
                        </div>
                        {transaction.retention_value > 0 ? (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Retención</p><p className="text-xs font-bold text-slate-700">{transaction.v_input_fecha_retencion || 'S/F'}</p></div>
                            <p className="text-lg font-mono font-black text-indigo-600">{formatCurrency(transaction.retention_value)}</p>
                          </div>
                        ) : <div />}
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Control de Fechas</p>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500">EMISIÓN: <span className="text-slate-700 font-bold">{transaction.issue_date_input}</span></p>
                                <p className="text-xs font-medium text-slate-500">VENCE: <span className="text-slate-700 font-bold">{transaction.due_date_input}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Historial de Notificaciones (5 Columnas - Eliminado Estado Envío) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-slate-500 rounded-full"></span>
                        <h3 className="font-bold text-slate-800 text-sm">Historial de Notificaciones</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                          <th className="px-6 py-3">Fecha</th>
                          <th className="px-6 py-3">Tipo</th>
                          <th className="px-6 py-3">Enviado por</th>
                          <th className="px-6 py-3">Accionado por</th>
                          <th className="px-6 py-3">Destinatarios</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transaction.notification_logs?.length ? transaction.notification_logs.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">{log.fecha}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${log.tipo === 'AUTOMATICO' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {log.tipo}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-medium text-slate-600">{log.enviado_por}</td>
                            <td className="px-6 py-4 text-[11px] text-slate-500">{log.accionado_por || '-'}</td>
                            <td className="px-6 py-4 text-[11px] text-slate-500 italic max-w-xs truncate" title={log.destinatarios}>{log.destinatarios}</td>
                          </tr>
                        )) : <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-xs">Sin registros de cobranza.</td></tr>}
                      </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* --- MODALES --- */}
      <FinancialFormModal isOpen={isEditModalOpen} initialData={transaction} clientCompanies={clientCompanies} quotes={quotes} onClose={() => setIsEditModalOpen(false)} onSave={async () => { fetchData(); setIsEditModalOpen(false); }} isProcessing={processing} />
      
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
                  <span className="text-xl font-mono font-black text-rose-700">{formatCurrency(transaction.balance_due)}</span>
               </div>
               <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-2xl">$</span>
                  <input autoFocus type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white rounded-2xl py-5 pl-10 pr-4 outline-none text-3xl font-mono font-black text-slate-800 transition-all" placeholder="0.00" />
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
          preloadedContacts={companyContacts} 
        />
      )}
    </div>
  );
};

export default FinancialDetail;
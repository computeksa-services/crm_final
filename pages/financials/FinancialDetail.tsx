import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import CollectionModal from '../../components/CollectionModal';
import PaymentFormModal from '../../components/PaymentFormModal';
import PaymentHistoryTable from '../../components/PaymentHistoryTable';
import Avatar from '../../components/Avatar';
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

const getPaymentStatusColor = (code?: string, statusRaw?: unknown) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const normalizedStatus = String(statusRaw || '').trim().toUpperCase();

    if (normalizedCode === 'PAID' || normalizedStatus === 'PAGADO') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (normalizedCode === 'OVERDUE' || normalizedStatus === 'VENCIDO') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (normalizedCode === 'WARNING' || normalizedCode === 'PENDING' || normalizedStatus === 'PENDIENTE') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (normalizedStatus === 'ANULADO') {
      return 'bg-slate-50 text-slate-700 border-slate-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getBaseStatusLabel = (statusRaw?: unknown) => {
  const status = String(statusRaw || '').trim().toUpperCase();
  if (status === 'PAGADO') return 'PAGADO';
  if (status === 'VENCIDO') return 'VENCIDO';
  if (status === 'ANULADO') return 'ANULADO';
  if (status === 'PENDIENTE') return 'PENDIENTE';
  return 'SIN ESTADO';
};

const toNumberSafe = (val: unknown) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

const getDueTimePresentation = (indicatorRaw: unknown, absoluteDaysRaw: unknown, statusLabelRaw?: unknown) => {
  const indicator = String(indicatorRaw || '').trim().toUpperCase();
  const absoluteDays = toNumberSafe(absoluteDaysRaw);
  const statusLabel = String(statusLabelRaw || '').trim();

  if (indicator === 'PAGADO_A_TIEMPO') {
    return {
      text: statusLabel || 'Pagado a tiempo',
      className: 'text-emerald-600',
    };
  }
  if (indicator === 'PAGADO_ATRASADO') {
    return {
      text: statusLabel || `Pagado (Atraso de ${absoluteDays} días)`,
      className: 'text-red-600',
    };
  }

  if (indicator === 'ATRASADO') {
    return {
      text: `Vencido hace ${absoluteDays} días`,
      className: 'text-red-600',
    };
  }
  if (indicator === 'HOY') {
    return {
      text: 'Vence HOY',
      className: 'text-amber-600',
    };
  }
  if (indicator === 'A_TIEMPO') {
    return {
      text: `Vence en ${absoluteDays} días`,
      className: 'text-emerald-600',
    };
  }
  return {
    text: '-',
    className: 'text-gray-500',
  };
};

const getFileNameFromUrl = (fileUrl?: string | null) => {
  if (!fileUrl) return '';
  const cleanUrl = fileUrl.split('?')[0];
  const encodedName = cleanUrl.split('/').pop() || cleanUrl;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
};

const getFileExtension = (fileUrl?: string | null) => {
  const fileName = getFileNameFromUrl(fileUrl);
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
};

const getFileIconClass = (fileUrl?: string | null) => {
  const ext = getFileExtension(fileUrl);
  if (['pdf'].includes(ext)) return 'fa-file-pdf text-red-500';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'fa-file-image text-purple-500';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel text-emerald-500';
  if (['doc', 'docx'].includes(ext)) return 'fa-file-word text-blue-500';
  if (['zip', 'rar', '7z'].includes(ext)) return 'fa-file-zipper text-amber-500';
  return 'fa-file-lines text-slate-400';
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
    { id: 'PENDIENTE', name: 'PENDIENTE', color: '#f59e0b', icon: 'fa-clock' },
    { id: 'PAGADO', name: 'PAGADO', color: '#10b981', icon: 'fa-circle-check' },
    { id: 'ANULADO', name: 'ANULADO', color: '#6b7280', icon: 'fa-ban' },
    { id: 'VENCIDO', name: 'VENCIDO', color: '#ef4444', icon: 'fa-circle-exclamation' },
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
  
  const [currentTab, setCurrentTab] = useState<'resumen' | 'abonos' | 'archivos'>('resumen');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [uploadingInvoiceFile, setUploadingInvoiceFile] = useState(false);
  const [uploadingRetentionFile, setUploadingRetentionFile] = useState(false);
  const [deletingFileKey, setDeletingFileKey] = useState<'invoice' | 'retention' | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const invoiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const retentionFileInputRef = useRef<HTMLInputElement | null>(null);

  // Verificar si hay integración de correo activa
  const hasEmailIntegration = () => {
    return !!(user?.provider && user?.send_emails && user?.email_connected);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!id || !user?.id_tenant) return;
    if (!silent) setLoading(true);
    let uiReady = false;
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
        issue_date_human: tx.v_texto_fecha_emision_human || tx.v_texto_fecha_emision,
        due_date_human: tx.v_texto_fecha_vencimiento_human || tx.v_texto_fecha_vencimiento,
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
        days_until_due: tx.v_dias_restantes ?? tx.days_until_due,
        due_time_indicator: tx.v_indicador_tiempo,
        due_time_absolute_days: tx.v_dias_absolutos,
        enable_automation: tx.enable_automation === true,
        automation_frequency: toNumberSafe(tx.automation_frequency),
        automation_recipients: normalizeAutomationRecipients(tx.automation_recipients),
        next_reminder_label: tx.v_texto_proximo_recordatorio_human || tx.v_proximo_recordatorio || tx.v_input_proximo_recordatorio,
        notification_logs: normalizeNotificationLogs(tx.notification_logs),
        usuario_creador: tx.usuario_creador,
        creator_avatar: tx.avatar_usuario_creador || tx.usuario_creador_avatar || tx.created_by_avatar || tx.owner_avatar || null,
        invoice_file_url: tx.invoice_file_url || tx.url_factura || null,
        retention_file_url: tx.retention_file_url || tx.url_retencion || null,
        payment_history: Array.isArray(tx.historial_abonos)
          ? tx.historial_abonos.map((p: any) => ({
              id: p.id_payment,
              id_abono: p.id_payment,
              amount: toNumberSafe(p.amount),
              payment_date: String(p.payment_date || ''),
              payment_method: String(p.payment_method || ''),
              reference: p.reference_number ? String(p.reference_number) : undefined,
              notes: p.notes ? String(p.notes) : undefined,
              created_by: String(p.registrado_por || tx.usuario_creador || 'Sistema'),
              created_by_name: String(p.registrado_por || tx.usuario_creador || 'Sistema'),
              created_at: p.fecha_registro ? String(p.fecha_registro) : undefined,
            }))
          : [],
      };

      setTransaction(normalizedTx);
      navigate(location.pathname, { state: { breadcrumb: normalizedTx.invoice_number }, replace: true });
      if (!silent) setLoading(false);
      uiReady = true;

      if (normalizedTx.id_client_company) {
        // No bloquear el primer render por carga secundaria de contactos.
        void (async () => {
          try {
            const cRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies_contacts/detail?id_client_company=${normalizedTx.id_client_company}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
            if (cRes.ok) setCompanyContacts(await cRes.json());
          } catch {
            // silencioso: contactos no son criticos para mostrar el detalle
          }
        })();
      }
    } catch (error) {
      setToast({ message: 'Error de carga', type: 'error' });
    } finally {
      if (!uiReady && !silent) setLoading(false);
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

  const handleAddPayment = async (paymentData: {
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    notes?: string;
  }) => {
    if (!transaction || !user?.id_tenant) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/abono`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_transaction: transaction.id_transaction,
          id_tenant: user.id_tenant,
          created_by: user.id_user,
          ...paymentData,
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al registrar el abono');
      }

      const responseData = await res.json().catch(() => null);
      const updatedSummary = Array.isArray(responseData) ? responseData[0] : responseData;
      const updatedSummaryId = updatedSummary?.id_transaction ?? updatedSummary?.id_transaccion;
      if (updatedSummary && updatedSummaryId === transaction.id_transaction) {
        setTransaction((prev: any) => prev ? {
          ...prev,
          status: updatedSummary.status ?? updatedSummary.estado_registro ?? prev.status,
          paid_amount: toNumberSafe(updatedSummary.paid_amount ?? updatedSummary.monto_pagado_caja ?? prev.paid_amount),
        } : prev);
      }

      setToast({ message: 'Abono registrado exitosamente', type: 'success' });
      await invalidateFinancials(getCurrentMonthRange());
      await fetchData(true); // Silent soft refresh transaction data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar el abono';
      setToast({ message, type: 'error' });
    } finally {
      setProcessing(false);
    }
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

  const openFileSecure = useCallback(async (fileUrl?: string | null) => {
    if (!fileUrl) {
      setToast({ message: 'No se encontró el archivo.', type: 'error' });
      return;
    }

    try {
      const response = await apiFetch(
        `${import.meta.env.VITE_WEBHOOK_URL}/api/crm/view?url_archivo=${encodeURIComponent(fileUrl)}`,
        { method: 'GET' }
      );

      if (!response.ok) throw new Error();

      const blob = await response.blob();
      if (!blob || blob.size === 0) throw new Error();

      const blobUrl = URL.createObjectURL(blob);
      const popup = window.open(blobUrl, '_blank', 'noopener,noreferrer');

      if (!popup) {
        setToast({ message: 'Si no se abrió la vista, habilita ventanas emergentes para este sitio.', type: 'success' });
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch {
      setToast({ message: 'No se pudo cargar el archivo.', type: 'error' });
    }
  }, []);

  const handleUploadFile = async (file: File, target: 'invoice' | 'retention') => {
    if (!transaction?.id_transaction || !user?.id_tenant || !user?.id_user) return;
    const setUploading = target === 'invoice' ? setUploadingInvoiceFile : setUploadingRetentionFile;
    const inputRef = target === 'invoice' ? invoiceFileInputRef : retentionFileInputRef;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(target === 'invoice' ? 'invoice_file' : 'retention_file', file);
      formData.append('id_transaction', transaction.id_transaction);
      formData.append('id_tenant', user.id_tenant);
      formData.append('id_user', user.id_user);

      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();

      setToast({
        message: target === 'invoice' ? 'Factura subida correctamente.' : 'Retención subida correctamente.',
        type: 'success',
      });
      await invalidateFinancials(getCurrentMonthRange());
      await fetchData(true);
    } catch {
      setToast({
        message: target === 'invoice' ? 'Error al subir archivo de factura.' : 'Error al subir archivo de retención.',
        type: 'error',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleUploadInvoiceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUploadFile(file, 'invoice');
  };

  const handleUploadRetentionFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUploadFile(file, 'retention');
  };

  const handleDeleteFile = (target: 'invoice' | 'retention') => {
    if (!transaction?.id_transaction || !user?.id_tenant || !user?.id_user) return;
    const fileUrl = target === 'invoice' ? transaction.invoice_file_url : transaction.retention_file_url;
    if (!fileUrl) return;

    setConfirmState({
      isOpen: true,
      title: target === 'invoice' ? 'Eliminar Archivo de Factura' : 'Eliminar Archivo de Retención',
      message: '¿Seguro que deseas eliminar este archivo?',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        setDeletingFileKey(target);
        try {
          const formData = new FormData();
          formData.append('id_transaction', transaction.id_transaction);
          formData.append('id_tenant', user.id_tenant);
          formData.append('id_user', user.id_user);
          if (target === 'invoice') {
            formData.append('delete_invoice_file', 'true');
            formData.append('old_invoice_key', String(fileUrl));
          } else {
            formData.append('delete_retention_file', 'true');
            formData.append('old_retention_key', String(fileUrl));
          }

          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financials/update`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error();

          setToast({
            message: target === 'invoice' ? 'Archivo de factura eliminado.' : 'Archivo de retención eliminado.',
            type: 'success',
          });
          await invalidateFinancials(getCurrentMonthRange());
          await fetchData(true);
        } catch {
          setToast({
            message: target === 'invoice' ? 'Error al eliminar archivo de factura.' : 'Error al eliminar archivo de retención.',
            type: 'error',
          });
        } finally {
          setDeletingFileKey(null);
        }
      },
    });
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
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <BrandSpinner size="xl" />
        <p className="text-slate-400 font-medium animate-pulse">Cargando detalles financieros...</p>
      </div>
    </div>
  );

  if (!transaction) return null;

  const dueTime = getDueTimePresentation(
    transaction.due_time_indicator,
    transaction.due_time_absolute_days,
    transaction.payment_status_label
  );
  const paymentCount = Array.isArray(transaction.payment_history) ? transaction.payment_history.length : 0;

  return (
    <div className="min-h-screen bg-[#F9F9FA]">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />
      
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap truncate">Factura #{transaction.invoice_number}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 border shrink-0 ${getPaymentStatusColor(transaction.payment_status_code, transaction.status)}`}>
                {getBaseStatusLabel(transaction.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 max-w-[560px] truncate">{transaction.description || '-'}</p>
          </div>
          
          <div className="ml-auto w-full md:w-auto flex items-center justify-end gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Saldo Pendiente</p>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-xl font-bold text-gray-900">{formatCurrency(transaction.balance_due)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate(`/app/financials/edit?id=${transaction.id_transaction}`)} className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-medium transition flex items-center gap-2">
                <i className="fa-solid fa-pen text-xs"></i> Editar
              </button>
              <button onClick={() => setConfirmState({ isOpen: true, title: '¿Seguro desea eliminar este registro?', message: 'Esta acción es irreversible.', onConfirm: handleDelete })} className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 text-gray-700 transition"><i className="fa-solid fa-trash text-xs"></i></button>
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="flex items-center w-full max-w-3xl gap-2 mt-2">
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'PENDIENTE' ? 'bg-amber-500' : 'bg-gray-200'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'PENDIENTE' ? 'text-amber-600' : 'text-gray-400'}`}>
              <i className={`fa-solid ${transaction.status === 'PENDIENTE' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> PENDIENTE
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'VENCIDO' ? 'bg-rose-500' : 'bg-gray-200'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'VENCIDO' ? 'text-rose-600' : 'text-gray-400'}`}>
              <i className={`fa-solid ${transaction.status === 'VENCIDO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> VENCIDO
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'PAGADO' ? 'bg-emerald-500' : 'bg-gray-200'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'PAGADO' ? 'text-emerald-600' : 'text-gray-400'}`}>
              <i className={`fa-solid ${transaction.status === 'PAGADO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> PAGADO
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'ANULADO' ? 'bg-slate-500' : 'bg-gray-200'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'ANULADO' ? 'text-slate-600' : 'text-gray-400'}`}>
              <i className={`fa-solid ${transaction.status === 'ANULADO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> ANULADO
            </span>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: DATOS RÁPIDOS */}
          <div className="lg:col-span-4 space-y-6">
            
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Acerca del Documento</h2>
              <div className="space-y-4">
                
                {/* Cliente */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-building text-gray-400"></i></div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
                    <Link to={`/app/client-companies/${transaction.id_client_company}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 leading-tight">
                      {transaction.client_company_name}
                    </Link>
                  </div>
                </div>

                {/* RUC */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-id-card text-gray-400"></i></div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">RUC / NIT</p>
                    <p className="text-sm text-gray-900 tabular-nums">{transaction.client_ruc || '-'}</p>
                  </div>
                </div>

                <hr className="border-gray-200 my-2" />

                {/* Emisión */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-calendar-plus text-gray-400"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600">Emisión</p>
                    <p className="text-sm text-gray-900 tabular-nums">{transaction.issue_date_human || transaction.issue_date_input || '-'}</p>
                  </div>
                </div>
                
                {/* Vencimiento */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-calendar-xmark text-gray-400"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600">Vencimiento</p>
                    <p className={`text-sm font-medium tabular-nums ${transaction.status === 'VENCIDO' ? 'text-red-600' : 'text-gray-900'}`}>
                      {transaction.due_date_human || transaction.due_date_input || '-'}
                    </p>
                  </div>
                </div>

                {/* Estado Pago */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-clock text-gray-400"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600">Estado Pago</p>
                    <p className={`text-sm font-medium ${dueTime.className}`}>
                      {dueTime.text}
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Creado por */}
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Creado por</h2>
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                <Avatar
                  src={transaction.creator_avatar || null}
                  name={transaction.usuario_creador || transaction.created_by_name || 'Sistema'}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none">{transaction.usuario_creador || transaction.created_by_name || 'Sistema'}</p>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: TABS */}
          <div className="lg:col-span-8">
            
            {/* TABS */}
            <div className="border-b border-gray-200 mb-6 flex gap-6">
              <button onClick={() => setCurrentTab('resumen')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'resumen' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Resumen Financiero
              </button>
              <button onClick={() => setCurrentTab('abonos')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'abonos' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <span className="inline-flex items-center gap-2">
                  <span>Historial de Abonos</span>
                  <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-bold text-gray-600">
                    {paymentCount}
                  </span>
                </span>
              </button>
              <button onClick={() => setCurrentTab('archivos')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'archivos' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <span className="inline-flex items-center gap-2">
                  <span>Archivos</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      title="Factura"
                      className={`h-2.5 w-2.5 rounded-full ${transaction.invoice_file_url ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    ></span>
                    <span
                      title="Retención"
                      className={`h-2.5 w-2.5 rounded-full ${transaction.retention_file_url ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    ></span>
                  </span>
                </span>
              </button>
            </div>

            {/* TAB 1: RESUMEN FINANCIERO */}
            {currentTab === 'resumen' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PANEL IZQUIERDO: ESTRUCTURA DEL VALOR */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-800"><i className="fa-solid fa-calculator text-gray-400 mr-2"></i>Estructura del Valor</h3>
                  </div>
                  
                  <div className="p-5 text-sm">
                    {/* Bloque Base */}
                    <div className="space-y-3 text-gray-600 mb-4">
                      <div className="flex justify-between">
                        <span>Subtotal (Base Imponible)</span>
                        <span className="tabular-nums">{formatCurrency(transaction.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA {transaction.tax_rate > 0 ? `(${transaction.tax_rate}%)` : ''}</span>
                        <span className="tabular-nums">{formatCurrency(transaction.tax_amount)}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 mb-4"></div>

                    {/* Total y Retención */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-gray-900 font-medium">
                        <span>Total Factura</span>
                        <span className="tabular-nums font-semibold">{formatCurrency(transaction.total_value)}</span>
                      </div>
                      {transaction.retention_value > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Retención Aplicada ({(transaction.retention_value / transaction.total_value * 100).toFixed(1)}%)</span>
                          <span className="tabular-nums">- {formatCurrency(transaction.retention_value)}</span>
                        </div>
                      )}
                    </div>

                    {/* Neto */}
                    <div className="flex justify-between items-center bg-gray-50 -mx-5 px-5 py-3 border-y border-gray-100 mb-4">
                      <span className="font-bold text-gray-800">Total Neto a Cobrar</span>
                      <span className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency((transaction.total_value || 0) - (transaction.retention_value || 0))}</span>
                    </div>

                    {/* Abonos */}
                    <div className="flex justify-between text-emerald-600 mb-4">
                      <span>Abonos Recibidos</span>
                      <span className="tabular-nums font-medium">- {formatCurrency(transaction.paid_amount)}</span>
                    </div>

                    {/* Saldo Pendiente (Destacado) */}
                    <div className="flex justify-between items-center bg-amber-50 border border-amber-200/60 rounded-lg p-3">
                      <span className="font-bold text-amber-800 uppercase text-xs tracking-wider">Saldo Pendiente</span>
                      <span className="text-xl font-black text-amber-600 tabular-nums">{formatCurrency(transaction.balance_due)}</span>
                    </div>
                  </div>
                </div>

                {/* PANEL DERECHO: BOTÓN Y RESUMEN */}
                <div className="flex flex-col gap-6">
                  
                  {/* Botón Principal */}
                  {transaction.status !== 'PAGADO' && (
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium p-3 rounded-lg shadow-sm transition flex items-center justify-center gap-2">
                      <i className="fa-solid fa-money-bill-transfer"></i> Registrar Abono
                    </button>
                  )}

                  {/* Resumen Rápido */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="text-sm font-bold text-gray-800">Progreso de Pagos</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Porcentaje Pagado</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {transaction.total_value > 0 ? `${Math.round((transaction.paid_amount / transaction.total_value) * 100)}%` : '0%'}
                        </p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((transaction.paid_amount / Math.max(transaction.total_value, 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: HISTORIAL DE ABONOS */}
            {currentTab === 'abonos' && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-800">Historial de Pagos</h3>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                      {paymentCount}
                    </span>
                  </div>
                  {transaction.status !== 'PAGADO' && (
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-xs"></i> Agregar
                    </button>
                  )}
                </div>
                <div className="p-5">
                  <PaymentHistoryTable paymentHistory={transaction.payment_history} />
                </div>
              </div>
            )}

            {currentTab === 'archivos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Archivo de Factura</h3>
                      <p className="text-xs text-gray-500 mt-1">Documento principal de la factura</p>
                    </div>
                    <input
                      type="file"
                      ref={invoiceFileInputRef}
                      className="hidden"
                      onChange={handleUploadInvoiceFile}
                    />
                    <button
                      onClick={() => invoiceFileInputRef.current?.click()}
                      disabled={processing || uploadingInvoiceFile || Boolean(transaction.invoice_file_url)}
                      title={transaction.invoice_file_url ? 'Ya existe un archivo de factura. Elimínalo para subir otro.' : 'Subir archivo de factura'}
                      className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {uploadingInvoiceFile ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-upload text-xs"></i>}
                    </button>
                  </div>
                  <div className="p-5">
                    {!transaction.invoice_file_url ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        No hay archivo de factura.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <i className={`fa-solid ${getFileIconClass(transaction.invoice_file_url)} text-base`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{getFileNameFromUrl(transaction.invoice_file_url)}</p>
                            <p className="text-xs text-slate-500 truncate">Factura cargada</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openFileSecure(transaction.invoice_file_url)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteFile('invoice')}
                            disabled={deletingFileKey === 'invoice'}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {deletingFileKey === 'invoice' ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-trash-can"></i>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Archivo de Retención</h3>
                      <p className="text-xs text-gray-500 mt-1">Comprobante o soporte de retención</p>
                    </div>
                    <input
                      type="file"
                      ref={retentionFileInputRef}
                      className="hidden"
                      onChange={handleUploadRetentionFile}
                    />
                    <button
                      onClick={() => retentionFileInputRef.current?.click()}
                      disabled={processing || uploadingRetentionFile || Boolean(transaction.retention_file_url)}
                      title={transaction.retention_file_url ? 'Ya existe un archivo de retención. Elimínalo para subir otro.' : 'Subir archivo de retención'}
                      className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {uploadingRetentionFile ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-upload text-xs"></i>}
                    </button>
                  </div>
                  <div className="p-5">
                    {!transaction.retention_file_url ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        No hay archivo de retención.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <i className={`fa-solid ${getFileIconClass(transaction.retention_file_url)} text-base`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{getFileNameFromUrl(transaction.retention_file_url)}</p>
                            <p className="text-xs text-slate-500 truncate">Retención cargada</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openFileSecure(transaction.retention_file_url)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteFile('retention')}
                            disabled={deletingFileKey === 'retention'}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {deletingFileKey === 'retention' ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-trash-can"></i>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* PAYMENT FORM MODAL */}
      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        balanceDue={transaction.balance_due}
        onSubmit={handleAddPayment}
        isLoading={processing}
      />

      {/* COLLECTION MODAL */}
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
            automation_recipients: transaction.automation_recipients
          }} 
        />
      )}
    </div>
  );
};

export default FinancialDetail;

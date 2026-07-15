import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';
import AppModalViewport from '../../components/AppModalViewport';
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
      return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700';
    }
    if (normalizedCode === 'OVERDUE' || normalizedStatus === 'VENCIDO') {
      return 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700';
    }
    if (normalizedCode === 'WARNING' || normalizedCode === 'PENDING' || normalizedStatus === 'PENDIENTE') {
      return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700';
    }
    if (normalizedStatus === 'ANULADO') {
      return 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    }
    return 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
};

const getTypeBadgeColor = (type?: string) => {
  if (type === 'VENTA') return 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-700';
  if (type === 'GASTO' || type === 'COMPRA') return 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700';
  return 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
};

const getNotifyButtonStyles = (sent: boolean) => {
  return sent
    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50';
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
      className: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (indicator === 'PAGADO_ATRASADO') {
    return {
      text: statusLabel || `Pagado (Atraso de ${absoluteDays} días)`,
      className: 'text-red-600 dark:text-red-400',
    };
  }

  if (indicator === 'ATRASADO') {
    return {
      text: `Vencido hace ${absoluteDays} días`,
      className: 'text-red-600 dark:text-red-400',
    };
  }
  if (indicator === 'HOY') {
    return {
      text: 'Vence HOY',
      className: 'text-amber-600 dark:text-amber-400',
    };
  }
  if (indicator === 'A_TIEMPO') {
    return {
      text: `Vence en ${absoluteDays} días`,
      className: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  return {
    text: '-',
    className: 'text-gray-500 dark:text-gray-400',
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

const getContactName = (contact: any) => {
  const rawName = String(contact.name || '').trim();
  const firstLast = `${String(contact.first_name || '').trim()} ${String(contact.last_name || '').trim()}`.trim();
  const fallbackName = String(contact.full_name || contact.contact_name || contact.nombre_contacto || '').trim();
  return rawName || firstLast || fallbackName || 'Contacto';
};

const getContactEmail = (contact: any) => {
  return String(contact.email || contact.email_contact || contact.contact_email || contact.correo || contact.email_cliente || '').trim();
};

const normalizeAutomationRecipients = (raw: unknown) => {
  if (!Array.isArray(raw)) return [] as Array<{ name: string; email: string; type: 'contact' | 'team' | 'external'; is_primary?: boolean }>;
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
      return { name: name || email, email: email || name, type, is_primary: !!rec.is_primary };
    })
    .filter(Boolean) as Array<{ name: string; email: string; type: 'contact' | 'team' | 'external'; is_primary?: boolean }>;
};

const normalizeNotificationType = (rawType: unknown) => {
  const normalized = String(rawType || '').trim().toUpperCase();
  if (normalized === 'AUTO' || normalized === 'AUTOMATICO' || normalized === 'AUTOMATIC') return 'AUTOMATICO';
  return 'MANUAL';
};

const normalizeNotificationLogs = (rawLogs: unknown) => {
  if (!Array.isArray(rawLogs)) return [] as Array<{ fecha: string; hora: string; tipo: string; enviado_por: string; accionado_por: string; destinatarios: string; estado_envio: string }>;
  return rawLogs.map((item: any) => {
    const recipientsRaw = item?.destinatarios;
    const recipients = Array.isArray(recipientsRaw)
      ? recipientsRaw.join(', ')
      : String(recipientsRaw || '').trim();
    return {
      fecha: String(item?.fecha_human || item?.fecha || item?.fecha_raw || '-'),
      hora: String(item?.hora || ''),
      tipo: normalizeNotificationType(item?.tipo),
      enviado_por: String(item?.enviado_por || '').trim(),
      accionado_por: String(item?.accionado_por || '').trim(),
      destinatarios: recipients || '',
      estado_envio: String(item?.estado_envio || 'success').trim().toLowerCase(),
    };
  });
};

// --- COMPONENTE PRINCIPAL ---

const FinancialDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { invalidateFinancials, users: cachedUsers } = useDataCache();

  const [transaction, setTransaction] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [currentTab, setCurrentTab] = useState<'resumen' | 'abonos' | 'notificaciones' | 'archivos'>('resumen');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<import('../../types').PaymentRecord | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [providerContactSearch, setProviderContactSearch] = useState('');
  const [selectedProviderRecipients, setSelectedProviderRecipients] = useState<Array<{ id: string | null; name: string; email: string; type: 'contact' }>>([]);
  const [providerModalError, setProviderModalError] = useState<string | null>(null);
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [uploadingInvoiceFile, setUploadingInvoiceFile] = useState(false);
  const [uploadingRetentionFile, setUploadingRetentionFile] = useState(false);
  const [deletingFileKey, setDeletingFileKey] = useState<'invoice' | 'retention' | null>(null);
  const [financeContact, setFinanceContact] = useState<{ name?: string; email?: string } | null>(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const invoiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const retentionFileInputRef = useRef<HTMLInputElement | null>(null);

  const creatorAvatarFromCache = useMemo(() => {
    if (!transaction) return null;

    const creatorId = String(
      transaction.creator_user_id ||
      transaction.id_usuario_creador ||
      transaction.id_user_creador ||
      transaction.created_by ||
      ''
    ).trim();

    if (creatorId) {
      const userById = (cachedUsers || []).find((u: any) => String(u?.id_user) === creatorId);
      if (userById?.avatar_url) return userById.avatar_url;
    }

    const creatorName = String(transaction.usuario_creador || transaction.created_by_name || '').trim().toLowerCase();
    if (creatorName) {
      const userByName = (cachedUsers || []).find((u: any) => String(u?.name_user || '').trim().toLowerCase() === creatorName);
      if (userByName?.avatar_url) return userByName.avatar_url;
    }

    return null;
  }, [cachedUsers, transaction]);

  const creatorIsCurrentUser = useMemo(() => {
    if (!transaction || !user) return false;

    const creatorId = String(
      transaction.creator_user_id ||
      transaction.id_usuario_creador ||
      transaction.id_user_creador ||
      transaction.created_by ||
      ''
    ).trim();

    if (creatorId && String(user.id_user) === creatorId) return true;

    const creatorName = String(transaction.usuario_creador || transaction.created_by_name || '').trim().toLowerCase();
    const currentUserName = String(user.name_user || '').trim().toLowerCase();
    if (creatorName && currentUserName && creatorName === currentUserName) return true;

    return false;
  }, [transaction, user]);

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
      console.log('[FinancialDetail] Backend data:', tx);
      console.log('[FinancialDetail] payment_reference:', tx?.payment_reference);
      console.log('[FinancialDetail] historial_abonos:', tx?.historial_abonos);

      if (!tx) { navigate('/app/financials'); return; }

      const subtotal = toNumberSafe(tx.subtotal);
      const taxRate = toNumberSafe(tx.impuestos ?? tx.tax_rate ?? tx.impuestos_porcentaje ?? tx.v_tax_rate);
      const totalValue = toNumberSafe(tx.total_factura ?? tx.total_value);
      const paidAmount = toNumberSafe(tx.monto_pagado_caja ?? tx.paid_amount);

      const normalizedTx = {
        ...tx,
        id_transaction: tx.id_transaccion,
        transaction_type: normalizeTransactionType(tx.tipo_transaccion || tx.transaction_type),
        invoice_number: tx.numero_factura,
        description: tx.descripcion_concepto,
        status: tx.estado_registro,
        issue_date_input: tx.v_input_fecha_emision,
        due_date_input: tx.v_input_fecha_vencimiento,
        notify_contador: tx.notify_contador === true || tx.notify_contador === 'true' || tx.notify_contador === 1 || tx.notify_contador === '1',
        notify_provider: tx.notify_provider === true || tx.notify_provider === 'true' || tx.notify_provider === 1 || tx.notify_provider === '1',
        
        // --- Nuevos campos mapeados ---
        payment_date_input: tx.v_input_fecha_pago || tx.fecha_pago?.split('T')[0] || (Array.isArray(tx.historial_abonos) && tx.historial_abonos.length > 0 ? tx.historial_abonos[tx.historial_abonos.length - 1].payment_date : '') || '',
        payment_document_number: tx.numero_documento_pago,
        payment_reference: tx.payment_reference || tx.referencia_pago,
        retention_date_input: tx.v_input_fecha_retencion || tx.fecha_retencion?.split('T')[0] || '',
        retention_number: tx.retention_number,
        // ------------------------------
        
        issue_date_human: tx.v_texto_fecha_emision_human || tx.v_texto_fecha_emision,
        due_date_human: tx.v_texto_fecha_vencimiento_human || tx.v_texto_fecha_vencimiento,
        payment_date_human: tx.v_texto_fecha_pago_human || (Array.isArray(tx.historial_abonos) && tx.historial_abonos.length > 0 ? tx.historial_abonos[tx.historial_abonos.length - 1].payment_date : ''),
        payment_status_code: tx.v_codigo_estado,
        payment_status_label: tx.v_etiqueta_estado,
        client_company_name: tx.nombre_cliente_proveedor,
        client_ruc: tx.ruc_cliente_proveedor,
        client_address: tx.direccion_cliente,
        client_phone: tx.telefono_cliente,
        client_email: tx.email_cliente,
        id_client_company: tx.id_empresa_cliente,
        is_urgent: Boolean(tx.is_urgente ?? tx.es_urgente),
        subtotal,
        tax_amount: taxRate,
        tax_rate: taxRate,
        retention_value: toNumberSafe(tx.valor_retencion),
        total_value: totalValue,
        paid_amount: paidAmount,
        balance_due: Math.max(totalValue - paidAmount, 0),
        days_until_due: tx.v_dias_restantes ?? tx.days_until_due,
        due_time_indicator: tx.v_indicador_tiempo,
        due_time_absolute_days: tx.v_dias_absolutos,
        enable_automation: tx.enable_automation === true,
        automation_frequency: toNumberSafe(tx.automation_frequency),
        automation_recipients: normalizeAutomationRecipients(tx.automation_recipients),
        next_reminder_label: tx.v_texto_proximo_recordatorio_human || tx.v_proximo_recordatorio || tx.v_input_proximo_recordatorio,
        notification_logs: normalizeNotificationLogs(tx.notification_logs),
        resumen_notificaciones: tx.resumen_notificaciones,
        usuario_creador: tx.usuario_creador,
        creator_avatar: tx.avatar_usuario_creador || tx.usuario_creador_avatar || tx.created_by_avatar || tx.owner_avatar || null,
        creator_user_id: tx.id_usuario_creador || tx.id_user_creador || tx.created_by || null,
        invoice_file_url: tx.invoice_file_url || tx.url_factura || null,
        retention_file_url: tx.retention_file_url || tx.url_retencion || null,
        payment_history: Array.isArray(tx.historial_abonos)
          ? tx.historial_abonos.map((p: any) => ({
              id: p.id_payment,
              id_abono: p.id_payment,
              amount: toNumberSafe(p.amount),
              payment_date: String(p.payment_date || ''),
              payment_method: String(p.payment_method || ''),
              reference: p.reference_number ? String(p.reference_number) : p.reference ? String(p.reference) : undefined,
              notes: p.notes ? String(p.notes) : undefined,
              created_by: String(p.registrado_por || tx.usuario_creador || 'Sistema'),
              created_by_name: String(p.registrado_por || tx.usuario_creador || 'Sistema'),
              created_at: p.fecha_registro ? String(p.fecha_registro) : undefined,
              _sort_key: String(p.fecha_registro || p.payment_date || '').trim(),
            }))
            .sort((a: any, b: any) => (a._sort_key > b._sort_key ? 1 : a._sort_key < b._sort_key ? -1 : 0))
            .map(({ _sort_key, ...rest }: any) => rest)
          : [],
      };

      setTransaction(normalizedTx);
      navigate(location.pathname, { state: { breadcrumb: normalizedTx.invoice_number }, replace: true });
      if (!silent) setLoading(false);
      uiReady = true;

      if (normalizedTx.id_client_company) {
        void (async () => {
          try {
            const cRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies_contacts/detail?id_client_company=${normalizedTx.id_client_company}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
            if (cRes.ok) setCompanyContacts(await cRes.json());
          } catch { }
        })();
      }
    } catch (error) {
      setToast({ message: 'Error de carga', type: 'error' });
    } finally {
      if (!uiReady && !silent) setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refreshTenantFinanceContact = useCallback(async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant }));
      if (!res.ok) return;
      const data = await res.json();
      const tenant = Array.isArray(data) ? data[0] : data;
      const nextContact = tenant?.settings?.finance_contact;
      setFinanceContact(nextContact || null);
    } catch {
      setFinanceContact(null);
    }
  }, [user?.id_tenant]);

  useEffect(() => {
    refreshTenantFinanceContact();
  }, [refreshTenantFinanceContact]);

  useEffect(() => {
    const handleRefresh = () => { void refreshTenantFinanceContact(); };
    window.addEventListener('finance-contact-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('finance-contact-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [refreshTenantFinanceContact]);

  // --- HANDLERS ---
  const handleNotifyAccountant = async () => {
    if (!transaction?.id_transaction || !user) return;
    if (!financeContact?.email) {
      setToast({ message: 'Configura el contacto financiero en Integraciones del workspace.', type: 'error' });
      return;
    }
    setProcessing(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/financial/notify/accountant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_transaction: transaction.id_transaction,
            id_tenant: user.id_tenant,
            id_user: user.id_user,
        })
      });
      if (!res.ok) throw new Error();
      setToast({ message: 'Notificación enviada a contabilidad', type: 'success' });
    } catch {
      setToast({ message: 'Error al notificar a contabilidad', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const openProviderModal = () => {
    setProviderContactSearch('');
    setSelectedProviderRecipients([]);
    setProviderModalError(null);
    setIsProviderModalOpen(true);
  };

  const toggleProviderRecipient = (recipient: { id: string | null; name: string; email: string; type: 'contact' }) => {
    setSelectedProviderRecipients((prev) => {
      const exists = prev.some((item) => item.email === recipient.email);
      if (exists) return prev.filter((item) => item.email !== recipient.email);
      return [...prev, recipient];
    });
  };

  const selectAllProviderRecipients = () => {
    const filteredRecipients = (companyContacts || []).filter((contact) => {
      const name = getContactName(contact).toLowerCase();
      return providerContactSearch.trim() === '' || name.includes(providerContactSearch.trim().toLowerCase());
    }).map((contact) => {
      const email = getContactEmail(contact);
      if (!email) return null;
      return {
        id: contact.id_contact ? String(contact.id_contact) : contact.id ? String(contact.id) : null,
        name: getContactName(contact),
        email,
        type: 'contact' as const,
      };
    }).filter(Boolean) as Array<{ id: string | null; name: string; email: string; type: 'contact' }>;

    setSelectedProviderRecipients(filteredRecipients);
  };

  const clearAllProviderRecipients = () => {
    setSelectedProviderRecipients([]);
  };

  const handleSendProviderNotification = async () => {
    if (!transaction?.id_transaction || !user) return;
    if (selectedProviderRecipients.length === 0) {
      setProviderModalError('Selecciona al menos un contacto antes de enviar la notificación.');
      return;
    }
    setProviderModalError(null);
    setProcessing(true);
    try {
      await financialService.notifyProvider({
        id_transaction: transaction.id_transaction,
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        recipients: selectedProviderRecipients,
      });
      setTransaction((prev: any) => prev ? { ...prev, notify_provider: true } : prev);
      setToast({ message: 'Notificación enviada al proveedor', type: 'success' });
      setIsProviderModalOpen(false);
      await invalidateFinancials(getCurrentMonthRange());
      await fetchData(true);
    } catch {
      setToast({ message: 'Error al notificar al proveedor', type: 'error' });
    } finally {
      setProcessing(false);
    }
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
          paid_amount: toNumberSafe(updatedSummary.monto_pagado_caja ?? updatedSummary.paid_amount ?? prev.paid_amount),
        } : prev);
      }

      setToast({ message: 'Abono registrado exitosamente', type: 'success' });
      await invalidateFinancials(getCurrentMonthRange());
      await fetchData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar el abono';
      setToast({ message, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleEditPayment = async (paymentId: string, paymentData: {
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    notes?: string;
  }) => {
    if (!transaction || !user?.id_tenant) return;
    setProcessing(true);
    try {
      await financialService.updatePayment({
        id_payment: paymentId,
        id_tenant: user.id_tenant,
        id_transaction: transaction.id_transaction,
        ...paymentData,
      });
      setToast({ message: 'Abono actualizado exitosamente', type: 'success' });
      setEditingPayment(null);
      await invalidateFinancials(getCurrentMonthRange());
      await fetchData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar el abono';
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
  const canNotifyByEmail = hasEmailIntegration();
  const accountantNotified = Boolean(transaction.notify_contador);
  const providerNotified = Boolean(transaction.notify_provider);
  const showProviderButton = transaction.transaction_type !== 'VENTA';
  const providerButtonEnabled = transaction.status === 'PAGADO' && canNotifyByEmail;
  const providerButtonTitle = !canNotifyByEmail
    ? 'Activa tu integración de correo para poder notificar proveedor.'
    : transaction.status !== 'PAGADO'
      ? 'Solo habilitado cuando la transacción esté pagada.'
      : 'Notificar proveedor';

  const getNotificationSummaryTooltip = (summary: any, defaultLabel: string) => {
    if (!summary || !summary.sent_at || !summary.triggered_by_name) {
      return defaultLabel;
    }
    return `Enviado por ${summary.triggered_by_name} el ${summary.sent_at}`;
  };

  const getProviderSummaryRecipients = (summary: any) => {
    if (!summary || !Array.isArray(summary.recipients) || summary.recipients.length === 0) return null;
    const names = summary.recipients.map((recipient: any) => String(recipient.name || recipient.email || '').trim()).filter(Boolean);
    return names.length > 0 ? names.join(', ') : null;
  };

  const accountantTooltip = getNotificationSummaryTooltip(transaction.resumen_notificaciones?.finance, 'Notificar a contabilidad');
  const providerTooltip = getNotificationSummaryTooltip(transaction.resumen_notificaciones?.provider, providerButtonTitle);
  const providerSummaryRecipients = getProviderSummaryRecipients(transaction.resumen_notificaciones?.provider);
  const hasFinanceContactConfigured = !!String(financeContact?.email || '').trim();
  const isClosedStatus = transaction.status === 'PAGADO' || transaction.status === 'ANULADO';
  const balanceLabel = transaction.status === 'VENCIDO' ? 'Saldo Vencido' : 'Saldo Pendiente';

  // --- PROGRESO Y NETO: SOLO BACKEND ---
  // Usar valores directos del backend
  const taxAmountCurrency = Math.max((transaction.subtotal || 0) * ((transaction.tax_rate || 0) / 100), 0);
  const grossTotal = Math.max((transaction.subtotal || 0) + taxAmountCurrency, 0);
  const netToPay = transaction.total_value;
  const progressPercent = typeof transaction.progress_percent === 'number'
    ? transaction.progress_percent
    : (typeof transaction.paid_amount === 'number' && typeof transaction.total_value === 'number' && transaction.total_value > 0)
      ? Math.min(Math.round((transaction.paid_amount / transaction.total_value) * 100), 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#F9F9FA] dark:bg-slate-900">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} />
      
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap truncate dark:text-gray-100">Factura #{transaction.invoice_number}</h1>
              
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 border shrink-0 ${getTypeBadgeColor(transaction.transaction_type)}`}>
                {transaction.transaction_type}
              </span>

              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 border shrink-0 ${getPaymentStatusColor(transaction.payment_status_code, transaction.status)}`}>
                {getBaseStatusLabel(transaction.status)}
              </span>

              {transaction.is_urgent && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 border shrink-0 bg-rose-50 text-rose-700 border-rose-200 uppercase dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700">
                  <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                  URGENTE
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(transaction.transaction_type === 'GASTO' || transaction.transaction_type === 'COMPRA') && (
                <button
                  type="button"
                  onClick={handleNotifyAccountant}
                  disabled={processing || !hasFinanceContactConfigured}
                  className={`px-3 py-1.5 border rounded text-sm font-medium transition flex items-center gap-2 ${getNotifyButtonStyles(accountantNotified)} disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={!hasFinanceContactConfigured ? 'Configura un contacto financiero en Integraciones del workspace.' : accountantTooltip}
                >
                  <i className="fa-solid fa-paper-plane text-xs" title={accountantTooltip}></i>
                  {accountantNotified ? 'Contadora Enviada' : 'Notificar Contadora'}
                </button>
              )}

              {showProviderButton && (
                <button
                  type="button"
                  onClick={openProviderModal}
                  disabled={processing || !providerButtonEnabled}
                  className={`px-3 py-1.5 border rounded text-sm font-medium transition flex items-center gap-2 ${getNotifyButtonStyles(providerNotified)} disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={providerTooltip}
                >
                  <i className="fa-solid fa-handshake-angle text-xs" title={providerTooltip}></i>
                  {providerNotified ? 'Proveedor Notificado' : 'Notificar Proveedor'}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600 max-w-[560px] truncate dark:text-gray-400">{transaction.description || '-'}</p>
          </div>
          
          <div className="ml-auto w-full md:w-auto flex items-center justify-end gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide dark:text-gray-400">{balanceLabel}</p>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(transaction.balance_due)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {!isClosedStatus && (
                <button
                  onClick={() => setIsCollectionModalOpen(true)}
                  disabled={processing || !canNotifyByEmail}
                  className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded text-sm font-medium hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                  title={!canNotifyByEmail ? 'Activa tu integración de correo para notificar vencimientos.' : 'Notificar vencimiento'}
                >
                  <i className="fa-solid fa-bell text-xs"></i>
                  {transaction.status === 'VENCIDO' ? 'Notificar Vencimiento' : 'Enviar Recordatorio'}
                </button>
              )}
              <button onClick={() => navigate(`/app/financials/edit?id=${transaction.id_transaction}`)} className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm font-medium transition flex items-center gap-2 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900">
                <i className="fa-solid fa-pen text-xs"></i> Editar
              </button>
              <button onClick={() => setConfirmState({ isOpen: true, title: '¿Seguro desea eliminar este registro?', message: 'Esta acción es irreversible.', onConfirm: handleDelete })} className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 text-gray-700 transition dark:border-slate-600 dark:hover:bg-slate-700 dark:text-gray-300"><i className="fa-solid fa-trash text-xs"></i></button>
            </div>
          </div>
          </div>

          {/* PROGRESS BAR */}
          {isProviderModalOpen && (
            <AppModalViewport className="z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden dark:bg-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Notificar proveedor</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona los contactos de la empresa que recibirán esta notificación.</p>
                  </div>
                  <button onClick={() => setIsProviderModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-slate-400"><i className="fa-solid fa-times"></i></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-gray-500">Buscar contactos</label>
                    <input
                      value={providerContactSearch}
                      onChange={(e) => setProviderContactSearch(e.target.value)}
                      placeholder="Buscar por nombre"
                      className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm outline-none focus:border-slate-300 focus:bg-white dark:border-slate-600 dark:bg-slate-700/50 dark:focus:border-slate-500 dark:focus:bg-slate-800"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={selectAllProviderRecipients}
                      className="px-3 py-2 bg-slate-800 text-white rounded-md text-sm font-semibold hover:bg-slate-700 transition"
                    >
                      Seleccionar todo
                    </button>
                    <button
                      type="button"
                      onClick={clearAllProviderRecipients}
                      className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-semibold hover:bg-slate-50 transition dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Deseleccionar todo
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedProviderRecipients.length} seleccionado{selectedProviderRecipients.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
                    {(() => {
                      const rows = (companyContacts || []).filter((contact) => {
                        const name = getContactName(contact).toLowerCase();
                        return providerContactSearch.trim() === '' || name.includes(providerContactSearch.trim().toLowerCase());
                      }).map((contact) => {
                        const email = getContactEmail(contact);
                        if (!email) return null;
                        const name = getContactName(contact);
                        const contactId = contact.id_contact ?? contact.id ?? null;
                        const isSelected = selectedProviderRecipients.some((item) => item.email === email);
                        return (
                          <button
                            key={`${contactId ?? 'anon'}-${email}`}
                            type="button"
                            onClick={() => toggleProviderRecipient({ id: contactId ? String(contactId) : null, name, email, type: 'contact' })}
                            className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition ${isSelected ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate dark:text-slate-200">{name}</p>
                              <p className="text-[11px] text-slate-500 truncate dark:text-slate-400">{email}</p>
                            </div>
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent dark:bg-slate-800'}`}>
                              <i className="fa-solid fa-check text-[10px]"></i>
                            </span>
                          </button>
                        );
                      }).filter(Boolean);

                      if (rows.length === 0) {
                        return (
                          <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                            No se encontraron contactos de la empresa. Verifica que la empresa tenga contactos cargados.
                          </div>
                        );
                      }

                      return rows;
                    })()}
                  </div>

                  {providerModalError && <div className="text-sm text-red-600 dark:text-red-400">{providerModalError}</div>}
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 dark:bg-slate-700/50 dark:border-slate-700">
                  <button onClick={() => setIsProviderModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 dark:text-slate-400 dark:hover:bg-slate-600 dark:border-slate-600">Cancelar</button>
                  <button
                    onClick={handleSendProviderNotification}
                    disabled={processing || selectedProviderRecipients.length === 0}
                    className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Enviar notificación
                  </button>
                </div>
              </div>
            </AppModalViewport>
          )}
          <div className="flex items-center w-full max-w-[700px] gap-2.5 mt-5">
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'PENDIENTE' ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'PENDIENTE' ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'}`}>
              <i className={`fa-solid ${transaction.status === 'PENDIENTE' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> PENDIENTE
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'VENCIDO' ? 'bg-rose-500' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'VENCIDO' ? 'text-rose-600' : 'text-gray-400 dark:text-gray-500'}`}>
              <i className={`fa-solid ${transaction.status === 'VENCIDO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> VENCIDO
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'PAGADO' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'PAGADO' ? 'text-emerald-600' : 'text-gray-400 dark:text-gray-500'}`}>
              <i className={`fa-solid ${transaction.status === 'PAGADO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> PAGADO
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 w-full rounded-full ${transaction.status === 'ANULADO' ? 'bg-slate-500' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
            <span className={`text-[11px] font-semibold uppercase flex items-center gap-1 ${transaction.status === 'ANULADO' ? 'text-slate-600 dark:text-slate-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <i className={`fa-solid ${transaction.status === 'ANULADO' ? 'fa-circle' : 'fa-circle-notch'} text-[8px]`}></i> ANULADO
            </span>
          </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: DATOS RÁPIDOS */}
          <div className="lg:col-span-4 space-y-6">
            
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 dark:text-gray-500">Acerca del Documento</h2>
              <div className="space-y-4">
                
                {/* Cliente */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-building text-gray-400 dark:text-gray-500"></i></div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5 dark:text-gray-400">Cliente</p>
                    <Link to={`/app/client-companies/${transaction.id_client_company}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 leading-tight dark:text-gray-100">
                      {transaction.client_company_name}
                    </Link>
                  </div>
                </div>

                {/* RUC */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-id-card text-gray-400 dark:text-gray-500"></i></div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5 dark:text-gray-400">RUC / NIT</p>
                    <p className="text-sm text-gray-900 tabular-nums dark:text-gray-100">{transaction.client_ruc || '-'}</p>
                  </div>
                </div>

                <hr className="border-gray-200 my-2 dark:border-slate-700" />

                {/* Emisión */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-calendar-plus text-gray-400 dark:text-gray-500"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Emisión</p>
                    <p className="text-sm text-gray-900 tabular-nums dark:text-gray-100">{transaction.issue_date_human || transaction.issue_date_input || '-'}</p>
                  </div>
                </div>
                
                {/* Vencimiento */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-calendar-xmark text-gray-400 dark:text-gray-500"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Vencimiento</p>
                    <p className={`text-sm font-medium tabular-nums ${transaction.status === 'VENCIDO' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {transaction.due_date_human || transaction.due_date_input || '-'}
                    </p>
                  </div>
                </div>

                {/* NUEVO: Detalles de Retención */}
                {transaction.retention_value > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-file-invoice-dollar text-gray-400 dark:text-gray-500"></i></div>
                    <div className="w-full flex justify-between items-start">
                      <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-400">Retención</p>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">{transaction.retention_number || 'Sin número'}</p>
                        {transaction.retention_date_input && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{transaction.retention_date_input}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}



                {/* NUEVO: Fecha de Pago Directa */}
                {transaction.payment_date_input && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 flex justify-center pt-0.5"><i className="fa-regular fa-calendar-check text-gray-400 dark:text-gray-500"></i></div>
                    <div className="w-full flex justify-between items-start">
                      <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-400">Fecha Pago</p>
                      <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">{transaction.payment_date_human || transaction.payment_date_input}</p>
                    </div>
                  </div>
                )}

                {/* N° de Factura */}
                {transaction.invoice_number && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-file-invoice text-gray-400 dark:text-gray-500"></i></div>
                    <div className="w-full flex justify-between items-start">
                      <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-400">N° Factura</p>
                      <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">{transaction.invoice_number}</p>
                    </div>
                  </div>
                )}

                {/* Referencia del Último Abono */}
                {(() => {
                  const lastPayment = transaction.payment_history?.length > 0
                    ? [...transaction.payment_history].sort((a: any, b: any) => {
                        const dateA = String(a.created_at || a.payment_date || '');
                        const dateB = String(b.created_at || b.payment_date || '');
                        return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
                      })[0]
                    : null;
                  const reference = lastPayment?.reference || transaction.payment_reference;
                  if (!reference) return null;
                  return (
                    <div className="flex items-start gap-3">
                      <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-receipt text-emerald-400"></i></div>
                      <div className="w-full flex justify-between items-start">
                        <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-400">Referencia</p>
                        <p className="text-sm font-medium text-gray-900 tabular-nums font-mono dark:text-gray-100">{reference}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Estado Pago Relativo */}
                <div className="flex items-start gap-3">
                  <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-clock text-gray-400 dark:text-gray-500"></i></div>
                  <div className="w-full flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Estado</p>
                    <p className={`text-sm font-medium ${dueTime.className}`}>
                      {dueTime.text}
                    </p>
                  </div>
                </div>

                {/* Último envío a contador */}
                {transaction.resumen_notificaciones?.finance?.sent_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-envelope text-blue-400"></i></div>
                    <div className="w-full flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Último envío a contador</p>
                      <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">
                        {transaction.resumen_notificaciones.finance.sent_at}
                      </p>
                    </div>
                  </div>
                )}

                {/* Último envío a proveedor */}
                {transaction.resumen_notificaciones?.provider?.sent_at && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-building text-purple-400"></i></div>
                      <div className="w-full flex justify-between items-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Último envío a proveedor</p>
                        <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">
                          {transaction.resumen_notificaciones.provider.sent_at}
                        </p>
                      </div>
                    </div>
                    {providerSummaryRecipients && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 flex justify-center pt-0.5"><i className="fa-solid fa-user text-purple-400"></i></div>
                        <div className="w-full">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Destinatario(s)</p>
                          <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{providerSummaryRecipients}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Creado por */}
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 dark:text-gray-500">Creado por</h2>
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white dark:border-slate-700 dark:bg-slate-800">
                <Avatar
                  src={creatorAvatarFromCache || transaction.creator_avatar || null}
                  name={transaction.usuario_creador || transaction.created_by_name || 'Sistema'}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none dark:text-gray-100">
                    {transaction.usuario_creador || transaction.created_by_name || 'Sistema'}
                    {creatorIsCurrentUser && <span className="text-gray-400 font-medium dark:text-gray-500"> (Tú)</span>}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: TABS */}
          <div className="lg:col-span-8">
            
            {/* TABS */}
            <div className="border-b border-gray-200 mb-6 flex gap-6 dark:border-slate-700">
              <button onClick={() => setCurrentTab('resumen')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'resumen' ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                Resumen Financiero
              </button>
              <button onClick={() => setCurrentTab('abonos')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'abonos' ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                <span className="inline-flex items-center gap-2">
                  <span>Historial de Abonos</span>
                  <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-bold text-gray-600 dark:bg-slate-700 dark:text-gray-400">
                    {paymentCount}
                  </span>
                </span>
              </button>
              <button onClick={() => setCurrentTab('notificaciones')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'notificaciones' ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                <span className="inline-flex items-center gap-2">
                  <span>Historial de Auditoría</span>
                  <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-bold text-gray-600 dark:bg-slate-700 dark:text-gray-400">
                    {transaction.notification_logs?.length || 0}
                  </span>
                </span>
              </button>
              <button onClick={() => setCurrentTab('archivos')} className={`pb-3 border-b-2 text-sm font-semibold transition-colors ${currentTab === 'archivos' ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                <span className="inline-flex items-center gap-2">
                  <span>Archivos</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      title="Factura"
                      className={`h-2.5 w-2.5 rounded-full ${transaction.invoice_file_url ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-500'}`}
                    ></span>
                    <span
                      title="Retención"
                      className={`h-2.5 w-2.5 rounded-full ${transaction.retention_file_url ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-500'}`}
                    ></span>
                  </span>
                </span>
              </button>
            </div>

            {/* TAB 1: RESUMEN FINANCIERO */}
            {currentTab === 'resumen' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PANEL IZQUIERDO: ESTRUCTURA DEL VALOR */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 dark:border-slate-700 dark:bg-slate-700/30">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200"><i className="fa-solid fa-calculator text-gray-400 mr-2 dark:text-gray-500"></i>Estructura del Valor</h3>
                  </div>
                  
                  <div className="p-5 text-sm">
                    {/* Bloque Base */}
                    <div className="space-y-3 text-gray-600 mb-4 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Subtotal (Base Imponible)</span>
                        <span className="tabular-nums">{formatCurrency(transaction.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA {transaction.tax_rate > 0 ? `(${transaction.tax_rate}%)` : ''}</span>
                        <span className="tabular-nums">{formatCurrency(taxAmountCurrency)}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 mb-4 dark:border-slate-700"></div>

                    {/* Total Bruto antes de retención */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-gray-900 font-medium dark:text-gray-100">
                        <span>Total antes de Retención</span>
                        <span className="tabular-nums font-semibold">{formatCurrency(grossTotal)}</span>
                      </div>
                      {transaction.retention_value > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Retención Aplicada ({grossTotal > 0 ? `${((transaction.retention_value / grossTotal) * 100).toFixed(1)}%` : '0%'})</span>
                          <span className="tabular-nums">- {formatCurrency(transaction.retention_value)}</span>
                        </div>
                      )}
                    </div>

                    {/* Neto: solo mostrar el total_value del backend */}
                    <div className="flex justify-between items-center bg-gray-50 -mx-5 px-5 py-3 border-y border-gray-100 mb-4 dark:bg-slate-700/50 dark:border-slate-700">
                      <span className="font-bold text-gray-800 dark:text-gray-200">Total Neto a Cobrar</span>
                      <span className="text-lg font-bold text-gray-900 tabular-nums dark:text-gray-100">{formatCurrency(transaction.total_value)}</span>
                    </div>

                    {/* Abonos */}
                    <div className="flex justify-between text-emerald-600 mb-4">
                      <span>Abonos Recibidos</span>
                      <span className="tabular-nums font-medium">- {formatCurrency(transaction.paid_amount)}</span>
                    </div>

                    {/* Saldo */}
                    <div className="flex justify-between items-center bg-amber-50 border border-amber-200/60 rounded-lg p-3 dark:bg-amber-900/30 dark:border-amber-700/60">
                      <span className="font-bold text-amber-800 uppercase text-xs tracking-wider dark:text-amber-400">{balanceLabel}</span>
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

                  {/* Resumen Rápido (Corregido con Retención) */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 dark:border-slate-700 dark:bg-slate-700/30">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Progreso de Pagos</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Porcentaje Pagado</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {transaction.total_value > 0 ? `${progressPercent}%` : '0%'}
                        </p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-slate-600">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: HISTORIAL DE ABONOS */}
            {currentTab === 'abonos' && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center dark:border-slate-700 dark:bg-slate-700/30">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Historial de Pagos</h3>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-slate-700 dark:text-gray-400">
                      {paymentCount}
                    </span>
                  </div>
                  {transaction.status !== 'PAGADO' && (
                    <button 
                      onClick={() => { setEditingPayment(null); setIsPaymentModalOpen(true); }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-money-bill-transfer text-xs"></i> Registrar Abono
                    </button>
                  )}
                </div>
                <div className="p-5">
                  <PaymentHistoryTable
                    paymentHistory={transaction.payment_history}
                    onEdit={(payment) => {
                      setEditingPayment(payment);
                      setIsPaymentModalOpen(true);
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: HISTORIAL DE NOTIFICACIONES */}
            {currentTab === 'notificaciones' && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 dark:border-slate-700 dark:bg-slate-700/30">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Historial de Auditoría</h3>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-slate-700 dark:text-gray-400">
                      {transaction.notification_logs?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  {!transaction.notification_logs || transaction.notification_logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <i className="fa-solid fa-bell-slash text-3xl mb-3 text-gray-300 dark:text-gray-600"></i>
                      <p className="text-sm">No hay historial de auditoría</p>
                    </div>
                  ) : (
                    <div className="relative space-y-6">
                      <div className="absolute left-7 top-6 bottom-6 w-px bg-gray-200 dark:bg-slate-700"></div>
                      {transaction.notification_logs.map((log: any, index: number) => (
                        <div key={index} className="relative flex gap-4 pl-10">
                          <div className="absolute left-0 top-2 w-12 flex justify-center">
                            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm dark:bg-slate-800 dark:border-slate-700">
                              <i className={`fa-solid ${log.tipo === 'CONTADORA' ? 'fa-building-columns' : 'fa-envelope'} text-blue-600 text-sm dark:text-blue-400`}></i>
                            </div>
                          </div>
                          <div className="flex-1 p-4 border border-gray-200 rounded-xl bg-gray-50 dark:border-slate-700 dark:bg-slate-700/50">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {log.tipo === 'CONTADORA' ? 'Notificación a Contadora' : 'Notificación a Proveedor'}
                              </span>
                              {log.estado_envio && log.estado_envio !== 'success' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Error
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-2 dark:text-gray-400">{log.fecha}</p>
                            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                              {(log.accionado_por || log.enviado_por) && (
                                <p><strong>Enviado por:</strong> {log.accionado_por || log.enviado_por}</p>
                              )}
                              {log.destinatarios && (
                                <p><strong>Destinatarios:</strong> {log.destinatarios}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentTab === 'archivos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 dark:border-slate-700 dark:bg-slate-700/30">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Archivo de Factura</h3>
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Documento principal de la factura</p>
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
                      className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {uploadingInvoiceFile ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-upload text-xs"></i>}
                    </button>
                  </div>
                  <div className="p-5">
                    {!transaction.invoice_file_url ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-gray-400">
                        No hay archivo de factura.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 dark:bg-slate-700">
                            <i className={`fa-solid ${getFileIconClass(transaction.invoice_file_url)} text-base`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-200">{getFileNameFromUrl(transaction.invoice_file_url)}</p>
                            <p className="text-xs text-slate-500 truncate dark:text-slate-400">Factura cargada</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openFileSecure(transaction.invoice_file_url)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors dark:text-gray-500">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteFile('invoice')}
                            disabled={deletingFileKey === 'invoice'}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 dark:text-gray-500"
                          >
                            {deletingFileKey === 'invoice' ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-trash-can"></i>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 dark:border-slate-700 dark:bg-slate-700/30">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Archivo de Retención</h3>
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Comprobante o soporte de retención</p>
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
                      className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-400"
                    >
                      {uploadingRetentionFile ? <BrandSpinner size="xs" /> : <i className="fa-solid fa-upload text-xs"></i>}
                    </button>
                  </div>
                  <div className="p-5">
                    {!transaction.retention_file_url ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-gray-400">
                        No hay archivo de retención.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 dark:bg-slate-700">
                            <i className={`fa-solid ${getFileIconClass(transaction.retention_file_url)} text-base`}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-200">{getFileNameFromUrl(transaction.retention_file_url)}</p>
                            <p className="text-xs text-slate-500 truncate dark:text-slate-400">Retención cargada</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openFileSecure(transaction.retention_file_url)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors dark:text-gray-500">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteFile('retention')}
                            disabled={deletingFileKey === 'retention'}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 dark:text-gray-500"
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
        onClose={() => { setIsPaymentModalOpen(false); setEditingPayment(null); }}
        balanceDue={transaction.balance_due}
        editPayment={editingPayment}
        onSubmit={handleAddPayment}
        onEditSubmit={handleEditPayment}
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
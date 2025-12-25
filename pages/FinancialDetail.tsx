import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import type { FinancialTransaction, ClientCompany, Quote } from '../types';

const FinancialDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transaction, setTransaction] = useState<Partial<FinancialTransaction> | null>(null);
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<FinancialTransaction> | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
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

  const getTypeBadge = (type?: string) => {
    if (!type) return null;
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

  const handleEditModalOpen = () => {
    setEditData({ ...transaction });
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditData(prev => {
      if (!prev) return prev;
      return { ...prev, [name]: value };
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!transaction) return;
    setProcessing(true);
    try {
      const payload = {
        ...transaction,
        status: newStatus,
        id_transaction: transaction.id_transaction,
        id_tenant: user?.id_tenant,
        created_by: transaction.created_by || user?.id_user,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al actualizar estado.');

      setTransaction(prev => prev ? { ...prev, status: newStatus as 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'ANULADO' } : prev);
      setToast({ message: 'Estado actualizado correctamente.', type: 'success' });
    } catch (error: any) {
      console.error('Error updating status:', error);
      setToast({ message: error?.message || 'No se pudo actualizar el estado.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editData || !user) return;
    setProcessing(true);
    try {
      const payload = {
        ...editData,
        id_transaction: editData.id_transaction,
        id_tenant: user.id_tenant,
        created_by: editData.created_by || user.id_user,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al actualizar la transacción.');

      setTransaction(editData);
      setIsEditModalOpen(false);
      setToast({ message: 'Transacción actualizada correctamente.', type: 'success' });
    } catch (error: any) {
      console.error('Error saving edit:', error);
      setToast({ message: error?.message || 'No se pudo guardar los cambios.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPayment = async () => {
    if (!transaction || paymentAmount <= 0 || !user) return;
    setProcessing(true);
    try {
      const currentPaid = parseFloat(transaction.paid_amount as any) || 0;
      const currentBalance = parseFloat((transaction.balance_due || transaction.balance || 0) as any) || 0;
      const newPaidAmount = currentPaid + paymentAmount;
      const newBalance = Math.max(currentBalance - paymentAmount, 0);
      const payload = {
        ...transaction,
        paid_amount: newPaidAmount,
        balance_due: newBalance,
        id_transaction: transaction.id_transaction,
        id_tenant: user.id_tenant,
        created_by: transaction.created_by || user.id_user,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al agregar el abono.');

      setTransaction(prev => prev ? { ...prev, paid_amount: newPaidAmount, balance_due: newBalance } : prev);
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setToast({ message: 'Abono registrado correctamente.', type: 'success' });
    } catch (error: any) {
      console.error('Error adding payment:', error);
      setToast({ message: error?.message || 'No se pudo registrar el abono.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleNotifyOverdue = async () => {
    if (!transaction?.id_transaction || !user) return;
    setProcessing(true);
    try {
      const response = await fetch('https://service.computeksa.com/webhook/api/financials/notify-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_transaction: transaction.id_transaction,
          id_tenant: user.id_tenant,
          id_user: user.id_user,
        }),
      });

      if (!response.ok) throw new Error('Error al notificar al cliente.');

      setToast({ message: 'Cliente notificado sobre pago vencido.', type: 'success' });
    } catch (error: any) {
      console.error('Error notifying client:', error);
      setToast({ message: error?.message || 'No se pudo notificar al cliente.', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const computeDueDate = (invoiceDate?: string, creditDays?: number) => {
    if (!invoiceDate) return '';
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + (creditDays || 0));
    return date.toISOString().split('T')[0];
  };

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant) return;
    setLoading(true);
    try {
      const [txResponse, companiesRes, quotesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/financial/detail?id_tenant=${user.id_tenant}&id_transaction=${id}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`https://service.computeksa.com/webhook/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
      ]);

      // Cargar clientes
      if (companiesRes.ok) {
        const companiesText = await companiesRes.text();
        const companiesData = companiesText ? JSON.parse(companiesText) : [];
        setClientCompanies(Array.isArray(companiesData) ? companiesData : []);
      }

      // Cargar cotizaciones
      if (quotesRes.ok) {
        const quotesText = await quotesRes.text();
        const quotesData = quotesText ? JSON.parse(quotesText) : [];
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
      }

      if (!txResponse.ok) {
        if (txResponse.status === 404) {
          setToast({ message: 'Transacción no encontrada.', type: 'error' });
          setTimeout(() => navigate('/financials'), 800);
        } else {
          throw new Error('Error al cargar la transacción.');
        }
        setLoading(false);
        return;
      }

      const text = await txResponse.text();
      const data = text ? JSON.parse(text) : null;

      console.log('Financial Detail Response:', { data, id, idTenant: user?.id_tenant });

      let tx: any = null;
      if (Array.isArray(data) && data.length > 0) {
        tx = data[0];
      } else if (!Array.isArray(data)) {
        tx = data;
      }

      if (!tx) {
        setToast({ message: 'No se encontró la transacción.', type: 'error' });
        setTimeout(() => navigate('/financials'), 800);
        return;
      }

      const totalValue = parseFloat(tx.total_factura || tx.monto_total || tx.total_value || 0) || 0;
      const paidAmount = parseFloat(tx.v_total_abonado || tx.monto_pagado_caja || tx.monto_abonado || tx.paid_amount || 0) || 0;
      const balanceDue = tx.v_saldo_pendiente !== undefined && tx.v_saldo_pendiente !== null
        ? parseFloat(tx.v_saldo_pendiente)
        : (tx.saldo_pendiente !== undefined && tx.saldo_pendiente !== null
          ? parseFloat(tx.saldo_pendiente)
          : totalValue - paidAmount);

      setTransaction({
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
        subtotal: parseFloat(tx.subtotal || 0) || 0,
        tax_amount: parseFloat(tx.impuestos || tx.tax_amount || 0) || 0,
        retention_value: parseFloat(tx.valor_retencion || tx.retention_value || 0) || 0,
        total_value: totalValue,
        paid_amount: paidAmount,
        balance_due: balanceDue,
      });
    } catch (error: any) {
      console.error('Error fetching financial transaction:', error);
      setToast({ message: error?.message || 'Error al cargar la transacción.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user?.id_tenant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    if (user.rol_user !== 'admin' && user.rol_user !== 'superadmin') {
      setToast({ message: 'Acceso denegado. Solo administradores pueden gestionar finanzas.', type: 'error' });
      setTimeout(() => navigate('/dashboard'), 1500);
    }
  }, [navigate, user]);

  const openDeleteConfirm = () => {
    if (!transaction?.id_transaction) return;
    setConfirmState({
      isOpen: true,
      title: '¿Eliminar transacción?',
      message: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        try {
          setProcessing(true);
          const response = await fetch('https://service.computeksa.com/webhook/api/financials/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_transaction: transaction.id_transaction }),
          });
          if (!response.ok) throw new Error('Error al eliminar la transacción.');
          setToast({ message: 'Transacción eliminada.', type: 'success' });
          setTimeout(() => navigate('/financials'), 800);
        } catch (error: any) {
          console.error('Error deleting financial transaction:', error);
          setToast({ message: error?.message || 'No se pudo eliminar.', type: 'error' });
        } finally {
          setProcessing(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
          <p className="text-slate-500 font-medium animate-pulse">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
          <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-3"></i>
          <h3 className="text-lg font-bold text-red-700">Transacción no encontrada</h3>
          <button
            onClick={() => navigate('/financials')}
            className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{transaction.invoice_number}</h1>
          <p className="text-slate-500 mt-1 font-medium">{transaction.description || 'Sin descripción'}</p>
          <div className="flex items-center gap-2 mt-3">
            {getStatusBadge(transaction.status)}
            {getTypeBadge(transaction.transaction_type)}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleEditModalOpen}
              disabled={processing}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-60"
            >
              <i className="fa-solid fa-pencil mr-2"></i>
              Editar
            </button>
            <button
              onClick={openDeleteConfirm}
              disabled={processing}
              className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-colors"
            >
              <i className="fa-solid fa-trash mr-2"></i>
              Eliminar
            </button>
          </div>
          {transaction.status === 'VENCIDO' && (
            <button
              onClick={handleNotifyOverdue}
              disabled={processing}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-60"
            >
              <i className="fa-solid fa-bell mr-2"></i>
              Notificar vencimiento
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Payment Status */}
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${getPaymentStatusColor(transaction.payment_status_code)}`}>
          <div className="w-12 h-12 rounded-lg bg-white/60 flex items-center justify-center text-lg">
            <i className="fa-solid fa-receipt"></i>
          </div>
          <div>
            <div className="text-xs uppercase font-bold opacity-80">Estado de pago</div>
            <select
              value={transaction.status || ''}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={processing}
              className="text-lg font-bold bg-transparent border-none outline-none cursor-pointer"
              style={{ color: 'inherit' }}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
              <option value="VENCIDO">Vencido</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
        </div>

        {/* Client Info */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-lg text-slate-600">
            <i className="fa-solid fa-building"></i>
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-slate-600">Cliente</div>
            <div className="text-lg font-bold text-slate-800">{transaction.client_company_name || 'Sin cliente'}</div>
          </div>
        </div>

        {/* Add Payment Button */}
        <button
          onClick={() => setIsPaymentModalOpen(true)}
          disabled={processing}
          className="flex items-center gap-4 p-4 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-60"
        >
          <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-lg text-green-600">
            <i className="fa-solid fa-plus"></i>
          </div>
          <div className="text-left">
            <div className="text-xs uppercase font-bold text-green-600">Agregar abono</div>
            <div className="text-sm font-semibold text-slate-800">Registrar pago</div>
          </div>
        </button>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center">
          <h3 className="font-bold text-slate-800 flex items-center">
            <span className="w-2 h-6 bg-brand-500 rounded-full mr-3"></span>
            Detalles de la Transacción
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Row 1: Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Fecha de emisión</div>
              <div className="text-lg font-semibold text-slate-800">
                {transaction.issue_date_input || transaction.issue_date?.split('T')[0] || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Fecha de vencimiento</div>
              <div className="text-lg font-semibold text-slate-800">
                {transaction.due_date_input || transaction.due_date?.split('T')[0] || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Días de crédito</div>
              <div className="text-lg font-semibold text-slate-800">{transaction.credit_days || 0} días</div>
            </div>
          </div>

          {/* Row 2: Amounts */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Subtotal</div>
              <div className="text-lg font-semibold text-slate-800">
                ${parseFloat(transaction.subtotal as any || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Impuesto (IVA)</div>
              <div className="text-lg font-semibold text-slate-800">
                {transaction.tax_amount}% - $
                {parseFloat(((parseFloat(transaction.subtotal as any || 0) * parseFloat(transaction.tax_amount as any || 0)) / 100).toString()).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Total</div>
              <div className="text-lg font-bold text-brand-600">
                ${parseFloat(transaction.total_value as any || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Pagado</div>
              <div className="text-lg font-semibold text-green-600">
                ${parseFloat(transaction.paid_amount as any || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold text-slate-500 mb-1">Saldo pendiente</div>
              <div className="text-lg font-semibold text-amber-600">
                ${parseFloat((transaction.balance_due || transaction.balance || 0) as any).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* Payment Info if Paid */}
          {transaction.status === 'PAGADO' && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="font-semibold text-slate-700">Información de Pago</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Fecha de pago</div>
                  <div className="text-sm text-slate-800">{transaction.payment_date_input || transaction.payment_date?.split('T')[0] || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Método</div>
                  <div className="text-sm text-slate-800">{transaction.payment_method || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Referencia</div>
                  <div className="text-sm text-slate-800">{transaction.payment_reference || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Retention Info if Present */}
          {transaction.has_retention && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="font-semibold text-slate-700">Información de Retención</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Número de retención</div>
                  <div className="text-sm text-slate-800">{transaction.retention_number || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Fecha de retención</div>
                  <div className="text-sm text-slate-800">{transaction.retention_date_input || transaction.retention_date?.split('T')[0] || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Valor de retención</div>
                  <div className="text-sm text-slate-800">
                    ${parseFloat(transaction.retention_value as any || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes if Present */}
          {transaction.notes && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h4 className="font-semibold text-slate-700">Notas</h4>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{transaction.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Editar Transacción</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Transacción</label>
                  <select
                    name="transaction_type"
                    value={editData.transaction_type || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="VENTA">Venta</option>
                    <option value="GASTO">Gasto</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
                  <select
                    name="status"
                    value={editData.status || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PAGADO">Pagado</option>
                    <option value="VENCIDO">Vencido</option>
                    <option value="ANULADO">Anulado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Factura</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={editData.invoice_number || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                  <input
                    type="text"
                    name="description"
                    value={editData.description || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                  <select
                    name="id_client_company"
                    value={editData.id_client_company || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="">Sin cliente</option>
                    {clientCompanies.map(c => (
                      <option key={c.id_client_company} value={c.id_client_company}>
                        {c.name_company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cotización Relacionada</label>
                  <select
                    name="id_related_quote"
                    value={editData.id_related_quote || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="">Sin cotización</option>
                    {quotes.map(q => (
                      <option key={q.id_cotizacion} value={q.id_cotizacion}>
                        {q.nombre_cotizacion || q.formatted_no_cotizacion || q.no_cotizacion}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtotal</label>
                  <input
                    type="number"
                    name="subtotal"
                    value={editData.subtotal || 0}
                    onChange={handleEditInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IVA (%)</label>
                  <input
                    type="number"
                    name="tax_amount"
                    value={editData.tax_amount || 0}
                    onChange={handleEditInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    name="invoice_date"
                    value={editData.invoice_date?.split('T')[0] || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    name="due_date"
                    value={editData.due_date?.split('T')[0] || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Pagado</label>
                  <input
                    type="number"
                    name="paid_amount"
                    value={editData.paid_amount || 0}
                    onChange={handleEditInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo Pendiente</label>
                  <input
                    type="number"
                    name="balance_due"
                    value={editData.balance_due || 0}
                    onChange={handleEditInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Días de Crédito</label>
                  <input
                    type="number"
                    name="credit_days"
                    value={editData.credit_days || 0}
                    onChange={handleEditInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Retención</label>
                  <input
                    type="number"
                    name="retention_value"
                    value={editData.retention_value || 0}
                    onChange={handleEditInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_urgent"
                  checked={editData.is_urgent || false}
                  onChange={(e) => setEditData(prev => prev ? { ...prev, is_urgent: e.target.checked } : null)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <label className="text-sm font-semibold text-slate-700">Marcar como urgente</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={processing}
                className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={processing}
                className="px-5 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg disabled:opacity-60 flex items-center"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-save mr-2"></i>}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Agregar Abono</h2>
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentAmount(0);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Saldo pendiente</label>
                <div className="text-3xl font-bold text-slate-800">
                  ${parseFloat((transaction?.balance_due || transaction?.balance) as any || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Monto a abonar</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-lg"
                />
              </div>
              {paymentAmount > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-slate-600">Saldo después del abono:</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${parseFloat(((transaction?.balance_due || transaction?.balance || 0) as any - paymentAmount).toString()).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentAmount(0);
                }}
                disabled={processing}
                className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPayment}
                disabled={processing || paymentAmount <= 0}
                className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-lg disabled:opacity-60 flex items-center"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                Registrar abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDetail;

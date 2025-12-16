import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import type { FinancialTransaction, ClientCompany, Quote } from '../types';

const FinancialsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Partial<FinancialTransaction> | null>(null);
  
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

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    transactionType: '',
    clientCompany: '',
    searchTerm: '',
  });

  // Dropdowns
  const [dropdownStates, setDropdownStates] = useState({
    status: false,
    transactionType: false,
    clientCompany: false,
  });
  const leaveTimeoutRef = useRef<number | null>(null);

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

  // Fetch data
  useEffect(() => {
    if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) return;
    fetchTransactions();
    fetchClientCompanies();
    fetchQuotes();
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://service.computeksa.com/webhook/api/financials?id_tenant=${user?.id_tenant}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al cargar transacciones');
      const data = await response.json();
      console.log('Financials API Response:', data);
      console.log('Transactions array:', data.transactions || data);
      
      // Si la respuesta es directamente un array, usarlo; sino buscar data.transactions
      const transactionsArray = Array.isArray(data) ? data : (data.transactions || []);
      console.log('Setting transactions:', transactionsArray);
      setTransactions(transactionsArray);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setToast({ message: 'Error al cargar transacciones financieras', type: 'error' });
    } finally {
      setLoading(false);
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

  const fetchQuotes = async () => {
    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/quote?id_tenant=${user?.id_tenant}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Error al cargar cotizaciones');
      const data = await response.json();
      setQuotes(data.quotes || []);
    } catch (error) {
      console.error(error);
    }
  };

  // Create/Update
  const handleSave = async () => {
    if (!editingTransaction) return;

    // Validación
    if (!editingTransaction.transaction_type || !editingTransaction.status || !editingTransaction.invoice_number?.trim() || !editingTransaction.id_client_company) {
      setToast({ message: 'Complete los campos requeridos: Tipo, Estado, Número de Factura y Cliente', type: 'error' });
      return;
    }

    try {
      const isNew = !editingTransaction.id_transaction;
      const endpoint = isNew ? 'https://service.computeksa.com/webhook/api/financials' : 'https://service.computeksa.com/webhook/api/financials/update';
      
      // Asegurar formato DATE (YYYY-MM-DD) para las fechas
      const payload = {
        ...editingTransaction,
        id_tenant: user?.id_tenant,
        created_by: isNew ? user?.id_user : editingTransaction.created_by,
        invoice_date: editingTransaction.invoice_date || null,
        issue_date: editingTransaction.issue_date || editingTransaction.invoice_date || null,
        // due_date se calcula automáticamente en la BD (invoice_date + credit_days), no enviar
        payment_date: editingTransaction.payment_date || null,
        retention_date: editingTransaction.retention_date || null,
        // Convertir valores numéricos
        subtotal: parseFloat(editingTransaction.subtotal as any) || 0,
        tax_amount: parseFloat(editingTransaction.tax_amount as any) || 0,
        total_value: parseFloat(editingTransaction.total_value as any) || 0,
        paid_amount: parseFloat(editingTransaction.paid_amount as any) || 0,
        retention_value: parseFloat(editingTransaction.retention_value as any) || 0,
        credit_days: parseInt(editingTransaction.credit_days as any) || 0,
        has_retention: editingTransaction.has_retention || false,
      };
      
      // Eliminar due_date del payload ya que la BD lo calcula automáticamente
      delete payload.due_date;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar');
      
      setToast({ message: `Transacción ${isNew ? 'creada' : 'actualizada'} correctamente`, type: 'success' });
      setIsModalOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al guardar la transacción', type: 'error' });
    }
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

  const openSaveConfirm = () => {
    setConfirmState({
      isOpen: true,
      title: '¿Guardar transacción?',
      message: 'Se guardarán los cambios realizados.',
      onConfirm: () => {
        handleSave();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ESC handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmState.isOpen) {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        } else if (isModalOpen) {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, confirmState.isOpen]);

  // Filter logic
  const filteredTransactions = transactions.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.transactionType && t.transaction_type !== filters.transactionType) return false;
    if (filters.clientCompany && t.id_client_company !== filters.clientCompany) return false;
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      if (
        !t.invoice_number?.toLowerCase().includes(term) &&
        !t.description?.toLowerCase().includes(term) &&
        !(t.client_name || t.client_company_name)?.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

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
  };

  const hasActiveFilters = filters.status || filters.transactionType || filters.clientCompany || filters.searchTerm;

  // New transaction template
  const createNewTransaction = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE',
      invoice_number: '',
      description: '',
      invoice_date: today,
      issue_date: today,
      credit_days: 0,
      due_date: today,
      subtotal: 0,
      tax_amount: 15, // IVA inicial 15%
      total_value: 0,
      paid_amount: 0,
      is_urgent: false,
      has_retention: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (transaction: FinancialTransaction) => {
    setEditingTransaction({ ...transaction });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setEditingTransaction(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      // Autocalcular total cuando cambien subtotal o tax_amount (IVA%)
      if (name === 'subtotal' || name === 'tax_amount') {
        const subtotal = parseFloat(name === 'subtotal' ? value : (prev.subtotal as any)) || 0;
        const taxPercent = parseFloat(name === 'tax_amount' ? value : (prev.tax_amount as any)) || 0;
        const taxAmount = subtotal * (taxPercent / 100);
        updated.total_value = subtotal + taxAmount;
      }

      // Autocalcular due_date cuando cambien invoice_date o credit_days
      if (name === 'invoice_date' || name === 'credit_days') {
        const invoiceDate = name === 'invoice_date' ? value : (prev.invoice_date || '');
        const creditDays = parseInt(name === 'credit_days' ? value : (prev.credit_days as any)) || 0;
        
        if (invoiceDate) {
          const date = new Date(invoiceDate);
          date.setDate(date.getDate() + creditDays);
          updated.due_date = date.toISOString().split('T')[0];
        }
      }

      return updated;
    });
  };

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
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

          {/* Status dropdown */}
          <div
            className="relative"
            onMouseLeave={() => handleMouseLeave('status')}
            onMouseEnter={handleMouseEnter}
          >
            <button
              onClick={() => setDropdownStates(prev => ({ ...prev, status: !prev.status }))}
              className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <i className="fa-solid fa-circle-dot"></i>
              Estado {filters.status && `(${filters.status})`}
              <i className="fa-solid fa-chevron-down text-xs"></i>
            </button>
            {dropdownStates.status && (
              <div className="absolute top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-10 w-48">
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, status: '' }));
                    setDropdownStates(prev => ({ ...prev, status: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm"
                >
                  Todos
                </button>
                {['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, status: s }));
                      setDropdownStates(prev => ({ ...prev, status: false }));
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    {getStatusBadge(s)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type dropdown */}
          <div
            className="relative"
            onMouseLeave={() => handleMouseLeave('transactionType')}
            onMouseEnter={handleMouseEnter}
          >
            <button
              onClick={() => setDropdownStates(prev => ({ ...prev, transactionType: !prev.transactionType }))}
              className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <i className="fa-solid fa-tag"></i>
              Tipo {filters.transactionType && `(${filters.transactionType})`}
              <i className="fa-solid fa-chevron-down text-xs"></i>
            </button>
            {dropdownStates.transactionType && (
              <div className="absolute top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-10 w-48">
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, transactionType: '' }));
                    setDropdownStates(prev => ({ ...prev, transactionType: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm"
                >
                  Todos
                </button>
                {['VENTA', 'GASTO', 'OTRO'].map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, transactionType: t }));
                      setDropdownStates(prev => ({ ...prev, transactionType: false }));
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    {getTypeBadge(t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Client Company dropdown */}
          <div
            className="relative"
            onMouseLeave={() => handleMouseLeave('clientCompany')}
            onMouseEnter={handleMouseEnter}
          >
            <button
              onClick={() => setDropdownStates(prev => ({ ...prev, clientCompany: !prev.clientCompany }))}
              className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <i className="fa-solid fa-building"></i>
              Cliente {filters.clientCompany && '(Seleccionado)'}
              <i className="fa-solid fa-chevron-down text-xs"></i>
            </button>
            {dropdownStates.clientCompany && (
              <div className="absolute top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-10 w-64 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, clientCompany: '' }));
                    setDropdownStates(prev => ({ ...prev, clientCompany: false }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm"
                >
                  Todos
                </button>
                {clientCompanies.map(c => (
                  <button
                    key={c.id_client_company}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, clientCompany: c.id_client_company }));
                      setDropdownStates(prev => ({ ...prev, clientCompany: false }));
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg text-sm"
                  >
                    {c.name_company}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-600">
        {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transacción' : 'transacciones'}
        {hasActiveFilters && ' (filtradas)'}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <i className="fa-solid fa-inbox text-4xl mb-2 block text-slate-300"></i>
                    No hay transacciones que mostrar
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(transaction => (
                  <tr key={transaction.id_transaction} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-slate-800">{transaction.invoice_number}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{transaction.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-700">{transaction.client_name || transaction.client_company_name || '-'}</div>
                      {transaction.client_ruc && (
                        <div className="text-xs text-slate-500">{transaction.client_ruc}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(transaction.transaction_type)}</td>
                    <td className="px-4 py-3">{getStatusBadge(transaction.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{transaction.issue_date_fmt || transaction.issue_date || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{transaction.due_date_fmt || transaction.due_date || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                      ${parseFloat(transaction.total_value as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">
                      ${parseFloat(transaction.paid_amount as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 font-semibold">
                      ${parseFloat((transaction.balance_due || transaction.balance) as any || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(transaction)}
                          className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(transaction)}
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
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingTransaction && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 50000,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                {editingTransaction.id_transaction ? 'Editar Transacción' : 'Nueva Transacción'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransaction(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-times text-slate-500"></i>
              </button>
            </div>

            {/* Body */}
            <form className="overflow-y-auto p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Transacción *</label>
                    <select
                      name="transaction_type"
                      value={editingTransaction.transaction_type || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    >
                      <option value="">Seleccionar</option>
                      <option value="VENTA">Venta</option>
                      <option value="GASTO">Gasto</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Estado *</label>
                    <select
                      name="status"
                      value={editingTransaction.status || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    >
                      <option value="">Seleccionar</option>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="PAGADO">Pagado</option>
                      <option value="VENCIDO">Vencido</option>
                      <option value="ANULADO">Anulado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Factura *</label>
                    <input
                      type="text"
                      name="invoice_number"
                      value={editingTransaction.invoice_number || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente *</label>
                    <select
                      name="id_client_company"
                      value={editingTransaction.id_client_company || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    >
                      <option value="">Sin cliente</option>
                      {clientCompanies.length === 0 ? (
                        <option disabled>Cargando empresas...</option>
                      ) : (
                        clientCompanies.map(c => (
                          <option key={c.id_client_company} value={c.id_client_company}>
                            {c.name_company}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      {clientCompanies.length} empresas disponibles
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Cotización Relacionada</label>
                    <select
                      name="id_related_quote"
                      value={editingTransaction.id_related_quote || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Sin cotización</option>
                      {quotes.map(q => (
                        <option key={q.id_quote} value={q.id_quote}>
                          {q.quote_number} - {q.client_company_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                    <textarea
                      name="description"
                      value={editingTransaction.description || ''}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_urgent"
                      checked={editingTransaction.is_urgent || false}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <label className="text-sm font-semibold text-slate-700">Marcar como urgente</label>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Factura *</label>
                    <input
                      type="date"
                      name="invoice_date"
                      value={editingTransaction.invoice_date || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Días de Crédito</label>
                    <input
                      type="number"
                      name="credit_days"
                      value={editingTransaction.credit_days || 0}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Vencimiento (Autocalculado)</label>
                    <input
                      type="date"
                      name="due_date"
                      value={editingTransaction.due_date || ''}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Subtotal</label>
                    <input
                      type="number"
                      name="subtotal"
                      value={editingTransaction.subtotal || 0}
                      onChange={handleInputChange}
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">IVA (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="tax_amount"
                        value={editingTransaction.tax_amount || 0}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Total (Autocalculado)</label>
                    <input
                      type="number"
                      name="total_value"
                      value={editingTransaction.total_value || 0}
                      readOnly
                      step="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  {/* Campos de pago solo si estado es PAGADO */}
                  {editingTransaction.status === 'PAGADO' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Pago *</label>
                        <input
                          type="date"
                          name="payment_date"
                          value={editingTransaction.payment_date || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Monto Pagado *</label>
                        <input
                          type="number"
                          name="paid_amount"
                          value={editingTransaction.paid_amount || 0}
                          onChange={handleInputChange}
                          step="0.01"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Método de Pago</label>
                        <input
                          type="text"
                          name="payment_method"
                          value={editingTransaction.payment_method || ''}
                          onChange={handleInputChange}
                          placeholder="Ej: Transferencia, Efectivo"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Referencia de Pago</label>
                        <input
                          type="text"
                          name="payment_reference"
                          value={editingTransaction.payment_reference || ''}
                          onChange={handleInputChange}
                          placeholder="Número de referencia o comprobante"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Retention section */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    name="has_retention"
                    checked={editingTransaction.has_retention || false}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <label className="text-sm font-bold text-slate-700 uppercase">Tiene Retención</label>
                </div>

                {editingTransaction.has_retention && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Retención</label>
                      <input
                        type="text"
                        name="retention_number"
                        value={editingTransaction.retention_number || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Retención</label>
                      <input
                        type="date"
                        name="retention_date"
                        value={editingTransaction.retention_date || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Valor de Retención</label>
                      <input
                        type="number"
                        name="retention_value"
                        value={editingTransaction.retention_value || 0}
                        onChange={handleInputChange}
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
                <textarea
                  name="notes"
                  value={editingTransaction.notes || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Notas adicionales o comentarios internos"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransaction(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-100 font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={openSaveConfirm}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold"
              >
                Guardar Transacción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default FinancialsList;

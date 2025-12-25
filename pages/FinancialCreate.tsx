import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import type { ClientCompany, FinancialTransaction, Quote } from '../types';

const FinancialCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transaction, setTransaction] = useState<Partial<FinancialTransaction>>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const setDefaults = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({
      transaction_type: 'VENTA',
      status: 'PENDIENTE',
      invoice_number: '',
      description: '',
      issue_date: today,
      credit_days: 0,
      due_date: today,
      subtotal: 0,
      tax_amount: 15,
      total_value: 0,
      paid_amount: 0,
      retention_value: 0,
      is_urgent: false,
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      const [companiesRes, quotesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${user.id_tenant}&id_user=${user.id_user}`),
        fetch(`https://service.computeksa.com/webhook/api/quotes?id_user=${user.id_user}&id_tenant=${user.id_tenant}`),
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const text = await res.text();
          throw new Error(text || 'Error al cargar datos');
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const [companiesData, quotesData] = await Promise.all([
        parseResponse(companiesRes),
        parseResponse(quotesRes),
      ]);

      const normalizedCompanies = Array.isArray(companiesData)
        ? companiesData
        : (companiesData?.clients || companiesData?.companies || companiesData?.data || []);
      const normalizedQuotes = Array.isArray(quotesData)
        ? quotesData
        : (quotesData?.quotes || quotesData?.data || []);

      setClientCompanies(normalizedCompanies);
      setQuotes(normalizedQuotes);
      setDefaults();
    } catch (error: any) {
      console.error('Error fetching initial data for financials create:', error);
      setToast({ message: error?.message || 'No se pudo cargar la información inicial.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [setDefaults, user?.id_tenant, user?.id_user]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setTransaction(prev => {
      const updated: Partial<FinancialTransaction> = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      if (name === 'subtotal' || name === 'tax_amount') {
        const subtotal = parseFloat(name === 'subtotal' ? value : (prev.subtotal as any)) || 0;
        const taxPercent = parseFloat(name === 'tax_amount' ? value : (prev.tax_amount as any)) || 0;
        const taxAmount = subtotal * (taxPercent / 100);
        updated.total_value = subtotal + taxAmount;
      }

      if (name === 'issue_date' || name === 'credit_days') {
        const issueDate = name === 'issue_date' ? value : (prev.issue_date || '');
        const creditDays = parseInt(name === 'credit_days' ? value : (prev.credit_days as any)) || 0;
        if (issueDate) {
          const date = new Date(issueDate);
          date.setDate(date.getDate() + creditDays);
          updated.due_date = date.toISOString().split('T')[0];
        }
      }

      // Si el estado cambia a PAGADO, asignar paid_amount igual a total_value y fecha de pago a hoy
      if (name === 'status' && value === 'PAGADO') {
        const currentTotal = updated.total_value || prev.total_value || 0;
        updated.paid_amount = currentTotal;
        updated.payment_date = new Date().toISOString().split('T')[0];
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!transaction || !user) return;

    if (!transaction.transaction_type || !transaction.status || !transaction.invoice_number?.trim()) {
      setToast({ message: 'Complete los campos requeridos: Tipo, Estado y Número de Factura.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      // Si el estado es PAGADO, asegurar que paid_amount = total_value
      const finalPaidAmount = transaction.status === 'PAGADO' 
        ? parseFloat(transaction.total_value as any) || 0
        : parseFloat(transaction.paid_amount as any) || 0;

      const payload: any = {
        id_tenant: user.id_tenant,
        created_by: user.id_user,
        id_client_company: transaction.id_client_company || null,
        id_related_quote: transaction.id_related_quote || null,
        transaction_type: transaction.transaction_type,
        status: transaction.status,
        invoice_number: transaction.invoice_number,
        description: transaction.description || '',
        issue_date: transaction.issue_date || null,
        credit_days: parseInt(transaction.credit_days as any) || 0,
        due_date: transaction.due_date || null,
        payment_date: transaction.payment_date || null,
        subtotal: parseFloat(transaction.subtotal as any) || 0,
        tax_amount: parseFloat(transaction.tax_amount as any) || 0,
        total_value: parseFloat(transaction.total_value as any) || 0,
        retention_number: transaction.retention_number || null,
        retention_date: transaction.retention_date || null,
        retention_value: parseFloat(transaction.retention_value as any) || 0,
        paid_amount: finalPaidAmount,
        payment_method: transaction.payment_method || null,
        payment_reference: transaction.payment_reference || null,
        invoice_file_url: transaction.invoice_file_url || null,
        retention_file_url: transaction.retention_file_url || null,
        is_urgent: transaction.is_urgent || false,
        notes: transaction.notes || null,
      };

      const response = await fetch('https://service.computeksa.com/webhook/api/financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al crear la transacción.');

      setToast({ message: 'Transacción creada correctamente.', type: 'success' });
      setTimeout(() => navigate('/financials'), 800);
    } catch (error: any) {
      console.error('Error saving financial transaction:', error);
      setToast({ message: error?.message || 'No se pudo guardar la transacción.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.rol_user !== 'admin' && user.rol_user !== 'superadmin')) {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-all shadow-sm"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nueva Transacción</h1>
          <p className="text-sm text-slate-500">Use el formulario para registrar una factura, pago o gasto.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Transacción *</label>
                <select
                  name="transaction_type"
                  value={transaction.transaction_type || ''}
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
                  value={transaction.status || ''}
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
                  value={transaction.invoice_number || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente</label>
                <select
                  name="id_client_company"
                  value={transaction.id_client_company || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Sin cliente</option>
                  {clientCompanies.map(c => (
                    <option key={c.id_client_company} value={c.id_client_company}>
                      {c.name_company}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">{clientCompanies.length} empresas disponibles</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cotización Relacionada</label>
                <select
                  name="id_related_quote"
                  value={transaction.id_related_quote || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Sin cotización</option>
                  {quotes.map(q => (
                    <option key={q.id_cotizacion} value={q.id_cotizacion}>
                      {q.nombre_cotizacion || q.formatted_no_cotizacion || q.no_cotizacion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  name="description"
                  value={transaction.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_urgent"
                  checked={transaction.is_urgent || false}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <label className="text-sm font-semibold text-slate-700">Marcar como urgente</label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Emisión *</label>
                <input
                  type="date"
                  name="issue_date"
                  value={transaction.issue_date || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Fecha impresa en la factura (por defecto hoy)</p>
              </div>

              {transaction.status !== 'PAGADO' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Días de Crédito</label>
                  <input
                    type="number"
                    name="credit_days"
                    value={transaction.credit_days || 0}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              {transaction.status !== 'PAGADO' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Vencimiento (Autocalculado)</label>
                  <input
                    type="date"
                    name="due_date"
                    value={transaction.due_date || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Subtotal</label>
                <input
                  type="number"
                  name="subtotal"
                  value={transaction.subtotal || 0}
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
                    value={transaction.tax_amount || 0}
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
                  value={transaction.total_value || 0}
                  readOnly
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-600 cursor-not-allowed"
                />
              </div>

              {transaction.status === 'PAGADO' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Pago *</label>
                    <input
                      type="date"
                      name="payment_date"
                      value={transaction.payment_date || ''}
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
                      value={transaction.paid_amount || 0}
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
                      value={transaction.payment_method || ''}
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
                      value={transaction.payment_reference || ''}
                      onChange={handleInputChange}
                      placeholder="Número de referencia o comprobante"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="mb-3">
              <label className="block text-sm font-bold text-slate-700 uppercase mb-2">Retención (Opcional)</label>
              <p className="text-xs text-slate-500">Complete los campos solo si esta transacción tiene retención.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Retención</label>
                <input
                  type="text"
                  name="retention_number"
                  value={transaction.retention_number || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Retención</label>
                <input
                  type="date"
                  name="retention_date"
                  value={transaction.retention_date || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Valor de Retención</label>
                <input
                  type="number"
                  name="retention_value"
                  value={transaction.retention_value || 0}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
            <textarea
              name="notes"
              value={transaction.notes || ''}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Notas adicionales o comentarios internos"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => navigate('/financials')}
            className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-100 font-semibold text-slate-700"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar Transacción'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialCreate;

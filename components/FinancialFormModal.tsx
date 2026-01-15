import React, { useState, useEffect } from 'react';
import type { FinancialTransaction, ClientCompany, Quote } from '../types';

interface FinancialFormModalProps {
  isOpen: boolean;
  initialData?: Partial<FinancialTransaction>;
  clientCompanies: ClientCompany[];
  quotes: Quote[];
  onClose: () => void;
  onSave: (data: Partial<FinancialTransaction>) => Promise<void>;
  isProcessing?: boolean;
}

const FinancialFormModal: React.FC<FinancialFormModalProps> = ({
  isOpen,
  initialData,
  clientCompanies,
  quotes,
  onClose,
  onSave,
  isProcessing = false,
}) => {
  const [editData, setEditData] = useState<Partial<FinancialTransaction> | null>(initialData || null);

  useEffect(() => {
    if (isOpen && initialData) {
      setEditData(initialData);
    }
  }, [isOpen, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (!editData) return;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setEditData(prev => prev ? { ...prev, [name]: checked } : null);
    } else {
      setEditData(prev => prev ? { ...prev, [name]: value } : null);
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    try {
      await onSave(editData);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  if (!isOpen || !editData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Editar Transacción</h2>
          <button
            onClick={onClose}
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
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
              <input
                type="text"
                name="description"
                value={editData.description || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
              <select
                name="id_client_company"
                value={editData.id_client_company || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IVA (%)</label>
              <input
                type="number"
                name="tax_amount"
                value={editData.tax_amount || 0}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                name="due_date"
                value={editData.due_date?.split('T')[0] || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo Pendiente</label>
              <input
                type="number"
                name="balance_due"
                value={editData.balance_due || 0}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Retención</label>
              <input
                type="number"
                name="retention_value"
                value={editData.retention_value || 0}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_urgent"
              checked={editData.is_urgent || false}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label className="text-sm font-semibold text-slate-700">Marcar como urgente</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg disabled:opacity-60 flex items-center"
          >
            {isProcessing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-save mr-2"></i>}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialFormModal;

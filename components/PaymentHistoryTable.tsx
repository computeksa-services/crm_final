import React from 'react';
import type { PaymentRecord } from '../types';

interface PaymentHistoryTableProps {
  paymentHistory?: PaymentRecord[];
  onEdit?: (payment: PaymentRecord) => void;
}

const formatCurrency = (val: string | number | undefined) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getPaymentMethodColor = (method?: string) => {
  const m = (method || '').toUpperCase();
  if (m === 'TRANSFERENCIA') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700';
  if (m === 'EFECTIVO') return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700';
  if (m === 'CHEQUE') return 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700';
  if (m === 'TARJETA') return 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700';
  return 'bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600';
};

const getPaymentMethodIcon = (method?: string) => {
  const m = (method || '').toUpperCase();
  if (m === 'TRANSFERENCIA') return 'fa-bank';
  if (m === 'EFECTIVO') return 'fa-money-bill';
  if (m === 'CHEQUE') return 'fa-receipt';
  if (m === 'TARJETA') return 'fa-credit-card';
  return 'fa-circle';
};

export const PaymentHistoryTable: React.FC<PaymentHistoryTableProps> = ({ paymentHistory = [], onEdit }) => {
  if (!paymentHistory || paymentHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fa-solid fa-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No hay pagos registrados</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30">
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Fecha de Pago</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Monto</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Método</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Referencia</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Notas</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Registrado por</th>
            {onEdit && <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {paymentHistory.map((payment, idx) => (
            <tr key={payment.id || idx} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors group">
              <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{formatDate(payment.payment_date)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(payment.amount)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${getPaymentMethodColor(payment.payment_method)}`}>
                  <i className={`fa-solid ${getPaymentMethodIcon(payment.payment_method)} text-[10px]`}></i>
                  {payment.payment_method || 'Sin especificar'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono">{payment.reference || '-'}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate" title={payment.notes || ''}>{payment.notes || '-'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium text-xs">{payment.created_by_name || payment.created_by || '-'}</td>
              {onEdit && (
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onEdit(payment)}
                    className="text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    title="Editar abono"
                  >
                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentHistoryTable;

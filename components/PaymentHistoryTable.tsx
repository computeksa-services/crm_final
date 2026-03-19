import React from 'react';
import type { PaymentRecord } from '../types';

interface PaymentHistoryTableProps {
  paymentHistory?: PaymentRecord[];
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
  if (m === 'TRANSFERENCIA') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (m === 'EFECTIVO') return 'bg-green-50 text-green-700 border-green-200';
  if (m === 'CHEQUE') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (m === 'TARJETA') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

const getPaymentMethodIcon = (method?: string) => {
  const m = (method || '').toUpperCase();
  if (m === 'TRANSFERENCIA') return 'fa-bank';
  if (m === 'EFECTIVO') return 'fa-money-bill';
  if (m === 'CHEQUE') return 'fa-receipt';
  if (m === 'TARJETA') return 'fa-credit-card';
  return 'fa-circle';
};

export const PaymentHistoryTable: React.FC<PaymentHistoryTableProps> = ({ paymentHistory = [] }) => {
  if (!paymentHistory || paymentHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fa-solid fa-inbox text-4xl text-gray-300 mb-3 block"></i>
        <p className="text-sm font-semibold text-gray-700">No hay pagos registrados</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Fecha de Pago</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Monto</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Método</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Referencia</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Notas</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">Registrado por</th>
          </tr>
        </thead>
        <tbody>
          {paymentHistory.map((payment, idx) => (
            <tr key={payment.id || idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3 text-gray-900 font-medium">{formatDate(payment.payment_date)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 tabular-nums">{formatCurrency(payment.amount)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${getPaymentMethodColor(payment.payment_method)}`}>
                  <i className={`fa-solid ${getPaymentMethodIcon(payment.payment_method)} text-[10px]`}></i>
                  {payment.payment_method || 'Sin especificar'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs font-mono">{payment.reference || '-'}</td>
              <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={payment.notes || ''}>{payment.notes || '-'}</td>
              <td className="px-4 py-3 text-gray-700 font-medium text-xs">{payment.created_by_name || payment.created_by || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentHistoryTable;

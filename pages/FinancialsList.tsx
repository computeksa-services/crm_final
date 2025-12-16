import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Vista de estado de cartera. Visible solo para admin del tenant.
const FinancialsList: React.FC = () => {
  const { user } = useAuth();

  const mockItems = useMemo(
    () => [
      { id: 'fin-1', cliente: 'Acme Corp', monto: 12000, dias: 15, estado: 'Al día' },
      { id: 'fin-2', cliente: 'Globex', monto: 8600, dias: 45, estado: 'Vencido' },
      { id: 'fin-3', cliente: 'Initech', monto: 5400, dias: 5, estado: 'Al día' },
      { id: 'fin-4', cliente: 'Soylent', monto: 21000, dias: 70, estado: 'Cobranza' },
    ],
    []
  );

  const summary = useMemo(() => {
    const total = mockItems.reduce((acc, i) => acc + i.monto, 0);
    const vencido = mockItems.filter(i => i.estado !== 'Al día').reduce((acc, i) => acc + i.monto, 0);
    return { total, vencido, alDia: total - vencido };
  }, [mockItems]);

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-slate-600">Inicia sesión para ver esta sección.</div>
    );
  }

  if (user.rol_user !== 'admin') {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <div className="font-bold mb-1">Acceso restringido</div>
          <div>Esta vista de cartera solo está disponible para administradores del tenant.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Estado de Cartera</h1>
          <p className="text-slate-500 text-sm mt-1">Resumen de cuentas por cobrar del tenant.</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total cartera</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">${summary.total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Al día</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">${summary.alDia.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Vencido / Cobranza</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">${summary.vencido.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-center">Días</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-semibold text-slate-800">{item.cliente}</td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-slate-700">${item.monto.toLocaleString()}</td>
                  <td className="px-6 py-3 text-center text-sm text-slate-600">{item.dias} días</td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-lg border text-[13px]"
                      style={{
                        backgroundColor: `${item.estado === 'Al día' ? '#10b981' : '#f59e0b'}15`,
                        color: item.estado === 'Al día' ? '#0f9a6f' : '#b45309',
                        borderColor: `${item.estado === 'Al día' ? '#10b981' : '#f59e0b'}40`
                      }}
                    >
                      <i className={`fa-solid ${item.estado === 'Al día' ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-1.5`}></i>
                      {item.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialsList;



import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
// FIX: Removed non-existent QuoteStatus from imports. The status is a string.
import { Quote } from '../types';

const QuotesList: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    MockApi.getQuotes().then(data => {
      setQuotes(data);
      setLoading(false);
    });
  }, []);

  // FIX: Updated getStatusColor to handle string statuses based on application usage.
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return 'bg-gray-100 text-gray-700';
      case 'LISTO PARA ENVIAR': // As seen in QuoteDetail
        return 'bg-blue-100 text-blue-700';
      case 'ENVIADO':
      case 'APROBADO':
        return 'bg-green-100 text-green-700';
      case 'CAMBIOS PENDIENTES': // Equivalent for old PENDING_CHANGES
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
        <Link to="/quotes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Cotización
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando cotizaciones...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-100"># Cotización</th>
                  <th className="px-6 py-4 border-b border-slate-100">Cliente</th>
                  <th className="px-6 py-4 border-b border-slate-100">Nombre</th>
                  <th className="px-6 py-4 border-b border-slate-100">Fecha</th>
                  <th className="px-6 py-4 border-b border-slate-100">Estado</th>
                  <th className="px-6 py-4 border-b border-slate-100">Total</th>
                  <th className="px-6 py-4 border-b border-slate-100">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => (
                  <tr 
                    key={quote.id_cotizacion} 
                    onClick={() => handleRowClick(quote.id_cotizacion)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">#{quote.no_cotizacion}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{quote.client_company_name}</td>
                    <td className="px-6 py-4 text-slate-600">{quote.nombre_cotizacion}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{quote.fecha_emision}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(quote.estado)}`}>
                        {quote.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">${quote.total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="text-brand-600 font-medium text-sm group-hover:underline">
                        Ver Detalles <i className="fa-solid fa-arrow-right ml-1 text-xs"></i>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotesList;
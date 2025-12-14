import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar
import { Quote } from '../types';
import Toast from '../components/Toast';

const QuotesList: React.FC = () => {
  const { user } = useAuth(); // Usar
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return; // Comprobar también id_user
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const response = await fetch(`https://service.computeksa.com/webhook/api/quotes?id_tenant=${tenantId}&id_user=${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) setQuotes([]);
        else throw new Error('Error al cargar cotizaciones');
        return;
      }
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      setQuotes(data);

    } catch (e) {
      setToast({ message: 'Error al cargar las cotizaciones.', type: 'error' });
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BORRADOR': return 'bg-gray-100 text-gray-700';
      case 'ENVIADO': return 'bg-blue-100 text-blue-700';
      case 'APROBADO': return 'bg-green-100 text-green-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  const renderContent = () => {
    if (loading) {
      return <div className="p-8 text-center text-slate-500">Cargando cotizaciones...</div>;
    }
    if (error) {
      return <div className="p-8 text-center text-red-500">{error}</div>;
    }
    if (quotes.length === 0) {
      return <div className="p-8 text-center text-slate-500">No se encontraron cotizaciones. ¡Crea una nueva!</div>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4 border-b"># Cotización</th>
              <th className="px-6 py-4 border-b">Cliente</th>
              <th className="px-6 py-4 border-b">Nombre</th>
              <th className="px-6 py-4 border-b">Fecha</th>
              <th className="px-6 py-4 border-b">Estado</th>
              <th className="px-6 py-4 border-b">Total</th>
              <th className="px-6 py-4 border-b">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote, index) => {
              try {
                // INTENTAMOS RENDERIZAR LA FILA
                return (
                  <tr 
                    key={quote.id_cotizacion || index} 
                    onClick={() => handleRowClick(quote.id_cotizacion)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">#{quote.formatted_no_cotizacion || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{quote.client_company_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-600">{quote.nombre_cotizacion || 'Sin Nombre'}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{quote.fecha_emision ? new Date(quote.fecha_emision).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(quote.estado || '')}`}>
                        {quote.estado || 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{quote.total}</td>
                    <td className="px-6 py-4">
                      <span className="text-brand-600 font-medium text-sm group-hover:underline">
                        Ver Detalles <i className="fa-solid fa-arrow-right ml-1 text-xs"></i>
                      </span>
                    </td>
                  </tr>
                );
              } catch (e) {
                // SI FALLA, LO REPORTAMOS EN CONSOLA Y CONTINUAMOS
                console.error("Error al renderizar la fila de cotización. Datos problemáticos:", quote, e);
                return null; // No renderizar esta fila para evitar que la página se rompa
              }
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
        <Link to="/quotes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Cotización
        </Link>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default QuotesList;
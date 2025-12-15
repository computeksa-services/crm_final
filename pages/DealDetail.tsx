import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, Quote, DealStatus, DealInterest, ClientCompany, ClientContact, User } from '../types';
import Toast from '../components/Toast'; // Asumimos que tienes un Toast genérico

type Tab = 'quotes' | 'permissions' | 'activity';

const DealDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('quotes');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // Cargar todos los datos en paralelo
      const [dealRes, quotesRes, usersRes, companiesRes, contactsRes, dealStatusesRes, interestRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/deals/detail?id_trato=${id}&id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`/api/quotes?id_tenant=${tenantId}&id_user=${userId}&id_trato=${id}`), // Filtrar cotizaciones por trato
        fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/deals?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/statuses/interests?id_tenant=${tenantId}&id_user=${userId}`),
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return null; // Para detalle
          const errorText = await res.text();
          throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      };

      // Parsear respuestas - el backend ya envía datos enriquecidos
      const rawDealData = await parseResponse(dealRes);
      const allQuotesData = await parseResponse(quotesRes) || [];

      let processedDeal: Deal | null = null;
      if (rawDealData) {
        // Manejar si la API de detalle devuelve un array o un objeto directo
        processedDeal = Array.isArray(rawDealData) ? rawDealData[0] : rawDealData;
      }
      
      setDeal(processedDeal);
      setQuotes(allQuotesData.filter((q: Quote) => q.id_trato === id)); // Filtrar si la API no lo hizo
      // setPermissions(perms); // No hay API de permisos aún

    } catch (e: any) {
      console.error("Error fetching deal details:", e);
      setToast({ message: e.message || 'Error al cargar los detalles del trato.', type: 'error' });
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles del trato...</div>;
  if (!deal) return <div className="p-8 text-center text-red-500">Trato no encontrado.</div>;

  const TabButton: React.FC<{tab: Tab, label: string, icon: string}> = ({tab, label, icon}) => (
      <button 
          onClick={() => setActiveTab(tab)}
          className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab 
              ? 'bg-brand-50 text-brand-700' 
              : 'text-slate-500 hover:bg-slate-100'
          }`}
      >
          <i className={`fa-solid ${icon} mr-2 w-4`}></i> {label}
      </button>
  );

  return (
    <div className="space-y-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <button onClick={() => navigate('/deals')} className="text-slate-400 hover:text-slate-600">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">{deal.nombre_trato}</h1>
          </div>
          <p className="text-slate-500 ml-7">
            Para <Link to={`/client-companies/${deal.id_client_company}`} className="text-brand-600 font-medium hover:underline">{deal.client_company_name}</Link>
          </p>
        </div>
        <div className="text-right">
            <p className="text-3xl font-bold text-slate-800">{deal.valor_trato}</p>
            <span className={`px-2 py-1 rounded-full text-xs font-bold`} style={{ backgroundColor: `${deal.estado_color || '#cccccc'}20`, color: deal.estado_color }}>{deal.estado_nombre}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detalles Clave</h3>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Propietario:</span>
                    <span className="font-medium text-slate-800">{deal.owner_name}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Contacto Principal:</span>
                    <Link to={`/client-contacts/${deal.id_contact}`} className="font-medium text-brand-600 hover:underline">{deal.contact_full_name}</Link>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Fecha Creación:</span>
                    <span className="font-medium text-slate-800">{deal.created_at_fmt || (deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '-')}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Interés:</span>
                    <span 
                      className="font-medium text-slate-800 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit"
                      style={{ backgroundColor: `${deal.interes_color || '#cccccc'}20`, color: deal.interes_color }}
                    >
                      {deal.interes_icon && <i className={`${deal.interes_icon} mr-1.5`}></i>}
                      {deal.interes_nombre || 'N/A'}
                    </span>
                </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            {/* Tab Navigation */}
            <div className="p-2 border-b border-slate-200 bg-slate-50/50 flex space-x-2">
                <TabButton tab="quotes" label="Cotizaciones" icon="fa-file-invoice-dollar" />
                <TabButton tab="permissions" label="Permisos" icon="fa-user-lock" />
                <TabButton tab="activity" label="Actividad" icon="fa-chart-line" />
            </div>

            {/* Tab Content */}
            <div className="p-6 min-h-[300px]">
                {activeTab === 'quotes' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700">Cotizaciones Vinculadas</h4>
                            <button 
                              onClick={() => navigate(`/quotes/new?dealId=${deal.id_trato}&clientCompanyId=${deal.id_client_company}&contactId=${deal.id_contact}&dealName=${encodeURIComponent(deal.nombre_trato || '')}`)}
                              className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded shadow-sm font-medium">
                                <i className="fa-solid fa-plus mr-1"></i> Nueva Cotización
                            </button>
                        </div>
                        {quotes.length > 0 ? (
                            <ul className="divide-y divide-slate-100">
                                {quotes.map(q => (
                                    <li key={q.id_cotizacion} className="py-2 flex justify-between items-center">
                                        <Link to={`/quotes/${q.id_cotizacion}`} className="hover:text-brand-600">{q.nombre_cotizacion} (v{q.version})</Link>
                                        <span className="text-slate-500 text-xs">{q.estado}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-400 text-sm italic">No hay cotizaciones para este trato.</p>
                        )}
                    </div>
                )}
                {activeTab === 'permissions' && (
                    <div>
                         <h4 className="font-bold text-slate-700 mb-4">Control de Acceso</h4>
                         <p className="text-slate-400 text-sm italic">Funcionalidad de permisos próximamente.</p>
                    </div>
                )}
                {activeTab === 'activity' && (
                    <div>
                        <h4 className="font-bold text-slate-700 mb-4">Historial de Actividad</h4>
                        <p className="text-slate-400 text-sm italic">Historial de cambios y comunicaciones próximamente.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealDetail;

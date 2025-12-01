
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { Deal, Quote, DealPermission, User } from '../types';

type Tab = 'quotes' | 'permissions' | 'activity';

const DealDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [permissions, setPermissions] = useState<DealPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('quotes');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dealData, allQuotes, allUsers] = await Promise.all([
        MockApi.getDealById(id),
        MockApi.getQuotes(), // Assuming this fetches all quotes for now
        MockApi.getUsers(),
      ]);
      
      if (!dealData) {
        setDeal(null);
      } else {
        const companyData = await MockApi.getClientCompanyById(dealData.id_client_company);
        const contactData = await MockApi.getClientContactById(dealData.id_contact);
        const ownerData = allUsers.find(u => u.id_user === dealData.id_user_owner);
        
        setDeal({
            ...dealData,
            client_company_name: companyData?.name_company,
            contact_name: `${contactData?.first_name || ''} ${contactData?.last_name || ''}`,
            owner_name: ownerData?.name_user,
        });
        
        setQuotes(allQuotes.filter(q => q.id_trato === id));
        // Mock permissions for now
        // const perms = await MockApi.getDealPermissions(id);
        // setPermissions(perms);
        setUsers(allUsers);
      }
    } catch (e) {
      console.error("Error fetching deal details:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
            <p className="text-3xl font-bold text-slate-800">${deal.valor_trato.toLocaleString('es-EC')}</p>
            <span className={`px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800`}>{deal.estado}</span>
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
                    <Link to={`/client-contacts/${deal.id_contact}`} className="font-medium text-brand-600 hover:underline">{deal.contact_name}</Link>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Fecha Creación:</span>
                    <span className="font-medium text-slate-800">{new Date(deal.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-500">Interés:</span>
                    <span className="font-medium text-slate-800">{deal.interes || 'N/A'}</span>
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
                            <button className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded shadow-sm font-medium">
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

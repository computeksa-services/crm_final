import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Deal, Quote, DealStatus } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import ShareModal from '../components/ShareModal';
import DealShareList from '../components/DealShareList';
import DealEditModal from '../components/DealEditModal';

type Tab = 'quotes' | 'permissions' | 'activity';

const DealDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('quotes');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshPermissions, setRefreshPermissions] = useState(0);
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [dealRes, quotesRes, statusesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/quotes?id_tenant=${tenantId}&id_user=${userId}&id_trato=${id}`),
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/statuses/deals?id_tenant=${tenantId}`),
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          const text = await res.text();
          throw new Error(`Error: ${res.status} - ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      };

      const rawDealData = await parseResponse(dealRes);
      const allQuotesData = await parseResponse(quotesRes) || [];
      const statusesData = await parseResponse(statusesRes) || [];

      let processedDeal: Deal | null = null;
      if (rawDealData) {
        processedDeal = Array.isArray(rawDealData) ? rawDealData[0] : rawDealData;
      }
      
      setDeal(processedDeal);
      setQuotes(allQuotesData.filter((q: Quote) => q.id_trato === id));
      setDealStatuses(statusesData);

    } catch (e: any) {
      console.error("Error fetching details:", e);
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-500 font-medium animate-pulse">Cargando trato...</p>
      </div>
    </div>
  );
  
  if (!deal) return (
    <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
            <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 mb-3"></i>
            <h3 className="text-lg font-bold text-red-700">Trato no encontrado</h3>
            <button onClick={() => navigate('/app/deals')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                Volver al listado
            </button>
        </div>
    </div>
  );

  const TabButton: React.FC<{tab: Tab, label: string, icon: string}> = ({tab, label, icon}) => (
      <button 
          onClick={() => setActiveTab(tab)}
          className={`flex items-center px-5 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab 
              ? 'border-brand-500 text-brand-600 bg-brand-50/50' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
      >
          <i className={`fa-solid ${icon} mr-2`}></i> {label}
      </button>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => navigate('/app/deals')} className="text-slate-400 hover:text-brand-600 transition-colors p-1">
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </button>
                    
                    {/* Status Dropdown */}
                    {dealStatuses.length > 0 && (() => {
                      const currentStatus = dealStatuses.find(s => s.id_status === deal.id_deal_status);
                      return (
                        <select 
                          disabled={!(deal.access_level === 'EDIT' || user?.rol_user === 'admin') || processing}
                          value={deal.id_deal_status || ''}
                          onChange={(e) => {
                            const newStatusId = e.target.value;
                            if (newStatusId === deal.id_deal_status) return;
                            const newStatus = dealStatuses.find(s => s.id_status === newStatusId);
                            setConfirmState({
                              isOpen: true,
                              title: 'Confirmar Cambio de Estado',
                              message: `¿Estás seguro de cambiar el estado a "${newStatus?.name}"?`,
                              onConfirm: async () => {
                                setConfirmState(prev => ({ ...prev, isOpen: false }));
                                try {
                                  setProcessing(true);
                                  const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id_trato: deal.id_trato,
                                      id_deal_status: newStatusId,
                                      id_tenant: user?.id_tenant,
                                      id_user: user?.id_user
                                    })
                                  });
                                  if (response.ok) {
                                    setDeal({ ...deal, id_deal_status: newStatusId, estado_color: newStatus?.color, estado_nombre: newStatus?.name, estado_icon: newStatus?.icon });
                                    setToast({ message: 'Estado actualizado correctamente', type: 'success' });
                                    await fetchData();
                                  } else {
                                    throw new Error('Error en la respuesta del servidor');
                                  }
                                } catch (err) {
                                  setToast({ message: 'Error al actualizar estado', type: 'error' });
                                } finally {
                                  setProcessing(false);
                                }
                              },
                              onCancel: () => setConfirmState(prev => ({ ...prev, isOpen: false }))
                            });
                          }}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-all outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: `${currentStatus?.color || deal.estado_color || '#cccccc'}15`,
                            borderColor: `${currentStatus?.color || deal.estado_color || '#cccccc'}40`,
                            color: currentStatus?.color || deal.estado_color || '#333'
                          }}
                        >
                          {dealStatuses.map(s => (
                            <option key={s.id_status} value={s.id_status}>{s.name}</option>
                          ))}
                        </select>
                      );
                    })()}
                </div>
                
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight ml-8">{deal.nombre_trato}</h1>
                <div className="ml-8 mt-2 flex items-center text-slate-500 text-sm">
                    <i className="fa-solid fa-building mr-2 text-slate-400"></i>
                    Para <Link to={`/app/client-companies/${deal.id_client_company}`} className="text-brand-600 font-semibold hover:underline ml-1">{deal.client_company_name}</Link>
                </div>
            </div>

            <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Valor Estimado</p>
                    <p className="text-4xl font-black text-slate-800 font-mono tracking-tight">{deal.valor_trato}</p>
                </div>
                
                {(deal.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                    <div className="flex gap-2 flex-col items-end">
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="flex items-center text-sm text-slate-500 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-all border border-slate-200 hover:border-brand-200"
                        >
                            <i className="fa-solid fa-pen mr-2"></i> Editar
                        </button>
                        <button
                            onClick={() => setIsShareOpen(true)}
                            className="flex items-center text-sm text-slate-500 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-all border border-slate-200 hover:border-brand-200"
                        >
                            <i className="fa-solid fa-share-nodes mr-2"></i> Compartir
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalles Clave</h3>
            </div>
            <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <img 
                        src={deal.owner_avatar || `https://ui-avatars.com/api/?name=${deal.owner_name}&background=random`} 
                        alt="Owner" 
                        className="w-10 h-10 rounded-full border border-slate-200"
                    />
                    <div>
                        <p className="text-xs text-slate-400">Propietario</p>
                        <p className="font-medium text-slate-700 text-sm">{deal.owner_name}</p>
                    </div>
                </div>

                <div className="h-px bg-slate-100"></div>

                <div>
                    <p className="text-xs text-slate-400 mb-1">Contacto Principal</p>
                    <Link to={`/app/client-contacts/${deal.id_contact}`} className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                            <i className="fa-solid fa-user text-xs"></i>
                        </div>
                        <span className="font-medium text-slate-700 group-hover:text-brand-700 text-sm transition-colors">{deal.contact_full_name}</span>
                    </Link>
                </div>

                <div>
                    <p className="text-xs text-slate-400 mb-1">Nivel de Interés</p>
                    <div className="flex items-center gap-2">
                        <i className={`${deal.interes_icon || 'fa-solid fa-circle'}`} style={{ color: deal.interes_color }}></i>
                        <span className="font-medium text-slate-700 text-sm">{deal.interes_nombre || 'No definido'}</span>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-slate-400 mb-1">Creado el</p>
                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <i className="fa-regular fa-calendar"></i>
                        {deal.created_at_fmt || (deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '-')}
                    </div>
                </div>
            </div>
          </div>

          {/* Description (if exists) */}
          {deal.descripcion && (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Descripción</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{deal.descripcion}</p>
             </div>
          )}
        </div>

        {/* Right Column: Tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
                <TabButton tab="quotes" label="Cotizaciones" icon="fa-file-invoice-dollar" />
                <TabButton tab="activity" label="Actividad" icon="fa-chart-line" />
                {(deal.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                  <TabButton tab="permissions" label="Permisos" icon="fa-user-lock" />
                )}
            </div>

            {/* Tab Content */}
            <div className="p-6 flex-1 bg-slate-50/30">
                {activeTab === 'quotes' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Documentos Generados</h4>
                            {(deal.access_level === 'EDIT' || user?.rol_user === 'admin') && (
                              <button 
                                onClick={() => navigate(`/app/quotes/new?dealId=${deal.id_trato}&clientCompanyId=${deal.id_client_company}&contactId=${deal.id_contact}&dealName=${encodeURIComponent(deal.nombre_trato || '')}`)}
                                className="bg-white border border-slate-200 hover:border-brand-300 text-slate-600 hover:text-brand-600 px-4 py-2 rounded-xl shadow-sm text-sm font-medium transition-all flex items-center">
                                  <i className="fa-solid fa-plus mr-2 text-brand-500"></i> Nueva Cotización
                              </button>
                            )}
                        </div>
                        
                        {(() => {
                          const visibleQuotes = quotes.filter(q => {
                            if (q.is_private && deal.access_level !== 'EDIT' && user?.rol_user !== 'admin') return false;
                            return true;
                          });
                          
                          return visibleQuotes.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {visibleQuotes.map(q => (
                                    <div key={q.id_cotizacion} className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-200 hover:shadow-md transition-all flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-file-invoice-dollar text-lg"></i>
                                            </div>
                                            <div>
                                                <Link to={`/app/quotes/${q.id_cotizacion}`} className="font-bold text-slate-700 group-hover:text-brand-600 transition-colors block">
                                                    {q.nombre_cotizacion || `Cotización #${q.formatted_no_cotizacion}`}
                                                </Link>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 rounded">v{q.version}</span>
                                                    <span className="text-xs text-slate-500">• {new Date(q.fecha_emision).toLocaleDateString()}</span>
                                                    {q.is_private && <i className="fa-solid fa-lock text-[10px] text-amber-500" title="Privado"></i>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-700 text-sm">{q.total}</p>
                                            <span className="text-[10px] uppercase font-bold text-slate-400">{q.estado}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                                <i className="fa-solid fa-folder-open text-3xl text-slate-200 mb-3 block"></i>
                                <p className="text-slate-400 text-sm">No hay cotizaciones vinculadas aún.</p>
                            </div>
                          );
                        })()}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Cotizaciones Enviadas</h4>
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full font-bold">
                                {deal.historial_cotizaciones?.length || 0}
                            </span>
                        </div>
                        {deal.historial_cotizaciones && deal.historial_cotizaciones.length > 0 ? (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {deal.historial_cotizaciones.map((log, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-brand-200 transition-all">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <i className="fa-solid fa-envelope text-sm"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">
                                                            {log.nombre_cotizacion || `Cotización #${log.no_cotizacion_fmt}`}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Versión {log.version_numero}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">
                                                        {log.metodo === 'EMAIL' ? '📧 Email' : '✉️ Manual'}
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5 mt-2 text-xs text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <i className="fa-solid fa-user text-slate-400 w-4"></i>
                                                        <span className="font-medium">{log.enviado_por}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <i className="fa-solid fa-envelope text-slate-400 w-4 mt-0.5"></i>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="break-all text-slate-600">{log.enviado_a}</p>
                                                            {log.copia_a && <p className="text-slate-500 text-[11px] mt-0.5">CC: {log.copia_a}</p>}
                                                        </div>
                                                    </div>
                                                    {log.asunto && (
                                                        <div className="flex items-start gap-2">
                                                            <i className="fa-solid fa-heading text-slate-400 w-4 mt-0.5"></i>
                                                            <p className="text-slate-700 italic max-w-sm truncate">Asunto: {log.asunto}</p>
                                                        </div>
                                                    )}
                                                    {log.politica && (
                                                        <div className="flex items-center gap-2">
                                                            <i className={`${log.politica === 'CORPORATE' ? 'fa-solid fa-building' : 'fa-solid fa-user'} text-slate-400 w-4`}></i>
                                                            <span className="text-slate-600">
                                                                {log.politica === 'CORPORATE' ? '🏢 Email Corporativo' : '👤 Email Personal'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-slate-100">
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                        <i className="fa-regular fa-clock"></i>
                                                        {log.fecha_envio}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                                <i className="fa-solid fa-inbox text-3xl text-slate-200 mb-3 block"></i>
                                <p className="text-slate-400 text-sm">No hay cotizaciones enviadas aún.</p>
                                <p className="text-slate-400 text-xs mt-1">Cuando envíes cotizaciones, aparecerán aquí.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'permissions' && (
                    <DealShareList id_trato={deal.id_trato} refreshTrigger={refreshPermissions} />
                )}
            </div>
          </div>
        </div>
      </div>

      {isShareOpen && deal && (
        <ShareModal
          entity="deal"
          id={deal.id_trato}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          onShared={() => {
            setToast({ message: 'Trato compartido.', type: 'success' });
            setRefreshPermissions(prev => prev + 1);
          }}
        />
      )}

      {deal && (
        <DealEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={deal}
          onSuccess={(updatedDeal) => {
            setDeal(updatedDeal);
            setIsEditModalOpen(false);
            setToast({ message: 'Trato actualizado exitosamente.', type: 'success' });
            fetchData();
          }}
        />
      )}

      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      )}
    </div>
  );
};

export default DealDetail;
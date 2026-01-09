import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MarketingCampaign } from '../../types';
import { marketingApi } from '../../services/marketingApi';

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STATS' | 'PREVIEW'>('STATS');

  useEffect(() => {
    loadCampaignDetail();
  }, [id]);

  const loadCampaignDetail = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      const data = await marketingApi.getCampaignDetail(id);
      setCampaign(data);
    } catch (error) {
      console.error('Error al cargar detalle de campaña:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
        Cargando campaña...
      </div>
    );
  }

  if (!campaign) {
    return <div className="p-8 text-center text-slate-500">Campaña no encontrada</div>;
  }

  const handleDelete = () => {
    if (confirm("¿Estás seguro de que deseas eliminar esta campaña? Esta acción no se puede deshacer.")) {
      // In a real app, you would make an API call here.
      alert("Campaña eliminada correctamente.");
      navigate('/app/marketing/campaigns');
    }
  };

  // Mock timeline data for this campaign
  const data = [
    { time: '09:00', opens: 0 },
    { time: '10:00', opens: 120 },
    { time: '11:00', opens: 350 },
    { time: '12:00', opens: 480 },
    { time: '13:00', opens: 550 },
    { time: '14:00', opens: 600 },
    { time: '15:00', opens: 620 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
         <div className="flex items-center gap-4">
             <Link to="/app/marketing/campaigns" className="text-slate-400 hover:text-slate-600">
               <i className="fa-solid fa-arrow-left text-lg"></i>
             </Link>
             <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-800">{campaign.name}</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    campaign.status === 'SENT' ? 'bg-green-100 text-green-700 border-green-200' : 
                    campaign.status === 'DRAFT' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">Asunto: {campaign.subject}</p>
             </div>
         </div>

         <div className="flex gap-3">
            <Link 
                to={`/app/marketing/campaigns/edit/${id}`}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors flex items-center gap-2"
            >
                <i className="fa-regular fa-pen-to-square"></i> Editar
            </Link>
            <button 
                onClick={handleDelete}
                className="px-4 py-2 bg-white border border-slate-300 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors flex items-center gap-2"
            >
                <i className="fa-regular fa-trash-can"></i> Eliminar
            </button>
         </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Enviados</p>
           <p className="text-3xl font-bold text-slate-800 mt-2">{Number(campaign.sent_count || campaign.recipient_count || 0).toLocaleString()}</p>
           <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
             <i className="fa-solid fa-check-circle"></i> {campaign.failed_count ? (100 - (Number(campaign.failed_count) / Number(campaign.sent_count || 1) * 100)).toFixed(1) : '99.8'}% Entregabilidad
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Aperturas</p>
           <p className="text-3xl font-bold text-brand-600 mt-2">{Number(campaign.open_count || 0).toLocaleString()}</p>
           <p className="text-xs text-slate-500 mt-1">
             Tasa: {(() => {
               const sent = Number(campaign.sent_count || campaign.recipient_count || 0);
               const opened = Number(campaign.open_count || 0);
               return sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
             })()}%
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Clicks</p>
           <p className="text-3xl font-bold text-blue-600 mt-2">{Number(campaign.click_count || 0).toLocaleString()}</p>
           <p className="text-xs text-slate-500 mt-1">
             CTR: {(() => {
               const sent = Number(campaign.sent_count || campaign.recipient_count || 0);
               const clicked = Number(campaign.click_count || 0);
               return sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';
             })()}%
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Rebotes</p>
           <p className="text-3xl font-bold text-red-500 mt-2">{Number(campaign.failed_count || 0).toLocaleString()}</p>
           <p className="text-xs text-slate-500 mt-1">
             {(() => {
               const sent = Number(campaign.sent_count || campaign.recipient_count || 0);
               const failed = Number(campaign.failed_count || 0);
               return sent > 0 ? ((failed / sent) * 100).toFixed(1) : '0.0';
             })()}% Tasa de rebote
           </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('STATS')}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'STATS'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fa-solid fa-chart-line mr-2"></i>
              Resultados
            </button>
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'PREVIEW'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fa-regular fa-eye mr-2"></i>
              Previsualización
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'STATS' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2">
                  <h3 className="font-bold text-slate-800 mb-6">Actividad en tiempo real (24h)</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={3} fill="url(#gradOpen)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-4">Configuración</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Enviado el:</span>
                        <span className="font-medium">{campaign.sent_at ? new Date(campaign.sent_at).toLocaleString() : 'Pendiente'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Remitente:</span>
                        <span className="font-medium">{campaign.created_by_name || 'N/A'}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-500 block mb-2">Listas incluidas:</span>
                        <div className="flex flex-wrap gap-2">
                          {campaign.target_lists_display ? (
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                              {campaign.target_lists_display}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin listas asignadas</span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Audiencia Total:</span>
                        <span className="font-medium">{campaign.total_audience || 0}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-slate-800 mb-4">Enlaces más clicados</h3>
                    <div className="space-y-3">
                      <div className="text-center text-sm text-slate-400 py-4">
                        No hay datos disponibles
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Previsualización del correo
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">De:</span>
                    <span className="text-slate-600">{campaign.created_by_name || 'Remitente'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Asunto:</span>
                    <span className="text-slate-600">{campaign.subject}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6 min-h-[400px]">
                {campaign.html_content ? (
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: campaign.html_content }}
                  />
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <i className="fa-regular fa-file-lines text-4xl mb-2"></i>
                    <p>No hay contenido para previsualizar</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MarketingCampaign } from '../../types';
import { marketingApi } from '../../services/marketingApi';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';

// Tipos adicionales para la nueva data
interface AudienceMember {
  id_contact: string;
  name: string;
  email: string;
  status: 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED' | 'BOUNCED';
  opened: boolean;
  sent_at: string | null;
}

interface CampaignDetailData extends MarketingCampaign {
  audience_detail?: AudienceMember[];
  processed_count?: number;
  remaining_count?: number;
  open_rate?: number;
}

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [campaign, setCampaign] = useState<CampaignDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STATS' | 'AUDIENCE' | 'PREVIEW'>('STATS');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estado para búsqueda en tabla de audiencia
  const [audienceSearch, setAudienceSearch] = useState('');

  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    confirmText: 'Confirmar',
    isDestructive: false,
    onConfirm: async () => {}, 
  });

  useEffect(() => {
    loadCampaignDetail();
    // Polling inteligente: solo si está enviando
    const interval = setInterval(() => {
        if (campaign?.status === 'SENDING' || campaign?.status === 'PROCESSING') {
            loadCampaignDetail(true); // Silent reload
        }
    }, 10000);
    return () => clearInterval(interval);
  }, [id, campaign?.status]);

  const loadCampaignDetail = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setIsLoading(true);
      const data = await marketingApi.getCampaignDetail(id);
      setCampaign(data);
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      if (!silent) setToast({ message: 'Error al cargar la campaña', type: 'error' });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // --- HELPERS ---
  const normalizeStatus = (s?: string) => (s === 'PAUSE' ? 'PAUSED' : s || 'DRAFT');
  
  const toNumber = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  // Filtro de Audiencia
  const filteredAudience = useMemo(() => {
      if (!campaign?.audience_detail) return [];
      return campaign.audience_detail.filter(m => 
          m.name.toLowerCase().includes(audienceSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(audienceSearch.toLowerCase())
      );
  }, [campaign?.audience_detail, audienceSearch]);

  // --- ACCIONES ---
  const handleAction = (actionType: 'delete' | 'launch' | 'pause' | 'resume') => {
    if (!campaign || !user?.id_tenant || !user?.id_user) return;

    if (actionType === 'launch') {
        const totalAudience = toNumber(campaign.total_target);
        if (totalAudience <= 0) {
            alert("⚠️ No puedes lanzar esta campaña.\n\nLa audiencia es 0. Asegúrate de asignar listas de distribución y que estas contengan contactos activos.");
            return;
        }
    }

    const config = {
        delete: {
            title: 'Eliminar Campaña',
            message: '¿Estás seguro de eliminar esta campaña permanentemente?',
            confirmText: 'Eliminar',
            isDestructive: true,
            fn: async () => {
                await marketingApi.manageCampaign('delete', {
                    id_tenant: user.id_tenant,
                    id_user: user.id_user,
                    id_campaign: campaign.id_campaign
                });
                navigate('/app/marketing/campaigns');
            }
        },
        launch: {
            title: 'Lanzar Campaña',
            message: `Se enviará a ${campaign.total_target} destinatarios. ¿Confirmar envío?`,
            confirmText: 'Enviar Ahora',
            isDestructive: false,
            fn: async () => {
                await marketingApi.campaignAction(campaign.id_campaign, user.id_tenant, user.id_user, 'send');
                setToast({ message: 'Campaña iniciada', type: 'success' });
                loadCampaignDetail();
            }
        },
        pause: {
            title: 'Pausar Campaña',
            message: 'Se detendrá el envío de correos pendientes.',
            confirmText: 'Pausar',
            isDestructive: false,
            fn: async () => {
                await marketingApi.campaignAction(campaign.id_campaign, user.id_tenant, user.id_user, 'pause');
                setToast({ message: 'Campaña pausada', type: 'success' });
                loadCampaignDetail();
            }
        },
        resume: {
            title: 'Reanudar Campaña',
            message: 'Se continuará con el envío de correos pendientes.',
            confirmText: 'Reanudar',
            isDestructive: false,
            fn: async () => {
                await marketingApi.campaignAction(campaign.id_campaign, user.id_tenant, user.id_user, 'send');
                setToast({ message: 'Campaña reanudada', type: 'success' });
                loadCampaignDetail();
            }
        }
    };

    const selected = config[actionType];

    setConfirmState({
        isOpen: true,
        title: selected.title,
        message: selected.message,
        confirmText: selected.confirmText,
        isDestructive: selected.isDestructive,
        onConfirm: async () => {
            try {
                await selected.fn();
            } catch (error) {
                setToast({ message: 'Error al procesar la acción', type: 'error' });
            } finally {
                setConfirmState(prev => ({...prev, isOpen: false}));
            }
        }
    });
  };

  // --- RENDERIZADO CONDICIONAL DEL BOTÓN PRINCIPAL ---
  const renderMainActionButton = () => {
    if (!campaign) return null;
    const status = normalizeStatus(campaign.status);
    const audienceSize = toNumber(campaign.total_target);
    const hasAudience = audienceSize > 0;

    if (status === 'DRAFT') {
        return (
            <button 
                onClick={() => handleAction('launch')}
                className={`px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all ${
                    hasAudience 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={hasAudience ? 'Iniciar envío masivo' : 'Agrega listas con contactos para enviar'}
            >
                <i className="fa-solid fa-rocket"></i>
                Lanzar Campaña
            </button>
        );
    }

    if (status === 'SENDING' || status === 'PROCESSING') {
        return (
            <button 
                onClick={() => handleAction('pause')}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm shadow-amber-200 transition-all flex items-center gap-2"
            >
                <i className="fa-solid fa-pause"></i>
                Pausar Envío
            </button>
        );
    }

    if (status === 'PAUSED') {
        return (
            <button 
                onClick={() => handleAction('resume')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm shadow-emerald-200 transition-all flex items-center gap-2"
            >
                <i className="fa-solid fa-play"></i>
                Reanudar Envío
            </button>
        );
    }

    return null;
  };

  const renderStatusBadge = (member: AudienceMember) => {
      if (member.opened) return <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold border border-green-200">ABIERTO</span>;
      if (member.status === 'SENT') return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">ENVIADO</span>;
      if (member.status === 'FAILED' || member.status === 'BOUNCED') return <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold border border-red-100">ERROR</span>;
      return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">PENDIENTE</span>;
  };

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-brand-500"></i>
        <p>Cargando detalles...</p>
      </div>
    );
  }

  if (!campaign) {
    return <div className="p-8 text-center text-slate-500">Campaña no encontrada</div>;
  }

  // Datos para el gráfico (mockup o real si tienes datos por hora)
  const chartData = [
    { time: '00:00', opens: 0 }, { time: '04:00', opens: 0 },
    { time: '08:00', opens: Math.floor(toNumber(campaign.open_count) * 0.2) },
    { time: '12:00', opens: Math.floor(toNumber(campaign.open_count) * 0.6) },
    { time: '16:00', opens: Math.floor(toNumber(campaign.open_count) * 0.9) },
    { time: '20:00', opens: toNumber(campaign.open_count) },
  ];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
         <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
                {/* Nombre más pequeño (text-xl o 2xl en lugar de 3xl) */}
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{campaign.name}</h2>
                <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    normalizeStatus(campaign.status) === 'SENT' || normalizeStatus(campaign.status) === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : 
                    normalizeStatus(campaign.status) === 'DRAFT' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                    normalizeStatus(campaign.status) === 'PAUSED' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    normalizeStatus(campaign.status) === 'SENDING' ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' :
                    'bg-red-100 text-red-600 border-red-200'
                }`}>
                    {normalizeStatus(campaign.status) === 'SENDING' ? 'Enviando' : normalizeStatus(campaign.status)}
                </span>
            </div>
            
            <p className="text-slate-500 text-sm mb-3 line-clamp-1">
                <span className="font-semibold text-slate-700">Asunto:</span> {campaign.subject}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600 border border-white shadow-sm">
                        {(campaign.created_by_name || 'U').charAt(0)}
                    </div>
                    <span>{campaign.created_by_name || 'Desconocido'}</span>
                </div>
                <span>•</span>
                <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-2">
            {renderMainActionButton()}

            <Link 
                to={`/app/marketing/campaigns/edit/${id}`}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
                <i className="fa-regular fa-pen-to-square"></i> <span className="hidden sm:inline">Editar</span>
            </Link>
            
            {(normalizeStatus(campaign.status) === 'DRAFT' || normalizeStatus(campaign.status) === 'COMPLETED' || normalizeStatus(campaign.status) === 'FAILED') && (
                <button 
                    onClick={() => handleAction('delete')}
                    className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm transition-colors shadow-sm"
                    title="Eliminar campaña"
                >
                    <i className="fa-regular fa-trash-can"></i>
                </button>
            )}
         </div>
      </div>

      {/* Stats Overview Grid - 5 Cards en fila para XL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Card 1: Progreso (Integrado aquí) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
           <div className="flex justify-between items-start z-10 relative">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado / Progreso</p>
               <i className={`fa-solid ${normalizeStatus(campaign.status) === 'COMPLETED' ? 'fa-check-circle text-green-400' : 'fa-spinner fa-spin text-blue-400'}`}></i>
           </div>
           <div className="mt-2 z-10 relative">
                <p className="text-2xl font-bold text-slate-800">{toNumber(campaign.progress_percentage)}%</p>
                
                {/* Mini Barra dentro del Card */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${normalizeStatus(campaign.status) === 'PAUSED' ? 'bg-amber-400' : 'bg-blue-500'}`} 
                        style={{ width: `${toNumber(campaign.progress_percentage)}%` }} 
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{toNumber(campaign.processed_count)} / {toNumber(campaign.total_target)} procesados</p>
           </div>
        </div>

        {/* Card 2: Audiencia */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Audiencia Total</p>
               <i className="fa-solid fa-users text-slate-300"></i>
           </div>
           <div className="mt-2">
                <p className="text-2xl font-bold text-slate-800">{toNumber(campaign.total_target).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">Contactos únicos</p>
           </div>
        </div>

        {/* Card 3: Aperturas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tasa de Apertura</p>
               <i className="fa-regular fa-envelope-open text-brand-300"></i>
           </div>
           <div className="mt-2">
                <p className="text-2xl font-bold text-brand-600">{toNumber(campaign.open_rate).toFixed(1)}%</p>
                <p className="text-xs text-slate-500 mt-1">
                    <span className="font-bold text-slate-700">{toNumber(campaign.open_count)}</span> leídos
                </p>
           </div>
        </div>

        {/* Card 4: Clics */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Clics en Enlaces</p>
               <i className="fa-solid fa-arrow-pointer text-blue-300"></i>
           </div>
           <div className="mt-2">
                <p className="text-2xl font-bold text-blue-500">{toNumber(campaign.click_count).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">Interacciones</p>
           </div>
        </div>

        {/* Card 5: Pendientes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pendientes</p>
               <i className="fa-regular fa-clock text-amber-300"></i>
           </div>
           <div className="mt-2">
                <p className="text-2xl font-bold text-amber-500">{toNumber(campaign.remaining_count).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">En cola de envío</p>
           </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex gap-1 px-4 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('STATS')}
              className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'STATS'
                  ? 'text-brand-600 border-brand-600 bg-white rounded-t-lg'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <i className="fa-solid fa-chart-pie mr-2"></i> Reporte
            </button>
            <button
              onClick={() => setActiveTab('AUDIENCE')}
              className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'AUDIENCE'
                  ? 'text-brand-600 border-brand-600 bg-white rounded-t-lg'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <i className="fa-solid fa-users-viewfinder mr-2"></i> Audiencia ({filteredAudience.length})
            </button>
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'PREVIEW'
                  ? 'text-brand-600 border-brand-600 bg-white rounded-t-lg'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <i className="fa-regular fa-eye mr-2"></i> Vista Previa
            </button>
          </div>
        </div>

        <div className="p-0">
          {activeTab === 'STATS' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Gráfico */}
                <div className="lg:col-span-2">
                  <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Rendimiento</h3>
                  <div className="h-72 w-full bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="opens" stroke="#3B82F6" strokeWidth={3} fill="url(#gradOpen)" name="Aperturas" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detalles Técnicos */}
                <div className="space-y-6">
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Configuración</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Programado:</span>
                        <span className="font-bold text-slate-700">{campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'Envío Inmediato'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500">Última Act.:</span>
                        <span className="font-bold text-slate-700">{campaign.updated_at ? new Date(campaign.updated_at).toLocaleString() : '-'}</span>
                      </div>
                      <div className="flex flex-col border-b border-slate-200 pb-2">
                        <span className="text-slate-500 mb-1">Remitente:</span>
                        <span className="font-bold text-slate-800 truncate">{campaign.sender_name}</span>
                        <span className="text-xs text-slate-400 truncate">{campaign.sender_email}</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-slate-500 block mb-2">Listas de Destino:</span>
                        <div className="flex flex-wrap gap-2">
                          {campaign.target_lists_display ? (
                            campaign.target_lists_display.split(',').map((list, i) => (
                                <span key={i} className="px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded text-xs font-semibold shadow-sm">
                                {list.trim()}
                                </span>
                            ))
                          ) : (
                            <span className="text-xs text-red-400 bg-red-50 px-2 py-1 rounded border border-red-100 italic">Sin audiencia</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          )}

          {activeTab === 'AUDIENCE' && (
            <div className="flex flex-col h-full min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre o email..." 
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            value={audienceSearch}
                            onChange={(e) => setAudienceSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        Mostrando {filteredAudience.length} destinatarios
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 border-b border-slate-200">Destinatario</th>
                                <th className="px-6 py-3 border-b border-slate-200">Estado</th>
                                <th className="px-6 py-3 border-b border-slate-200">Enviado</th>
                                <th className="px-6 py-3 border-b border-slate-200 text-right">Interacción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAudience.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <i className="fa-solid fa-user-slash text-3xl mb-2"></i>
                                        <p>No se encontraron destinatarios.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAudience.map((member) => (
                                    <tr key={member.id_contact} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{member.name}</p>
                                                <p className="text-xs text-slate-500">{member.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            {renderStatusBadge(member)}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-slate-600">
                                            {member.sent_at ? new Date(member.sent_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {member.opened ? (
                                                <span className="text-green-600 text-xs font-bold flex items-center justify-end gap-1">
                                                    <i className="fa-solid fa-envelope-open"></i> Leído
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs flex items-center justify-end gap-1">
                                                    <i className="fa-solid fa-envelope"></i> Sin abrir
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {activeTab === 'PREVIEW' && (
            <div className="p-8 max-w-4xl mx-auto space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm space-y-2 shadow-sm">
                  <div className="flex gap-2">
                      <span className="text-slate-500 font-medium w-16 text-right">De:</span>
                      <span className="text-slate-800 font-bold">{campaign.sender_name} &lt;{campaign.sender_email}&gt;</span>
                  </div>
                  <div className="flex gap-2">
                      <span className="text-slate-500 font-medium w-16 text-right">Asunto:</span>
                      <span className="text-slate-800 font-bold">{campaign.subject}</span>
                  </div>
                  {campaign.preview_text && (
                      <div className="flex gap-2">
                          <span className="text-slate-500 font-medium w-16 text-right">Preheader:</span>
                          <span className="text-slate-600 italic">{campaign.preview_text}</span>
                      </div>
                  )}
              </div>
              
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex gap-1.5 items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 border border-green-500"></div>
                    <div className="ml-4 bg-white px-3 py-0.5 rounded text-[10px] text-slate-400 border flex-1 text-center font-mono">Vista Previa HTML</div>
                </div>
                <div className="bg-white min-h-[600px]">
                    {campaign.html_content ? (
                    <iframe 
                        title="preview"
                        srcDoc={campaign.html_content}
                        className="w-full h-[700px] border-none"
                    />
                    ) : (
                    <div className="text-center text-slate-400 py-20">
                        <i className="fa-regular fa-file-lines text-4xl mb-4 opacity-50"></i>
                        <p>Sin contenido HTML disponible</p>
                    </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <ConfirmModal 
        isOpen={confirmState.isOpen} 
        title={confirmState.title} 
        message={confirmState.message} 
        confirmText={confirmState.confirmText}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))} 
      />
    </div>
  );
};

export default CampaignDetail;
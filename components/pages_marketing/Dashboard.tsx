import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi } from '../../services/marketingApi';
import { MarketingCampaign, MarketingList } from '../../types';
import CreateListModal from './CreateListModal';
import { BrandSpinner } from '../AppLoaders';

// Componente de Tarjeta de Estadística (Pequeño y reutilizable)
const StatCard = ({ title, value, icon, subtext, color = "blue" }: any) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
      </div>
      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      
      try {
        setLoading(true);
        // Hacemos las peticiones en paralelo para mayor velocidad
        const [campaignsData, listsData] = await Promise.all([
          marketingApi.getCampaigns(user.id_tenant, user.id_user),
          marketingApi.getLists(user.id_tenant, user.id_user)
        ]);
        
        setCampaigns(campaignsData);
        setLists(listsData);
      } catch (error) {
        console.error('Error cargando dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleListCreated = async () => {
    if (user?.id_tenant && user?.id_user) {
      const listsData = await marketingApi.getLists(user.id_tenant, user.id_user);
      setLists(listsData);
      setIsCreateListModalOpen(false);
      navigate('/app/marketing/lists');
    }
  };

  // --- CÁLCULOS DE MÉTRICAS (MEMOIZED) ---
  const stats = useMemo(() => {
    // 1. Total Suscriptores
    const totalSubscribers = lists.reduce((acc, curr) => acc + (Number(curr.member_count) || 0), 0);
    
    // 2. Total Enviados (Sumamos sent_count de todas las campañas)
    const totalSent = campaigns.reduce((acc, curr) => acc + (Number(curr.sent_count) || 0), 0);

    // 3. Tasa de Apertura Global (Total Aperturas / Total Enviados)
    const totalOpens = campaigns.reduce((acc, curr) => acc + (Number(curr.open_count) || 0), 0);
    const globalOpenRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : "0.0";

    // 4. Tasa de Clicks Global
    const totalClicks = campaigns.reduce((acc, curr) => acc + (Number(curr.click_count) || 0), 0);
    const globalClickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : "0.0";

    return { totalSubscribers, totalSent, globalOpenRate, totalOpens, globalClickRate, totalClicks };
  }, [campaigns, lists]);

  // --- DATOS PARA EL GRÁFICO (Últimos 7 días) ---
  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short' }); // Lun, Mar

      // Buscar campañas enviadas este día (o creadas si no se enviaron, para mostrar actividad)
      // Nota: Usamos sent_at para envíos reales
      const campaignsThatDay = campaigns.filter(c => 
        c.sent_at && c.sent_at.startsWith(dateStr)
      );

      const sentCount = campaignsThatDay.reduce((acc, c) => acc + (Number(c.sent_count) || 0), 0);
      const openCount = campaignsThatDay.reduce((acc, c) => acc + (Number(c.open_count) || 0), 0);

      data.push({
        name: dayLabel,
        fullDate: dateStr,
        enviados: sentCount,
        aperturas: openCount
      });
    }
    return data;
  }, [campaigns]);

  // Filtrar campañas recientes (Las 5 últimas creadas)
  const recentCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [campaigns]);

  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-slate-400">
        <BrandSpinner size="xl" className="mb-3" />
        <p>Calculando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-fadeIn pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Panel de Marketing</h2>
          <p className="text-slate-500">Visión general de tu rendimiento en tiempo real.</p>
        </div>
        <div className="flex gap-3">
            <button 
            onClick={() => setIsCreateListModalOpen(true)}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 text-sm"
            >
            <i className="fa-solid fa-plus"></i> Crear Lista
            </button>
            <Link 
            to="/app/marketing/campaigns/new"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 text-sm"
            >
            <i className="fa-solid fa-plus"></i> Crear Campaña
            </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <StatCard 
            title="Correos Enviados" 
            value={stats.totalSent.toLocaleString()} 
            icon="fa-paper-plane" 
            subtext="Total histórico"
            color="blue"
        />
        <StatCard 
            title="Tasa de Apertura" 
            value={`${stats.globalOpenRate}%`} 
            icon="fa-envelope-open" 
            subtext={`${stats.totalOpens.toLocaleString()} aperturas únicas`}
            color="green"
        />
        <StatCard 
            title="Total Audiencia" 
            value={stats.totalSubscribers.toLocaleString()} 
            icon="fa-users" 
            subtext="Suscriptores activos"
            color="purple"
        />
        <StatCard 
            title="Tasa de Clicks" 
            value={`${stats.globalClickRate}%`} 
            icon="fa-mouse-pointer" 
            subtext={`${stats.totalClicks.toLocaleString()} clicks únicos`}
            color="orange"
        />
      </div>

      {/* Charts & Lists Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full">
        
        {/* Chart Area */}
        <div className="xl:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-slate-800">Actividad de Envío (Últimos 7 días)</h3>
             <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Volumen Diario</span>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            {chartData.every(d => d.enviados === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <i className="fa-solid fa-chart-area text-4xl mb-2 opacity-20"></i>
                    <p className="text-sm">No hay actividad de envíos reciente</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                    <linearGradient id="colorEnviados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    itemStyle={{ color: '#1e293b' }}
                    labelStyle={{ color: '#64748b', marginBottom: '0.5rem' }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="enviados" 
                        stroke="#3B82F6" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorEnviados)" 
                        name="Emails Enviados" 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="aperturas" 
                        stroke="#10B981" 
                        strokeWidth={2} 
                        fill="transparent" 
                        name="Aperturas" 
                        strokeDasharray="5 5"
                    />
                </AreaChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Campaigns List */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
           <div className="flex justify-between items-center mb-6 shrink-0">
             <h3 className="text-lg font-bold text-slate-800">Campañas Recientes</h3>
             <Link to="/app/marketing/campaigns" className="text-xs text-brand-600 font-semibold hover:underline">
               Ver todas
             </Link>
           </div>
           
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {recentCampaigns.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                     <p className="text-sm">No has creado campañas aún</p>
                 </div>
             ) : (
                recentCampaigns.map(campaign => (
                <div 
                    key={campaign.id_campaign} 
                    onClick={() => navigate(`/app/marketing/campaigns/${campaign.id_campaign}`)}
                    className="group flex flex-col gap-2 p-3 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer"
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                                campaign.status === 'SENT' || campaign.status === 'COMPLETED' ? 'bg-green-500' : 
                                campaign.status === 'SENDING' ? 'bg-blue-500 animate-pulse' :
                                campaign.status === 'PAUSED' ? 'bg-amber-400' : 'bg-slate-300'
                            }`}></div>
                            <h4 className="text-sm font-semibold text-slate-700 truncate group-hover:text-brand-700 transition-colors">
                                {campaign.name}
                            </h4>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-slate-500 flex gap-3">
                             {campaign.status === 'DRAFT' ? (
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">Borrador</span>
                             ) : (
                                <>
                                    <span className="flex items-center gap-1" title="Enviados">
                                        <i className="fa-regular fa-paper-plane"></i> {campaign.sent_count || 0}
                                    </span>
                                    <span className="flex items-center gap-1" title="Aperturas">
                                        <i className="fa-regular fa-eye"></i> {campaign.open_count || 0}
                                    </span>
                                </>
                             )}
                        </div>
                        <i className="fa-solid fa-chevron-right text-xs text-slate-300 group-hover:text-brand-400 transition-colors"></i>
                    </div>
                </div>
                ))
             )}
           </div>
        </div>
      </div>

      {/* Create List Modal */}
      <CreateListModal 
        isOpen={isCreateListModalOpen} 
        onClose={() => setIsCreateListModalOpen(false)}
        onSuccess={handleListCreated}
      />
    </div>
  );
};

export default Dashboard;

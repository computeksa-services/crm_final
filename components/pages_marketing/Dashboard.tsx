import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi } from '../../services/marketingApi';
import { MarketingCampaign, MarketingList } from '../../types';
import CreateListModal from './CreateListModal';
import { BrandSpinner } from '../AppLoaders';

// Componente de Tarjeta de Estadística - Minimalista
const StatCard = ({ title, value, icon, subtext }: any) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
          <i className={`fa-solid ${icon} text-sm text-gray-600 dark:text-gray-400`}></i>
        </div>
      </div>
      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {title}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {subtext}
        </div>
      )}
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

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id_tenant || !user?.id_user) return;
      
      try {
        setLoading(true);
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

  const stats = useMemo(() => {
    const totalSubscribers = lists.reduce((acc, curr) => acc + (Number(curr.member_count) || 0), 0);
    const totalSent = campaigns.reduce((acc, curr) => acc + (Number(curr.sent_count) || 0), 0);
    const totalOpens = campaigns.reduce((acc, curr) => acc + (Number(curr.open_count) || 0), 0);
    const globalOpenRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : "0.0";
    const totalClicks = campaigns.reduce((acc, curr) => acc + (Number(curr.click_count) || 0), 0);
    const globalClickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : "0.0";

    return { totalSubscribers, totalSent, globalOpenRate, totalOpens, globalClickRate, totalClicks };
  }, [campaigns, lists]);

  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short' });

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

  const recentCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [campaigns]);

  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center">
        <BrandSpinner size="lg" />
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-3">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Resumen de rendimiento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsCreateListModalOpen(true)}
            className="h-9 px-4 text-[13px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            Nueva Lista
          </button>
          <Link 
            to="/app/marketing/campaigns/new"
            className="h-9 px-4 text-[13px] font-medium bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            Nueva Campaña
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Enviados" 
          value={stats.totalSent.toLocaleString()} 
          icon="fa-paper-plane" 
          subtext="Total histórico"
        />
        <StatCard 
          title="Apertura" 
          value={`${stats.globalOpenRate}%`} 
          icon="fa-envelope-open" 
          subtext={`${stats.totalOpens.toLocaleString()} aperturas`}
        />
        <StatCard 
          title="Audiencia" 
          value={stats.totalSubscribers.toLocaleString()} 
          icon="fa-users" 
          subtext="Suscriptores activos"
        />
        <StatCard 
          title="Clicks" 
          value={`${stats.globalClickRate}%`} 
          icon="fa-mouse-pointer" 
          subtext={`${stats.totalClicks.toLocaleString()} clicks`}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Últimos 7 días
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Enviados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Aperturas</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px]">
            {chartData.every(d => d.enviados === 0) ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-chart-area text-gray-400 dark:text-gray-500"></i>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin actividad reciente</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorEnviados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-slate-700" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 11 }} 
                    dy={5}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 11 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '8px', 
                      border: '1px solid #e5e7eb',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: '#1f2937' }}
                    labelStyle={{ color: '#6b7280', marginBottom: '4px', fontSize: '11px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="enviados" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorEnviados)" 
                    name="Enviados" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="aperturas" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    fill="transparent" 
                    name="Aperturas" 
                    strokeDasharray="3 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recientes
            </h3>
            <Link 
              to="/app/marketing/campaigns" 
              className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              Ver todas
            </Link>
          </div>
           
          <div className="space-y-2">
            {recentCampaigns.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-paper-plane text-gray-400 dark:text-gray-500"></i>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin campañas</p>
              </div>
            ) : (
              recentCampaigns.map(campaign => (
                <button
                  key={campaign.id_campaign} 
                  onClick={() => navigate(`/app/marketing/campaigns/${campaign.id_campaign}`)}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        campaign.status === 'SENT' || campaign.status === 'COMPLETED' ? 'bg-green-500' : 
                        campaign.status === 'SENDING' ? 'bg-blue-500 animate-pulse' :
                        campaign.status === 'PAUSED' ? 'bg-amber-400' : 'bg-gray-300 dark:bg-gray-600'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {campaign.name}
                      </span>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[10px] text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors flex-shrink-0"></i>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {campaign.status === 'DRAFT' ? (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded text-[11px]">
                        Borrador
                      </span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-paper-plane text-[10px]"></i>
                          {campaign.sent_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-eye text-[10px]"></i>
                          {campaign.open_count || 0}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <CreateListModal 
        isOpen={isCreateListModalOpen} 
        onClose={() => setIsCreateListModalOpen(false)}
        onSuccess={handleListCreated}
      />
    </div>
  );
};

export default Dashboard;
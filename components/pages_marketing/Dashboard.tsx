import React from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_CAMPAIGNS, MOCK_LISTS } from '../marketingMockData';

const data = [
  { name: 'Lun', opens: 400, clicks: 240 },
  { name: 'Mar', opens: 300, clicks: 139 },
  { name: 'Mie', opens: 200, clicks: 980 },
  { name: 'Jue', opens: 278, clicks: 390 },
  { name: 'Vie', opens: 189, clicks: 480 },
  { name: 'Sab', opens: 239, clicks: 380 },
  { name: 'Dom', opens: 349, clicks: 430 },
];

const StatCard = ({ title, value, icon, trend, trendUp }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xl">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {trend} <i className={`fa-solid fa-arrow-${trendUp ? 'up' : 'down'}`}></i>
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</h3>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const totalSent = MOCK_CAMPAIGNS.reduce((acc, curr) => acc + (curr.stats?.sent || 0), 0);
  const totalSubscribers = MOCK_LISTS.reduce((acc, curr) => acc + curr.member_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Panel de Marketing</h2>
          <p className="text-slate-500">Resumen de rendimiento y actividad reciente.</p>
        </div>
        <Link 
          to="/app/marketing/campaigns/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Nueva Campaña
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Emails Enviados" value={totalSent.toLocaleString()} icon="fa-paper-plane" trend="12%" trendUp={true} />
        <StatCard title="Tasa de Apertura" value="24.8%" icon="fa-envelope-open" trend="3%" trendUp={true} />
        <StatCard title="Total Suscriptores" value={totalSubscribers.toLocaleString()} icon="fa-users" trend="5%" trendUp={true} />
        <StatCard title="Clicks Únicos" value="1,290" icon="fa-mouse-pointer" trend="1%" trendUp={false} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Rendimiento de la Semana</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ color: '#1e293b' }}
                />
                <Area type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorOpens)" name="Aperturas" />
                <Area type="monotone" dataKey="clicks" stroke="#0ea5e9" strokeWidth={2} fillOpacity={0} fill="transparent" name="Clicks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-800 mb-6">Campañas Recientes</h3>
           <div className="space-y-4">
             {MOCK_CAMPAIGNS.slice(0, 3).map(campaign => (
               <div key={campaign.id_campaign} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0">
                  <div className={`mt-1 w-2 h-2 rounded-full ${
                    campaign.status === 'SENT' ? 'bg-green-500' : 
                    campaign.status === 'DRAFT' ? 'bg-slate-300' : 'bg-amber-400'
                  }`}></div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">{campaign.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {campaign.status === 'SENT' ? `Enviado: ${new Date(campaign.sent_at!).toLocaleDateString()}` : 'Borrador'}
                    </p>
                    {campaign.status === 'SENT' && (
                      <div className="flex gap-3 mt-2">
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          <i className="fa-regular fa-envelope-open mr-1"></i> {((campaign.stats?.opened || 0) / (campaign.stats?.sent || 1) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
               </div>
             ))}
           </div>
           <Link to="/app/marketing/campaigns" className="block w-full text-center mt-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors">
             Ver todas las campañas
           </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
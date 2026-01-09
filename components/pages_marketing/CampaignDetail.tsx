import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_CAMPAIGNS } from '../marketingMockData';

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campaign = MOCK_CAMPAIGNS.find(c => c.id_campaign === id);

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
           <p className="text-3xl font-bold text-slate-800 mt-2">{campaign.stats?.sent?.toLocaleString() || 0}</p>
           <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
             <i className="fa-solid fa-check-circle"></i> 99.8% Entregabilidad
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Aperturas</p>
           <p className="text-3xl font-bold text-brand-600 mt-2">{campaign.stats?.opened?.toLocaleString() || 0}</p>
           <p className="text-xs text-slate-500 mt-1">
             Tasa: {((campaign.stats?.opened || 0) / (campaign.stats?.sent || 1) * 100).toFixed(1)}%
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Clicks</p>
           <p className="text-3xl font-bold text-blue-600 mt-2">{campaign.stats?.clicked?.toLocaleString() || 0}</p>
           <p className="text-xs text-slate-500 mt-1">
             CTR: {((campaign.stats?.clicked || 0) / (campaign.stats?.sent || 1) * 100).toFixed(1)}%
           </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs font-bold text-slate-500 uppercase">Rebotes</p>
           <p className="text-3xl font-bold text-red-500 mt-2">2</p>
           <p className="text-xs text-slate-500 mt-1">0.2% Tasa de rebote</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Main Chart */}
         <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
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
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-800 mb-4">Configuración</h3>
             <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                   <span className="text-slate-500">Enviado el:</span>
                   <span className="font-medium">{campaign.sent_at ? new Date(campaign.sent_at).toLocaleString() : 'Pendiente'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                   <span className="text-slate-500">Remitente:</span>
                   <span className="font-medium">Carlos Rodriguez</span>
                </div>
                <div className="pt-2">
                   <span className="text-slate-500 block mb-2">Listas incluidas:</span>
                   <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">Clientes VIP</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">Leads Q3</span>
                   </div>
                </div>
             </div>
             
             <div className="mt-8">
               <h3 className="font-bold text-slate-800 mb-4">Enlaces más clicados</h3>
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-blue-600 hover:underline truncate w-2/3 cursor-pointer">https://computeksa.com/ofertas</span>
                     <span className="font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">85 clicks</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-blue-600 hover:underline truncate w-2/3 cursor-pointer">https://computeksa.com/blog/ai</span>
                     <span className="font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">34 clicks</span>
                  </div>
               </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
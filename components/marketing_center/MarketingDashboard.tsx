import React, { useEffect, useState } from 'react';
import { marketingApi } from '../../services/marketingApi';

interface DashboardProps {
  tenantId: string;
  userId: string;
}

const MarketingDashboard: React.FC<DashboardProps> = ({ tenantId, tenantId: string }) => {
  const [stats, setStats] = useState({
    totalAudiences: 0,
    totalContacts: 0,
    totalCampaigns: 0,
    sentCampaigns: 0,
    avgOpenRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Cargamos listas y campañas en paralelo para calcular KPIs
        const [lists, campaigns] = await Promise.all([
          marketingApi.getLists(tenantId, ''), // User empty to see all public
          marketingApi.getCampaigns(tenantId, '')
        ]);

        const sentCampaignsList = campaigns.filter(c => c.status === 'SENT');
        
        // Calculamos métricas simples (puedes mejorarlas con SQL en el futuro)
        const totalContacts = lists.reduce((acc, curr) => acc + (curr.member_count || 0), 0);
        
        let totalOpens = 0;
        let totalSentCount = 0;
        sentCampaignsList.forEach(c => {
          totalOpens += c.open_count || 0;
          totalSentCount += c.sent_count || 0;
        });

        const avgOpenRate = totalSentCount > 0 ? Math.round((totalOpens / totalSentCount) * 100) : 0;

        setStats({
          totalAudiences: lists.length,
          totalContacts,
          totalCampaigns: campaigns.length,
          sentCampaigns: sentCampaignsList.length,
          avgOpenRate
        });

      } catch (error) {
        console.error("Error loading stats", error);
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) loadStats();
  }, [tenantId]);

  if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase">Audiencia Total</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.totalContacts}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <i className="fa-solid fa-users text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">En {stats.totalAudiences} listas segmentadas</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase">Campañas Enviadas</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.sentCampaigns}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <i className="fa-solid fa-paper-plane text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">De un total de {stats.totalCampaigns} creadas</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase">Tasa de Apertura</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.avgOpenRate}%</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <i className="fa-regular fa-eye text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Promedio global</p>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl shadow-md text-white flex flex-col justify-center items-center text-center">
          <h4 className="font-bold text-lg mb-2">¿Listo para vender?</h4>
          <p className="text-blue-100 text-sm mb-4">Crea una nueva campaña ahora.</p>
          <button className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors w-full">
            Crear Campaña
          </button>
        </div>
      </div>

      {/* Aquí puedes agregar gráficos de Chart.js o Recharts en el futuro */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
        <div className="inline-block p-4 bg-slate-50 rounded-full mb-4">
          <i className="fa-solid fa-chart-line text-4xl text-slate-300"></i>
        </div>
        <h3 className="text-lg font-bold text-slate-700">Análisis detallado próximamente</h3>
        <p className="text-slate-500">Estamos recopilando datos para mostrarte la evolución de tus suscriptores.</p>
      </div>
    </div>
  );
};

export default MarketingDashboard;
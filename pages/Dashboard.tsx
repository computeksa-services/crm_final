import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MockApi } from '../services/mockApi';

type FinancialSummary = {
  ingreso_total: number;
  por_cobrar: number;
  transacciones_mes: number;
};

type PipelineStage = {
  etapa: string;
  monto: number;
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<string>('---');
  const [financial, setFinancial] = useState<FinancialSummary>({
    ingreso_total: 0,
    por_cobrar: 0,
    transacciones_mes: 0,
  });
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('📊 Dashboard - Usuario actual:', user);
  console.log('📊 Dashboard - LocalStorage:', localStorage.getItem('user'));

  useEffect(() => {
    if (!user?.id_user || !user?.id_tenant) return;

    setLoading(true);
    setError(null);

    MockApi.getDashboardData(user.id_user, user.id_tenant)
      .then((data) => {
        // API returns an array with dashboard_data inside the first element
        const payload = Array.isArray(data)
          ? data[0]?.dashboard_data || data[0]
          : data?.dashboard_data || data;

        if (!payload) return;

        setPerfil(payload.perfil || '---');

        const resumen = payload.resumen_financiero as Partial<FinancialSummary> | undefined;
        if (resumen) {
          setFinancial((prev) => ({
            ingreso_total: resumen.ingreso_total ?? prev.ingreso_total,
            por_cobrar: resumen.por_cobrar ?? prev.por_cobrar,
            transacciones_mes: resumen.transacciones_mes ?? prev.transacciones_mes,
          }));
        }

        const pipe = Array.isArray(payload.pipeline_ventas) ? payload.pipeline_ventas as PipelineStage[] : [];
        setPipeline(pipe);
      })
      .catch((err) => {
        console.error('Error cargando dashboard', err);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard');
      })
      .finally(() => setLoading(false));
  }, [user?.id_user, user?.id_tenant]);

  const metricCards = useMemo(() => ([
    { label: 'Ingreso total', value: `$${financial.ingreso_total.toLocaleString('es-EC')}`, icon: 'fa-sack-dollar', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Por cobrar', value: `$${financial.por_cobrar.toLocaleString('es-EC')}`, icon: 'fa-file-invoice-dollar', color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Transacciones del mes', value: financial.transacciones_mes.toString(), icon: 'fa-receipt', color: 'text-blue-600', bg: 'bg-blue-100' },
  ]), [financial]);

  const maxPipelineMonto = useMemo(() => {
    if (!pipeline.length) return 1;
    return Math.max(...pipeline.map(p => p.monto || 0));
  }, [pipeline]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Bienvenido, {user?.name_user || 'Usuario'}</h1>
          <p className="text-slate-500 mt-1">{user?.email_user}</p>
        </div>
        {user && (
          <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <img 
              src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.name_user}&background=random`} 
              alt="Profile" 
              className="w-12 h-12 rounded-full border border-slate-300" 
            />
            <div>
              <p className="font-semibold text-slate-800">{user.name_user}</p>
              <p className="text-xs text-slate-500 capitalize">{user.rol_user}</p>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="mb-4 text-sm text-slate-500">Cargando información del dashboard...</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metricCards.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mr-4`}>
              <i className={`fa-solid ${stat.icon} text-xl`}></i>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Pipeline de Ventas</h2>
          {pipeline.length === 0 && (
            <div className="h-40 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              Sin datos de pipeline todavía.
            </div>
          )}
          <div className="space-y-4">
            {pipeline.map((stage, idx) => {
              const percent = Math.round(((stage.monto || 0) / maxPipelineMonto) * 100);
              return (
                <div key={`${stage.etapa}-${idx}`} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{stage.etapa}</span>
                    <span>${stage.monto.toLocaleString('es-EC')}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Resumen</h2>
          <p className="text-sm text-slate-500 mb-4">Datos provistos por /api/dashboard</p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><i className="fa-solid fa-circle-dot text-emerald-500"></i> Ingreso total: <span className="font-semibold">${financial.ingreso_total.toLocaleString('es-EC')}</span></li>
            <li className="flex items-center gap-2"><i className="fa-solid fa-circle-dot text-emerald-500"></i> Por cobrar: <span className="font-semibold">${financial.por_cobrar.toLocaleString('es-EC')}</span></li>
            <li className="flex items-center gap-2"><i className="fa-solid fa-circle-dot text-emerald-500"></i> Transacciones del mes: <span className="font-semibold">{financial.transacciones_mes}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

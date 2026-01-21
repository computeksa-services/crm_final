import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  AreaChart, Area 
} from 'recharts';

// --- TIPOS DE DATOS ---
type FinancialSummary = {
  ingreso_total: number;
  por_cobrar: number;
  transacciones_mes: number;
  hidden?: boolean; 
};

type PipelineStage = {
  etapa: string;
  monto: number;
  cantidad: number;
};

type QuoteSummary = {
  no_cotizacion: number;
  nombre_cotizacion: string;
  total: number;
  vendedor: string;
  estado_decision: string;
  fecha_emision: string;
};

type CalendarEvent = {
  titulo: string;
  fecha_inicio: string;
  tipo: string;
};

type SalesByCompany = {
  nombre: string;
  total: number;
};

type SalesHistory = {
  mes: string;
  total: number;
};

type DashboardResponse = {
    perfil: string;
    resumen_financiero: FinancialSummary;
    pipeline_ventas: PipelineStage[];
    ventas_por_empresa: SalesByCompany[];
    historial_ventas: SalesHistory[];
    kpi_conversion: number;
    cotizaciones_recientes: QuoteSummary[];
    agenda_hoy: CalendarEvent[];
    crecimiento?: {
        total_empresas: number;
        total_contactos: number;
    };
    ranking_vendedores?: Array<{
        nombre: string;
        avatar_url: string;
        cerrados: number;
        monto: number;
    }>;
    top_productos?: Array<{
        producto: string;
        cantidad: number;
        total_ventas: number;
    }>;
    marketing?: {
        campanas: number;
        aperturas: number;
        clics: number;
    };
};

const DEFAULT_FINANCIAL: FinancialSummary = {
  ingreso_total: 0,
  por_cobrar: 0,
  transacciones_mes: 0,
  hidden: true
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // --- ESTADOS ---
    const [financial, setFinancial] = useState<FinancialSummary>(DEFAULT_FINANCIAL);
    const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
    const [salesByCompany, setSalesByCompany] = useState<SalesByCompany[]>([]);
    const [salesHistory, setSalesHistory] = useState<SalesHistory[]>([]);
    const [recentQuotes, setRecentQuotes] = useState<QuoteSummary[]>([]);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [conversionRate, setConversionRate] = useState<number>(0);
    const [growth, setGrowth] = useState<{ total_empresas: number; total_contactos: number }>({ total_empresas: 0, total_contactos: 0 });
    const [ranking, setRanking] = useState<Array<{ nombre: string; avatar_url: string; cerrados: number; monto: number }>>([]);
    const [topProducts, setTopProducts] = useState<Array<{ producto: string; cantidad: number; total_ventas: number }>>([]);
    const [marketingData, setMarketingData] = useState<{ campanas: number; aperturas: number; clics: number }>({ campanas: 0, aperturas: 0, clics: 0 });
    const [loading, setLoading] = useState(false);

  // --- HELPER: FORMATEO #0001 ---
  const formatQuoteNumber = (num: number) => {
    return `#${num.toString().padStart(4, '0')}`;
  };

  // --- CARGA DE DATOS REALES ---
  const didInitRef = useRef(false);
  
  useEffect(() => {
    if (!user?.id_user || !user?.id_tenant) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/crm/dashboard`;

        const res = await apiFetch(url, {
          method: 'POST',
          body: JSON.stringify({
            id_tenant: user?.id_tenant,
            id_user: user?.id_user
          })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText} at ${url} | ${body.slice(0, 180)}`);
        }
        if (!contentType.includes('application/json')) {
          const body = await res.text().catch(() => '');
          throw new Error(`Respuesta no JSON (${contentType}) desde ${url}. Inicio: ${body.slice(0, 180)}`);
        }

                const jsonRaw = await res.json();
        
        let finalData: DashboardResponse | null = null;
        if (Array.isArray(jsonRaw) && jsonRaw.length > 0) {
            finalData = jsonRaw[0].data || jsonRaw[0];
        } else if (jsonRaw && typeof jsonRaw === 'object') {
            finalData = jsonRaw.data || jsonRaw.get_crm_dashboard_kpi || jsonRaw;
        }

        if (finalData) {
          setFinancial(finalData.resumen_financiero || DEFAULT_FINANCIAL);
          setPipeline(Array.isArray(finalData.pipeline_ventas) ? finalData.pipeline_ventas : []);
          setSalesByCompany(Array.isArray(finalData.ventas_por_empresa) ? finalData.ventas_por_empresa : []);
          setSalesHistory(Array.isArray(finalData.historial_ventas) ? finalData.historial_ventas : []);
          setRecentQuotes(Array.isArray(finalData.cotizaciones_recientes) ? finalData.cotizaciones_recientes : []);
          setTodayEvents(Array.isArray(finalData.agenda_hoy) ? finalData.agenda_hoy : []);
          setConversionRate(Number(finalData.kpi_conversion) || 0);
          setGrowth(finalData.crecimiento || { total_empresas: 0, total_contactos: 0 });
          setRanking(Array.isArray(finalData.ranking_vendedores) ? finalData.ranking_vendedores : []);
          setTopProducts(Array.isArray(finalData.top_productos) ? finalData.top_productos : []);
          setMarketingData(finalData.marketing || { campanas: 0, aperturas: 0, clics: 0 });
        }

            } catch (err) {
                console.error('❌ Error dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const metricCards = useMemo(() => {
    if (!financial || financial.hidden) return [];
    return [
      { label: 'Ingreso Total', value: `$${Number(financial.ingreso_total || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, icon: 'fa-sack-dollar', color: 'text-emerald-600', bg: 'bg-emerald-100' },
      { label: 'Por Cobrar', value: `$${Number(financial.por_cobrar || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, icon: 'fa-file-invoice-dollar', color: 'text-amber-600', bg: 'bg-amber-100' },
      { label: 'Transacciones', value: (financial.transacciones_mes || 0).toString(), icon: 'fa-receipt', color: 'text-blue-600', bg: 'bg-blue-100' },
    ];
  }, [financial]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Bienvenido de nuevo, {user?.name_user?.split(' ')[0]}</p>
        </div>
        
        {/* KPI Conversión */}
        <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-indigo-50 text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center">
             <i className="fa-solid fa-chart-pie"></i>
          </div>
          <div>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Conversión</p>
             <p className="text-xl font-bold text-slate-900">{conversionRate}%</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500 mb-3"></i>
            <p className="text-slate-500">Cargando información...</p>
        </div>
      ) : (
        <>
            {/* 1. TARJETAS FINANCIERAS */}
            {metricCards.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    {/* Tarjetas financieras */}
                                    {metricCards.map((stat, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center hover:shadow-md transition-shadow cursor-default">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} mr-4`}>
                                                <i className={`fa-solid ${stat.icon} text-xl`}></i>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                                                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Métricas de Red */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-start hover:shadow-md transition-shadow cursor-default">
                                        <div className="flex items-center gap-3 mb-2">
                                            <i className="fa-solid fa-network-wired text-xl text-cyan-600"></i>
                                            <span className="text-sm text-slate-500 font-medium">Empresas Totales</span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-800 mb-4">{growth.total_empresas || 0}</p>
                                        <div className="flex items-center gap-3">
                                            <i className="fa-solid fa-address-book text-xl text-fuchsia-600"></i>
                                            <span className="text-sm text-slate-500 font-medium">Contactos en Base</span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-800">{growth.total_contactos || 0}</p>
                                    </div>
                                </div>
            )}

            {/* 2. GRÁFICOS */}
            {!financial.hidden && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    
                    {/* Gráfico 1: Ventas por Empresa */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-building text-blue-500"></i> Top Clientes (Ventas)
                        </h2>
                        {/* IMPORTANTE: Altura fija h-72 para evitar error de Recharts */}
                        <div className="h-72 w-full">
                            {salesByCompany.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesByCompany} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="nombre" width={100} tick={{fontSize: 11, fill: '#64748b'}} />
                                        <Tooltip 
                                            cursor={{fill: '#f1f5f9'}}
                                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                    <i className="fa-solid fa-chart-bar text-3xl mb-2 opacity-50"></i>
                                    <p className="text-sm">No hay ventas registradas aún</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gráfico 2: Historial de Ventas */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <i className="fa-solid fa-chart-line text-emerald-500"></i> Historial de Ventas
                        </h2>
                        <div className="h-72 w-full">
                            {salesHistory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="mes" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis hide />
                                        <Tooltip 
                                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="total" 
                                            stroke="#10b981" 
                                            strokeWidth={3} 
                                            fillOpacity={1} 
                                            fill="url(#colorVentas)" 
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                    <i className="fa-solid fa-chart-area text-3xl mb-2 opacity-50"></i>
                                    <p className="text-sm">Sin historial reciente</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2.5. KPIs DE MARKETING */}
            {!financial.hidden && (marketingData.campanas > 0 || marketingData.aperturas > 0 || marketingData.clics > 0) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <i className="fa-solid fa-bullhorn text-pink-500"></i> Efectividad de Marketing
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
                                <i className="fa-solid fa-rectangle-ad text-xl"></i>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Campañas Activas</p>
                                <p className="text-2xl font-bold text-slate-800">{marketingData.campanas || 0}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                                <i className="fa-solid fa-envelope-open text-xl"></i>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Aperturas</p>
                                <p className="text-2xl font-bold text-slate-800">{marketingData.aperturas || 0}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-100 text-green-600">
                                <i className="fa-solid fa-mouse-pointer text-xl"></i>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Clics (CTR)</p>
                                <p className="text-2xl font-bold text-slate-800">{marketingData.clics || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2.6. TOP PRODUCTOS */}
            {!financial.hidden && topProducts.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <i className="fa-solid fa-star text-yellow-500"></i> Top Productos (Best Sellers)
                    </h2>
                    <div style={{ height: `${Math.max(topProducts.length * 60, 300)}px` }} className="w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 40, left: 20, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="producto" 
                                    width={250}
                                    tick={{fontSize: 12, fill: '#64748b'}}
                                    interval={0}
                                />
                                <Tooltip 
                                    cursor={{fill: '#fef3c7'}}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="total_ventas" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 3. PIPELINE Y LISTAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Pipeline */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <i className="fa-solid fa-funnel-dollar text-orange-500"></i> Pipeline Activo
                    </h2>
                    
                    {pipeline.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                            <i className="fa-solid fa-filter text-3xl mb-2 opacity-50"></i>
                            <p className="text-sm">El pipeline está vacío</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {pipeline.map((stage, idx) => {
                                const max = Math.max(...pipeline.map(p => Number(p.monto))) || 1;
                                const percent = (Number(stage.monto) / max) * 100;
                                return (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                            {stage.etapa} 
                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs font-normal">{stage.cantidad} tratos</span>
                                        </span>
                                        <span className="font-bold text-slate-800">${Number(stage.monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Columna Derecha */}
                <div className="space-y-6">
                    {/* Leaderboard Equipo */}
                    {ranking.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-trophy text-yellow-500"></i> Leaderboard Equipo
                            </h2>
                            <ul className="space-y-4">
                                {ranking.map((vendedor, i) => (
                                    <li key={i} className="flex items-center gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                        <div className="relative">
                                            <img 
                                                src={vendedor.avatar_url || 'https://via.placeholder.com/40'} 
                                                alt={vendedor.nombre} 
                                                className="w-10 h-10 rounded-full object-cover border-2 border-yellow-300" 
                                            />
                                            {i === 0 && <span className="absolute -top-1 -right-1 text-yellow-500 text-xs"><i className="fa-solid fa-crown"></i></span>}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 text-sm">{vendedor.nombre}</p>
                                            <span className="text-xs text-slate-500">Cerrados: {vendedor.cerrados}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-yellow-600 text-lg">${Number(vendedor.monto || 0).toLocaleString('es-EC')}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Agenda */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i className="fa-regular fa-calendar text-blue-500"></i> Agenda Hoy
                        </h2>
                        {todayEvents.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-4">No tienes eventos hoy.</p>
                        ) : (
                            <ul className="space-y-4">
                                {todayEvents.map((evt, i) => (
                                    <li key={i} className="flex gap-3 items-start relative pl-4">
                                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-blue-500 rounded-full"></div>
                                        <div>
                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1 inline-block">
                                                {new Date(evt.fecha_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <p className="text-sm font-semibold text-slate-800 leading-tight">{evt.titulo}</p>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">{evt.tipo}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Cotizaciones Recientes */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-file-invoice text-purple-500"></i> Últimas Cotizaciones
                        </h2>
                        <div className="space-y-4">
                            {recentQuotes.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-4">Sin cotizaciones recientes.</p>
                            ) : recentQuotes.map((quote, i) => (
                            <div key={i} className="flex justify-between items-start border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors">
                                        {formatQuoteNumber(quote.no_cotizacion)}
                                    </p>
                                    <p className="text-xs text-slate-600 truncate max-w-[120px]" title={quote.nombre_cotizacion}>
                                        {quote.nombre_cotizacion}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{quote.vendedor}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-800">${Number(quote.total).toLocaleString('es-EC')}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-1 ${
                                        quote.estado_decision === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 
                                        quote.estado_decision === 'ACEPTADA' ? 'bg-emerald-100 text-emerald-700' : 
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {quote.estado_decision}
                                    </span>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

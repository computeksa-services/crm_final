import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import { BrandSpinner } from '../components/AppLoaders';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  AreaChart, Area 
} from 'recharts';

// --- TIPOS DE DATOS ---
type FinancialSummary = {
  ingreso_total?: number;
  por_cobrar?: number;
  transacciones_mes?: number;
  hidden?: boolean; 
};

type ResumenComercial = {
  venta_mes_actual?: number;
  venta_mes_anterior?: number;
  venta_total_historica?: number;
  pipeline_activo?: number;
  transacciones_mes?: number;
  crecimiento_porcentaje?: number;
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
  estado: string;
  fecha: string;
};

type CalendarEvent = {
  titulo: string;
  hora?: string;
  fecha_inicio?: string;
  tipo?: string | null;
};

type SalesByCompany = {
  nombre?: string;
  cliente?: string;
  total: number;
};

type SalesHistory = {
  mes: string;
  total: number;
};

type DashboardResponse = {
    perfil?: string;
    resumen_financiero?: FinancialSummary;
    resumen_comercial?: ResumenComercial;
    pipeline_ventas?: PipelineStage[];
    ventas_por_empresa?: SalesByCompany[];
    top_clientes?: SalesByCompany[];
    historial_ventas?: SalesHistory[];
    kpi_conversion?: number;
    cotizaciones_recientes?: QuoteSummary[];
    agenda_hoy?: CalendarEvent[];
    crecimiento?: {
        total_empresas?: number;
        total_contactos?: number;
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
    const [ventaMesActual, setVentaMesActual] = useState<number>(0);
    const [ventaMesAnterior, setVentaMesAnterior] = useState<number>(0);
    const [crecimientoPorcentaje, setCrecimientoPorcentaje] = useState<number>(0);
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
                const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/crm/v1/dashboard`;
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
                let finalData: any = null;
                if (Array.isArray(jsonRaw) && jsonRaw.length > 0) {
                    finalData = jsonRaw[0].data || jsonRaw[0];
                } else if (jsonRaw && typeof jsonRaw === 'object') {
                    finalData = jsonRaw.data || jsonRaw.get_crm_dashboard_kpi || jsonRaw;
                }
                if (finalData) {
                    // Actualiza permisos desde backend
                    user.module_access = finalData.permisos_usados || user.module_access;
                    // Usar resumen_comercial nuevo, con fallback a resumen_financiero antiguo
                    const resumenNew = finalData.resumen_comercial;
                    const resumenOld = finalData.resumen_financiero;
                    if (resumenNew) {
                        setFinancial({
                            ingreso_total: resumenNew.venta_total_historica || 0,
                            por_cobrar: resumenNew.pipeline_activo || 0,
                            transacciones_mes: resumenNew.transacciones_mes || 0
                        });
                        setVentaMesActual(resumenNew.venta_mes_actual || 0);
                        setVentaMesAnterior(resumenNew.venta_mes_anterior || 0);
                        setCrecimientoPorcentaje(resumenNew.crecimiento_porcentaje || 0);
                    } else {
                        setFinancial(resumenOld || DEFAULT_FINANCIAL);
                        setVentaMesActual(0);
                        setVentaMesAnterior(0);
                        setCrecimientoPorcentaje(0);
                    }
                    setPipeline(Array.isArray(finalData.pipeline_ventas) ? finalData.pipeline_ventas : []);
                    // Usar top_clientes nuevo, con fallback a ventas_por_empresa antiguo
                    const clientes = Array.isArray(finalData.top_clientes) ? finalData.top_clientes : [];
                    const empresas = Array.isArray(finalData.ventas_por_empresa) ? finalData.ventas_por_empresa : [];
                    setSalesByCompany(clientes.length > 0 ? clientes.map((c: any) => ({ nombre: c.cliente || c.nombre || '', total: c.total })) : empresas);
                    setSalesHistory(Array.isArray(finalData.historial_ventas) ? finalData.historial_ventas : []);
                    setRecentQuotes(Array.isArray(finalData.cotizaciones_recientes) ? finalData.cotizaciones_recientes : []);
                    setTodayEvents(Array.isArray(finalData.agenda_hoy) && finalData.agenda_hoy.length > 0 ? finalData.agenda_hoy : []);
                    setConversionRate(Number(finalData.kpi_conversion) || 0);
                    setGrowth({
                        total_empresas: typeof finalData.crecimiento?.total_empresas === 'number' ? finalData.crecimiento.total_empresas : 0,
                        total_contactos: typeof finalData.crecimiento?.total_contactos === 'number' ? finalData.crecimiento.total_contactos : 0
                    });
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
    if (!financial) return [];
    return [
      { 
        label: 'Ventas Este Mes', 
        value: `$${Number(ventaMesActual || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 
        icon: 'fa-calendar-check', 
        color: 'text-emerald-600',
        info: 'Cotizaciones ganadas en el mes actual'
      },
      { 
        label: 'Ventas Mes Anterior', 
        value: `$${Number(ventaMesAnterior || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 
        icon: 'fa-calendar', 
        color: 'text-blue-600',
        info: 'Cotizaciones ganadas el mes pasado'
      },
      { 
        label: 'Ingreso Total', 
        value: `$${Number(financial.ingreso_total || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 
        icon: 'fa-sack-dollar', 
        color: 'text-purple-600',
        info: 'Total ganado desde el inicio del sistema'
      },
      { 
        label: 'Pipeline Activo', 
        value: `$${Number(financial.por_cobrar || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 
        icon: 'fa-file-invoice-dollar', 
        color: 'text-amber-600',
        info: 'Cotizaciones en Borrador o Enviadas'
      },
    ];
  }, [financial, ventaMesActual, ventaMesAnterior]);

    return (
        <div className="pt-1 pb-3 px-3 md:pt-2 md:pb-6 md:px-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            {/* HEADER */}
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900">Bienvenido de nuevo, <span className="font-serif italic">{user?.name_user?.split(' ')[0]}</span></h1>
                </div>
                {/* KPIs Header */}
                {user?.module_access?.crm && (
                    <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
                        {/* Crecimiento */}
                        <div className="bg-white px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 md:gap-4 group relative flex-1 sm:flex-initial">
                            <div className={`${crecimientoPorcentaje >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
                                <i className={`fa-solid ${crecimientoPorcentaje >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-sm md:text-base`}></i>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">Crecimiento</p>
                                    <i className="fa-solid fa-circle-info text-[9px] md:text-[10px] text-slate-400 cursor-help"></i>
                                </div>
                                <p className={`text-base md:text-xl font-bold ${crecimientoPorcentaje >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {crecimientoPorcentaje > 0 ? '+' : ''}{crecimientoPorcentaje.toFixed(1)}%
                                </p>
                            </div>
                            <div className="absolute top-full mt-2 right-0 hidden group-hover:block w-56 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                                Variación de ventas vs. mes anterior
                            </div>
                        </div>
                        {/* Conversión */}
                        <div className="bg-white px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 md:gap-4 group relative flex-1 sm:flex-initial">
                            <div className="bg-indigo-50 text-indigo-600 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-chart-pie text-sm md:text-base"></i>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">Conversión</p>
                                    <i className="fa-solid fa-circle-info text-[9px] md:text-[10px] text-slate-400 cursor-help"></i>
                                </div>
                                <p className="text-base md:text-xl font-bold text-slate-900">{conversionRate}%</p>
                            </div>
                            <div className="absolute top-full mt-2 right-0 hidden group-hover:block w-56 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                                Porcentaje de cotizaciones ganadas vs. perdidas
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <BrandSpinner size="lg" className="mb-3" />
                    <p className="text-slate-500">Cargando información...</p>
                </div>
            ) : (
                <>
                    {/* 1. TARJETAS DE KPIs */}
                      {user?.module_access?.crm && metricCards.length > 0 && (
                                                <div
                                                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6"
                                                >
                            {/* Tarjetas comerciales */}
                                                        {metricCards.map((stat, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="bg-white flex flex-col p-3 md:p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-default min-w-0"
                                                            >
                                                                <div className="flex items-center gap-3 mb-2 min-w-0">
                                                                    <i className={`fa-solid ${stat.icon} ${stat.color} text-xl md:text-2xl flex-shrink-0`}></i>
                                                                    <p className="text-2xl font-bold text-slate-800 truncate">{stat.value}</p>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <p className="text-sm text-slate-500 font-medium truncate">{stat.label}</p>
                                                                    <div className="group relative flex-shrink-0">
                                                                        <i className="fa-solid fa-circle-info text-[10px] text-slate-400 cursor-help"></i>
                                                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                                                                            {stat.info}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                        </div>
                    )}

                    {/* 2. AGENDA HOY Y PIPELINE (2 COLUMNAS) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                        {/* Agenda */}
                        <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                <i className="fa-regular fa-calendar text-blue-500"></i> 
                                <span>Mi Agenda Hoy</span>
                                <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                    Eventos y reuniones programadas para hoy
                                </div>
                            </h2>
                            {todayEvents.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-4">No tienes eventos hoy.</p>
                            ) : (
                                <ul className="space-y-3 md:space-y-4">
                                    {todayEvents.map((evt, i) => (
                                        <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <span className="text-sm font-bold text-slate-800">{evt.titulo}</span>
                                            <span className="text-xs text-slate-500">{evt.hora || 'Sin hora'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Pipeline */}
                                                {user?.module_access?.crm && (
                                                    <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200 flex flex-col">
                                                        <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                                            <i className="fa-solid fa-funnel-dollar text-orange-500"></i> 
                                                            <span>Pipeline Activo</span>
                                                            <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                                            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                                                Estado y monto de las etapas en el proceso de ventas
                                                            </div>
                                                        </h2>
                                                        {pipeline.length === 0 ? (
                                                            <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                                                <i className="fa-solid fa-filter text-3xl mb-2 opacity-50"></i>
                                                                <p className="text-sm">El pipeline está vacío</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* Resumen total */}
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Etapas:</span>
                                                                        <span className="text-sm md:text-base font-bold text-orange-600">{pipeline.length}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total:</span>
                                                                        <span className="text-base md:text-lg font-bold text-emerald-600">
                                                                            ${pipeline.reduce((acc, s) => acc + (s.monto || 0), 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="divide-y divide-slate-100">
                                                                    {pipeline.map((stage, idx) => (
                                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 md:py-3 gap-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span
                                                                                    className={`inline-block px-2 py-1 rounded-full text-[10px] md:text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200`}
                                                                                >
                                                                                    {stage.etapa}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 md:gap-4">
                                                                                <span className="text-xs text-slate-500 font-medium">
                                                                                    <i className="fa-solid fa-handshake text-cyan-500 mr-1"></i> {stage.cantidad}
                                                                                </span>
                                                                                <span className="text-sm md:text-base font-bold text-slate-800">
                                                                                    ${stage.monto.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                    </div>

                    {/* 3. HISTORIAL DE VENTAS Y TOP PRODUCTOS (2 COLUMNAS) */}
                    {user?.module_access?.crm && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                            {/* Historial */}
                              {salesHistory.length > 0 && (
                                <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                        <i className="fa-solid fa-chart-line text-emerald-500"></i> 
                                        <span>Historial de Ventas</span>
                                        <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                        <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                            Evolución de ventas ganadas en los últimos meses
                                        </div>
                                    </h2>
                                    <div className="h-48 md:h-60 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={salesHistory} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                                                <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString('es-EC')}`, 'Ventas']} />
                                                <Area type="monotone" dataKey="total" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Top Productos */}
                              {topProducts.length > 0 && (
                                <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                        <i className="fa-solid fa-star text-yellow-500"></i> 
                                        <span>Top Productos</span>
                                        <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                        <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                            Productos más vendidos y su valor total
                                        </div>
                                    </h2>
                                    <div style={{ height: `${Math.max(topProducts.length * 60, 280)}px` }} className="w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                                <XAxis type="number" hide />
                                                <YAxis 
                                                    type="category" 
                                                    dataKey="producto" 
                                                    width={220} 
                                                    tick={{ fontSize: 12, fill: '#475569' }} 
                                                    interval={0}
                                                    tickFormatter={(value) => {
                                                        const maxLength = 30;
                                                        return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                                                    }}
                                                />
                                                <Tooltip 
                                                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-EC')}`, 'Ventas']} 
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    labelFormatter={(label) => label}
                                                />
                                                <Bar dataKey="total_ventas" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={35} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. TOP CLIENTES Y COTIZACIONES (2 COLUMNAS) */}
                    {user?.module_access?.crm && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                            {/* Top Clientes */}
                              {salesByCompany.length > 0 && (
                                <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2 group relative flex-wrap">
                                        <i className="fa-solid fa-building text-blue-500"></i> 
                                        <span>Top Clientes (Ventas)</span>
                                        <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                        <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                            Clientes que más dinero han generado
                                        </div>
                                    </h2>
                                    <div className="h-60 md:h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={salesByCompany} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="nombre" width={80} tick={{ fontSize: 10, fill: '#64748b' }} />
                                                <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString('es-EC')}`, 'Ventas']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Cotizaciones Recientes */}
                                                        <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                                            <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                                                <i className="fa-solid fa-file-invoice text-purple-500"></i> 
                                                                <span>Últimas Cotizaciones</span>
                                                                <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                                                <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                                                    Cotizaciones creadas recientemente con su estado
                                                                </div>
                                                            </h2>
                                                            {recentQuotes.length === 0 ? (
                                                                <p className="text-sm text-slate-400 italic text-center py-4">Sin cotizaciones recientes.</p>
                                                            ) : (
                                                                <div className="divide-y divide-slate-100">
                                                                    {recentQuotes.map((quote, i) => (
                                                                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                                                    <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                                                                        {formatQuoteNumber(quote.no_cotizacion)}
                                                                                    </span>
                                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                                                                                        quote.estado === 'ENVIADO' ? 'bg-amber-100 text-amber-700' :
                                                                                        quote.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-700' :
                                                                                        quote.estado === 'RECHAZADO' ? 'bg-rose-100 text-rose-700' :
                                                                                        'bg-slate-100 text-slate-700'
                                                                                    }`}>
                                                                                        {quote.estado}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-sm font-bold text-slate-800 truncate" title={quote.nombre_cotizacion}>
                                                                                    {quote.nombre_cotizacion}
                                                                                </span>
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="text-xs text-slate-500 truncate max-w-[150px]">{quote.vendedor}</span>
                                                                                    <span className="text-xs text-slate-400">•</span>
                                                                                    <span className="text-xs text-slate-400">{quote.fecha}</span>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-sm md:text-base font-bold text-emerald-600 whitespace-nowrap">${Number(quote.total).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                        </div>
                    )}

                    {/* 5. LEADERBOARD Y MARKETING (2 COLUMNAS) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {/* Leaderboard */}
                        {user?.module_access?.crm && ranking.length > 0 && (
                            <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                    <i className="fa-solid fa-trophy text-yellow-500"></i> 
                                    <span>Leaderboard Equipo</span>
                                    <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                        Ranking de vendedores por cotizaciones ganadas y monto total
                                    </div>
                                </h2>
                                <ul className="space-y-3 md:space-y-4">
                                    {ranking.map((vendedor, i) => (
                                        <li key={i} className="flex items-center gap-3 md:gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={vendedor.avatar_url || ''}
                                                    alt={vendedor.nombre}
                                                    className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-yellow-300"
                                                />
                                                {i === 0 && <span className="absolute -top-1 -right-1 text-yellow-500 text-xs"><i className="fa-solid fa-crown"></i></span>}
                                            </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="font-bold text-slate-800 text-sm truncate">{vendedor.nombre}</p>
                                                                                            <span className="text-xs text-slate-500">Cerrados: {vendedor.cerrados}</span>
                                                                                        </div>
                                                                                        <div className="text-right flex-shrink-0">
                                                                                              <span className="font-bold text-yellow-600 text-base md:text-lg">${Number(vendedor.monto || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</span>
                                                                                        </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Marketing */}
                        {user?.module_access?.marketing && (marketingData.campanas > 0 || marketingData.aperturas > 0 || marketingData.clics > 0) && (
                            <div className="bg-white p-4 md:p-6 rounded-lg md:rounded-xl shadow-sm border border-slate-200">
                                <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 group relative flex-wrap">
                                    <i className="fa-solid fa-bullhorn text-pink-500"></i> 
                                    <span>Marketing</span>
                                    <i className="fa-solid fa-circle-info text-xs text-slate-400 cursor-help"></i>
                                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10 font-normal">
                                        Métricas de campañas de email marketing
                                    </div>
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
                                            <i className="fa-solid fa-rectangle-ad text-xl"></i>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Campañas</p>
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
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;

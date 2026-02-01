import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FollowUpItem } from '../types';
import { apiFetch } from '../services/apiClient';
import { format, parseISO, isBefore, isToday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Phone, Mail, MessageSquare, Briefcase, ChevronRight, 
  LoaderCircle, User, LayoutGrid, List, 
  ArrowRightLeft, Rocket, Calendar, Search,
  AlertCircle, CheckCircle2, Clock, History, Building2
} from 'lucide-react';
import LogActionModal from '../components/LogActionModal';
import ReassignModal from '../components/ReassignModal';
import Toast from '../components/Toast';
import { useDataCache } from '../contexts/DataCacheContext';

// --- COMPONENTE DE TARJETA UNIFICADO (PROSPECTOS Y TRATOS) ---
const UnifiedFollowUpCard: React.FC<{ 
  item: FollowUpItem, 
  onManage: (item: FollowUpItem) => void,
  onTransfer: (item: FollowUpItem) => void,
  isAdmin: boolean 
}> = ({ item, onManage, onTransfer, isAdmin }) => {
    const navigate = useNavigate();
    const isDeal = item.entity_type === 'DEAL';
    
    // Lógica de Urgencia (Semáforo en Español)
    const getUrgency = (dateStr?: string | null) => {
        if (!dateStr) return { color: 'text-slate-400', bg: 'bg-slate-50', label: 'SIN FECHA', icon: <Clock size={12}/> };
        const date = parseISO(dateStr);
        const today = startOfDay(new Date());
        if (isBefore(date, today)) return { color: 'text-red-600', bg: 'bg-red-50', label: 'VENCIDO', icon: <AlertCircle size={12}/> };
        if (isToday(date)) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'HOY', icon: <Clock size={12}/> };
        return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'PROGRAMADO', icon: <CheckCircle2 size={12}/> };
    };

    const urgency = getUrgency(item.next_contact_date);
    const cleanPhone = (p: string | undefined) => p ? p.replace(/[^0-9]/g, '') : '';

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full overflow-hidden group">
            {/* 1-3. Card clickable area */}
            <div
                className="cursor-pointer flex flex-col flex-grow"
                onClick={e => {
                  // Evitar navegación si se hace click en el footer (botones)
                  if ((e.target as HTMLElement).closest('.card-footer')) return;
                  navigate(isDeal ? `/app/deals/${item.id_entity}` : `/app/client-contacts/${item.id_entity}`);
                }}
                style={{ minHeight: 0 }}
            >
                {/* 1. Banner de Estado */}
                <div 
                    className="px-4 py-2.5 flex items-center justify-between text-white font-black text-[10px] tracking-widest uppercase"
                    style={{ backgroundColor: item.category_color || '#64748b' }}
                >
                    <div className="flex items-center gap-2">
                        <i className={`${item.category_icon} text-xs opacity-90`} />
                        {item.status_category_label}
                    </div>
                    <span className="bg-black/10 px-2 py-0.5 rounded text-[9px] border border-white/20">
                        {item.current_status_name}
                    </span>
                </div>
                {/* 2. Información Principal */}
                <div className="p-5 border-b border-slate-50 flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 
                            className="font-black text-slate-800 text-sm leading-tight truncate group-hover:text-brand-600 transition-colors"
                        >
                            {item.title}
                        </h3>
                        <div 
                            className="flex items-center gap-1 mt-1.5 group-hover:text-brand-600 transition-colors group/subtitle"
                        >
                            <Building2 size={10} className="text-slate-300 group-hover/subtitle:text-brand-500" />
                            <p className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tighter">
                                {item.subtitle || 'Sin empresa vinculada'}
                            </p>
                        </div>
                    </div>
                    <img 
                        src={item.owner_avatar || `https://ui-avatars.com/api/?name=${item.owner_name}&background=random`} 
                        className="w-10 h-10 rounded-full border-2 border-white shadow-sm shrink-0" 
                        title={`Responsable: ${item.owner_name}`}
                    />
                </div>
                {/* 3. El ANTES y El DESPUÉS */}
                <div className="p-5 space-y-4 flex-grow bg-white">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <History size={10} /> Última Actividad
                                {/* Channel badge if present */}
                                {item.last_management_channel_name && (
                                    <span
                                        className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                                        style={{
                                            backgroundColor: item.last_management_channel_color || '#e5e7eb',
                                            color: '#fff',
                                        }}
                                        title={item.last_management_channel_name}
                                    >
                                        {item.last_management_channel_icon && (
                                            <i className={`${item.last_management_channel_icon} text-xs`} />
                                        )}
                                        {item.last_management_channel_name}
                                    </span>
                                )}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {item.last_management_date ? format(parseISO(item.last_management_date), "dd MMM", { locale: es }) : '--'}
                            </span>
                        </div>
                        <p className="text-[12px] text-slate-600 italic line-clamp-2 leading-relaxed">
                            {item.last_management_desc ? `"${item.last_management_desc}"` : 'No hay registros previos de gestión.'}
                        </p>
                    </div>
                    <div className={`${urgency.bg} ${urgency.color} p-4 rounded-xl border border-current border-opacity-10`}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-1.5">
                                {urgency.icon}
                                <span className="text-[10px] font-black tracking-widest">{urgency.label}</span>
                            </div>
                            <span className="text-[10px] font-black bg-white/60 px-2 py-0.5 rounded shadow-sm">
                                {item.next_contact_date ? format(parseISO(item.next_contact_date), "dd 'de' MMMM", { locale: es }) : '--'}
                            </span>
                        </div>
                        <p className="text-xs font-black leading-tight line-clamp-2 uppercase tracking-tight">
                            {item.next_action_desc || 'SIN ACCIÓN DEFINIDA'}
                        </p>
                    </div>
                </div>
            </div>
            {/* 4. Footer: Canales de comunicación y botón de Gestión */}
            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 mt-auto flex items-center justify-between gap-3 card-footer">
                <div className="flex gap-2">
                    {item.phone && (
                        <a href={`https://wa.me/${cleanPhone(item.phone)}`} target="_blank" rel="noreferrer" className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm transition-all">
                            <MessageSquare size={16}/>
                        </a>
                    )}
                    {item.email && (
                        <a href={`mailto:${item.email}`} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 shadow-sm transition-all">
                            <Mail size={16}/>
                        </a>
                    )}
                    {isAdmin && !isDeal && (
                        <button onClick={() => onTransfer(item)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-amber-500 shadow-sm transition-all" title="Reasignar">
                            <ArrowRightLeft size={16}/>
                        </button>
                    )}
                    {!isDeal && (
                        <button 
                            onClick={() => navigate(`/app/deals/new`, { 
                                state: { 
                                    contactId: item.id_contact || item.id_entity, 
                                    companyId: item.id_client_company, 
                                    is_conversion: true,
                                    contactName: item.title,
                                    contactEmail: item.email,
                                    contactPhone: item.phone,
                                    companyName: item.subtitle || item.name_company
                                } 
                            })}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl text-emerald-500 hover:bg-emerald-500 hover:text-white shadow-sm transition-all"
                            title="Convertir a Trato"
                        >
                            <Rocket size={16}/>
                        </button>
                    )}
                </div>
                <button 
                    onClick={() => onManage(item)} 
                    className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-100 active:scale-[0.97]"
                >
                    Gestionar<ChevronRight size={16}/>
                </button>
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
const FollowUpsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { users: cachedUsers } = useDataCache();

    const [items, setItems] = useState<FollowUpItem[]>([]);
    const [loading, setLoading] = useState(true);
    // Persisted state for tab and view
    const [activeTab, setActiveTab] = useState<'CONTACT' | 'DEAL'>(() => {
        return (localStorage.getItem('followups_activeTab') as 'CONTACT' | 'DEAL') || 'CONTACT';
    });
    const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
        return (localStorage.getItem('followups_viewMode') as 'grid' | 'table') || 'grid';
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [managingItem, setManagingItem] = useState<FollowUpItem | null>(null);
    const [transferItem, setTransferItem] = useState<FollowUpItem | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/crm/followups`);
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            setToast({ message: 'Error al conectar con el servidor', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);
    // Persist tab and view changes
    useEffect(() => {
        localStorage.setItem('followups_activeTab', activeTab);
    }, [activeTab]);
    useEffect(() => {
        localStorage.setItem('followups_viewMode', viewMode);
    }, [viewMode]);

    const filtered = useMemo(() => {
        return items.filter(i => i.entity_type === activeTab && 
            (i.title?.toLowerCase().includes(searchTerm.toLowerCase()) || i.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [items, activeTab, searchTerm]);

    if (loading) return <div className="flex h-[80vh] items-center justify-center"><LoaderCircle className="animate-spin text-brand-500" size={40} /></div>;


        return (
            <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 animate-in fade-in duration-500">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header compacto sin breadcrumb */}
                <div className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4 flex-wrap min-h-[64px]">
                  {/* Barra de búsqueda */}
                  <div className="relative flex items-center h-14 w-full max-w-[400px] flex-shrink">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                          type="text" 
                          placeholder={`Buscar en ${activeTab === 'CONTACT' ? 'prospectos' : 'negociaciones'}...`} 
                          className="w-full pl-12 pr-4 py-4 h-14 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-brand-50 focus:border-brand-500 shadow-sm transition-all"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{ height: '56px' }}
                      />
                  </div>
                  {/* Toggle grid/list */}
                  <div className="flex items-center h-14">
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm h-14 items-center">
                          <button onClick={() => setViewMode('grid')} className={`p-3 rounded-lg transition-all h-12 w-12 flex items-center justify-center ${viewMode === 'grid' ? 'bg-slate-100 text-brand-600' : 'text-slate-400'}`}><LayoutGrid size={22}/></button>
                          <button onClick={() => setViewMode('table')} className={`p-3 rounded-lg transition-all h-12 w-12 flex items-center justify-center ${viewMode === 'table' ? 'bg-slate-100 text-brand-600' : 'text-slate-400'}`}><List size={22}/></button>
                      </div>
                  </div>
                  {/* Tabs prospectos/negociaciones */}
                  <div className="flex items-center h-14">
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner h-14 items-center">
                          <button 
                              onClick={() => setActiveTab('CONTACT')} 
                              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all h-12 ${activeTab === 'CONTACT' ? 'bg-white text-brand-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <User size={14} /> PROSPECTOS
                          </button>
                          <button 
                              onClick={() => setActiveTab('DEAL')} 
                              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all h-12 ${activeTab === 'DEAL' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <Briefcase size={14} /> NEGOCIACIONES
                          </button>
                      </div>
                  </div>
                </div>

            {/* Grid Dinámico Responsive (1 a 4 columnas) */}
            {filtered.length === 0 ? (
                <div className="text-center py-36 bg-white rounded-[40px] border-2 border-dashed border-slate-100 shadow-sm">
                    <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-100"><Search size={48}/></div>
                    <h3 className="font-black text-slate-800 text-2xl tracking-tight">Sin seguimientos pendientes</h3>
                    <p className="text-slate-400 text-sm mt-2 uppercase font-bold tracking-widest">¡Excelente gestión diaria!</p>
                </div>
            ) : viewMode === 'grid' ? (
                                <div
                                    className="grid gap-6 min-w-0"
                                    style={{
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 350px))',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {filtered.map(item => (
                                        <div key={item.id_entity} className="w-full">
                                            <UnifiedFollowUpCard 
                                                item={item} 
                                                onManage={setManagingItem} 
                                                onTransfer={setTransferItem} 
                                                isAdmin={user?.rol_user === 'admin'} 
                                            />
                                        </div>
                                    ))}
                                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-6">Entidad / Empresa</th>
                                <th className="px-6 py-6">Estado del Pipeline</th>
                                <th className="px-6 py-6">Próxima Acción</th>
                                <th className="px-6 py-6">Responsable</th>
                                <th className="px-6 py-6 text-right">Gestión</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filtered.map(item => (
                                <tr key={item.id_entity} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${item.entity_type === 'DEAL' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {item.entity_type === 'DEAL' ? <Briefcase size={18}/> : <User size={18}/>}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 text-sm leading-tight">{item.title}</div>
                                                <div 
                                                    className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 cursor-pointer hover:text-brand-600"
                                                    onClick={() => item.id_client_company && navigate(`/app/companies/${item.id_client_company}`)}
                                                >
                                                    {item.subtitle}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-3 h-3 rounded-full shadow-sm border border-white" style={{ backgroundColor: item.category_color }} />
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider">{item.status_category_label}</span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.current_status_name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-black text-slate-700 uppercase leading-none mb-1.5">{item.next_action_desc}</div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                                            <Calendar size={12} />
                                            {item.next_contact_date ? format(parseISO(item.next_contact_date), "dd 'de' MMMM", { locale: es }) : '--'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 flex items-center gap-3">
                                        <img src={item.owner_avatar} className="w-8 h-8 rounded-full border border-slate-100 shadow-sm" />
                                        <span className="text-[11px] font-bold text-slate-600">{item.owner_name}</span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button onClick={() => setManagingItem(item)} className="p-3 text-brand-600 hover:bg-brand-50 rounded-2xl transition-all active:scale-90"><ChevronRight size={24}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modales Compartidos */}
            {managingItem && (
                <LogActionModal 
                    isOpen={!!managingItem} 
                    item={managingItem} 
                    onClose={() => setManagingItem(null)} 
                    onSuccess={() => { setManagingItem(null); fetchItems(); setToast({message: 'Gestión guardada exitosamente', type: 'success'}); }} 
                />
            )}
            
            {transferItem && (
                <ReassignModal 
                    isOpen={!!transferItem} 
                    contact={transferItem as any} 
                    users={cachedUsers} 
                    onClose={() => setTransferItem(null)} 
                    onSuccess={() => { setTransferItem(null); fetchItems(); setToast({message: 'Responsable actualizado correctamente', type: 'success'}); }} 
                />
            )}
        </div>
    );
};

export default FollowUpsPage;
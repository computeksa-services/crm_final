import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Deal, Quote, DealStatus } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';

import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import DealShareList from '../../components/DealShareList';
import DealEditModal from '../../components/DealEditModal';
import NewInteractionForm from '../../components/NewInteractionForm';

// --- HELPER: Obtener Iniciales (Nombre + Apellido) ---
const getInitials = (fullName?: string) => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// --- COMPONENTE: Selector de Estado (CORREGIDO PARA MÓVIL) ---
const StatusSelector: React.FC<{
  currentStatusId: string;
  statuses: DealStatus[];
  onSelect: (id: string) => void;
  disabled: boolean;
}> = ({ currentStatusId, statuses, onSelect, disabled }) => {
  // ...existing code for StatusSelector...
  return null; // placeholder, keep your actual StatusSelector code here
};

const DealDetail: React.FC = () => {
    const [confirmState, setConfirmState] = useState({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {},
      onCancel: () => {},
    });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshPermissions, setRefreshPermissions] = useState(0);
  const [refreshTimelineKey, setRefreshTimelineKey] = useState(0);
  const [isTimelineVisible, setIsTimelineVisible] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  const refreshShareCollaborators = useCallback(async () => {
    if (!deal) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${deal.id_trato}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      const list = Array.isArray(data) ? data : (data.users || []);
      const mapped = list.map((u: any) => {
        const level = (u.permission_level || '').toUpperCase();
        return {
          id_user: u.id_user,
          name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
          avatar: u.avatar_url || u.avatar || null,
          permission_level: level === 'NONE' ? 'BLOCKED' : level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        };
      });
      setShareCollaborators(mapped);
    } catch {
      setShareCollaborators([]);
    }
  }, [deal]);

  const refreshDealCollaborators = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) return;
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      const payload = Array.isArray(parsed) ? (parsed[0] || null) : parsed;
      const collaborators = Array.isArray(payload?.collaborators) ? payload.collaborators : [];
      setDeal(prev => (prev ? ({ ...(prev as any), collaborators } as any) : prev));
    } catch {
      // keep current state on error
    }
  }, [id, user?.id_tenant, user?.id_user]);

  const openShareModal = async () => {
    if (!deal) return;
    if (!shareCollaborators.length) {
      await refreshShareCollaborators();
    }
    setIsShareOpen(true);
  };
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!res.ok) throw new Error('Error de red');
      const text = await res.text();
      const parsed = text ? JSON.parse(text) : null;
      const payload = Array.isArray(parsed) ? (parsed[0] || null) : parsed;
      if (!payload) {
        setDeal(null);
        return;
      }
      // ...existing code de mapeo y setDeal...
      const mappedStatuses: DealStatus[] = (payload.catalogo_estados || []).map((s: any, idx: number) => ({
        id_status: s.id,
        id_tenant: tenantId,
        name: s.name,
        color: s.color,
        status_order: idx,
        icon: s.icon || 'fa-solid fa-circle',
        is_default: false
      }));
      const mappedQuotes: Quote[] = (payload.cotizaciones_activas || []).map((q: any) => ({
        id_cotizacion: q.id,
        id_tenant: tenantId,
        id_user: payload.owner_id,
        id_client_company: payload.empresa_cliente?.id || '',
        id_contact: payload.contacto_cliente?.id || '',
        no_cotizacion: Number(q.numero) || 0,
        formatted_no_cotizacion: q.numero,
        nombre_cotizacion: q.nombre,
        fecha_emision: q.fecha, 
        total: String(q.total),
        version: 1,
        id_quote_status: '', 
        id_trato: payload.id_trato,
        is_private: false,
        estado: q.estado,
        estado_color: q.color_estado,
        client_company_name: payload.empresa_cliente?.name,
        contact_full_name: payload.contacto_cliente?.name,
      }));
      const mappedDeal: Deal = {
        id_trato: payload.id_trato,
        id_tenant: payload.id_tenant || tenantId,
        id_user_owner: payload.owner_id,
        id_user: payload.owner_id,
        id_client_company: payload.empresa_cliente?.id || '',
        id_contact: payload.contacto_cliente?.id || '',
        id_deal_status: payload.estado_actual?.id || '',
        id_interest: payload.interes_actual?.id || '',
        nombre_trato: payload.nombre_trato,
        valor_trato: payload.valor_numeric,
        created_at_fmt: payload.created_at_fmt,
        updated_at: payload.updated_at_fmt,
        access_level: payload.access_level,
        client_company_name: payload.empresa_cliente?.name,
        contact_full_name: payload.contacto_cliente?.name,
        contact_email: payload.contacto_cliente?.email,
        contact_phone: payload.contacto_cliente?.phone,
        contact_position: payload.contacto_cliente?.position,
        owner_name: payload.owner_details?.name,
        owner_avatar: payload.owner_details?.avatar,
        interes_nombre: payload.interes_actual?.name,
        interes_color: payload.interes_actual?.color,
        interes_icon: payload.interes_actual?.icon,
      };
      (mappedDeal as any).collaborators = Array.isArray(payload.collaborators) ? payload.collaborators : [];
      setDeal(mappedDeal);
      setQuotes(mappedQuotes);
      setDealStatuses(mappedStatuses);
      
      // Load collaborators from response
      if (payload?.collaborators && Array.isArray(payload.collaborators)) {
        const mapped = payload.collaborators.map((u: any) => ({
          id_user: u.id_user,
          name: u.name || u.name_user || u.full_name || u.email || 'Usuario',
          avatar: u.avatar || u.avatar_url || null,
          permission_level: (u.permission_level || '').toUpperCase() === 'NONE' ? 'BLOCKED' : u.permission_level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        }));
        setShareCollaborators(mapped);
      }
      
      navigate(location.pathname, { 
        state: { breadcrumb: mappedDeal.nombre_trato }, 
        replace: true 
      });
    } catch (e) {
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id_tenant, user?.id_user, location.pathname]);

  // Carga del historial (muro de actividad)
  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const url = buildUrl(GATEWAY_CONFIG.API.DEALS.HISTORY, { id_trato: id });
      const response = await apiFetch(url);
      // El backend ya debe devolver el array de interacciones directamente
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleStatusChange = (newStatusId: string) => {
    if (!deal) return;
    const newStatus = dealStatuses.find(s => s.id_status === newStatusId);
    
    setConfirmState({
      isOpen: true,
      title: 'Actualizar Estado',
      message: `¿Cambiar el estado del trato a "${newStatus?.name}"?`,
      onConfirm: async () => {
        setConfirmState(prev => ({...prev, isOpen: false}));
        setProcessing(true);
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_trato: deal.id_trato,
              id_deal_status: newStatusId,
              id_tenant: user?.id_tenant,
              id_user: user?.id_user
            })
          });
          if (!res.ok) throw new Error();
          
          setDeal(prev => prev ? {
            ...prev, 
            id_deal_status: newStatusId,
            estado_nombre: newStatus?.name,
            estado_color: newStatus?.color,
            estado_icon: newStatus?.icon
          } : null);
          
          setToast({ message: 'Estado actualizado.', type: 'success' });
        } catch {
          setToast({ message: 'No se pudo actualizar el estado.', type: 'error' });
        } finally {
          setProcessing(false);
        }
      },
      onCancel: () => setConfirmState(prev => ({...prev, isOpen: false}))
    });
  };

  const formatCurrency = (val: string | number | undefined) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (num === undefined || isNaN(num)) return '$0.00';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };


  if (loading) return (
    <div className="flex h-[calc(100vh-200px)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
        <p className="text-slate-400 font-medium animate-pulse">Cargando información del trato...</p>
      </div>
    </div>
  );

  if (!deal && !loading) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <h2 className="text-xl font-bold text-slate-800">Trato no encontrado o error de conexión</h2>
        <p className="text-slate-400 mb-4">Verifica tu conexión o intenta de nuevo.</p>
        <button onClick={() => navigate('/app/deals')} className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all">
            Volver
        </button>
    </div>
  );

  const canEdit = deal.access_level === 'EDIT' || user?.rol_user === 'admin';

  return (
    <div className="w-full px-4 md:px-6 pb-20 animate-fade-in font-sans">
      
      {/* --- HEADER PRINCIPAL --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            
            {/* Lado Izquierdo: Info Principal */}
            <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                        {deal.nombre_trato}
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm pl-1">
                    <Link to={`/app/client-companies/${deal.id_client_company}`} className="flex items-center gap-2 group px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                        <i className="fa-solid fa-building text-slate-400"></i>
                        <span className="font-semibold text-slate-600 group-hover:text-brand-600 transition-colors">{deal.client_company_name}</span>
                    </Link>
                </div>
            </div>

            {/* Lado Derecho: Acciones y Valor */}
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
                <div className="text-left lg:text-right w-full lg:w-auto">
                    <div className="text-3xl font-mono font-bold text-slate-800 tracking-tight">
                        {formatCurrency(deal.valor_trato)}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    {/* Selector de Estado */}
                    <StatusSelector 
                        currentStatusId={deal.id_deal_status || ''} 
                        statuses={dealStatuses} 
                        onSelect={handleStatusChange} 
                        disabled={!canEdit || processing}
                    />

                    {canEdit && (
                        <>
                            <button 
                                onClick={() => setIsEditModalOpen(true)}
                                className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-pen"></i> Editar
                            </button>
                            <button 
                                onClick={openShareModal}
                                className="flex-1 sm:flex-none px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-share-nodes"></i> Compartir
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* --- GRID DE CONTENIDO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: Info (1/3) */}
        <div className="space-y-6">
            
            {/* TARJETA: Contacto Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    <div>
                    <h3 className="font-bold text-slate-800 text-sm">Historial de Interacciones</h3>
                        <p className="text-xs text-slate-500">Persona a cargo</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                    {deal.contact_full_name ? (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200 shrink-0">
                                {getInitials(deal.contact_full_name)}
                            </div>
                            <div className="min-w-0">
                                <Link to={`/app/client-contacts/${deal.id_contact}`} className="font-bold text-slate-800 text-[15px] hover:text-brand-600 hover:underline transition-colors block">
                                    {deal.contact_full_name}
                                </Link>
                                <p className="text-[13px] text-slate-500 truncate">{deal.contact_position || 'Sin cargo'}</p>
                                <div className="mt-2 space-y-1">
                                    {deal.contact_email && (
                                        <div className="flex items-center gap-2 text-[13px] text-slate-600">
                                            <i className="fa-solid fa-envelope text-slate-400"></i>
                                            <span className="truncate">{deal.contact_email}</span>
                                        </div>
                                    )}
                                    {deal.contact_phone && (
                                        <div className="flex items-center gap-2 text-[13px] text-slate-600">
                                            <i className="fa-solid fa-phone text-slate-400"></i>
                                            <span>{deal.contact_phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">No hay contacto asignado</p>
                    )}
                </div>
            </div>

            {/* TARJETA: Detalles del Trato */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Detalles</h3>
                        <p className="text-xs text-slate-500">Información general</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                    {/* Owner */}
                    <div className="flex items-center gap-3">
                        <img 
                            src={deal.owner_avatar || `https://ui-avatars.com/api/?name=${deal.owner_name}&background=random`} 
                            alt="Owner" 
                            className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                        />
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Creado por</p>
                          <p className="text-[14px] font-bold text-slate-700">{deal.owner_name}</p>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interés</p>
                      <div className="inline-flex items-center gap-1.5">
                            <i className={`${deal.interes_icon || 'fa-solid fa-circle'} text-xs`} style={{ color: deal.interes_color }}></i>
                            <span className="text-[13px] font-bold text-slate-700">{deal.interes_nombre || 'No definido'}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fechas</p>
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Creado:</span>
                            <span className="text-[12px] font-medium text-slate-700">{deal.created_at_fmt || '-'}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block">Actualizado:</span>
                            <span className="text-[12px] font-medium text-slate-700">{deal.updated_at || '-'}</span>
                          </div>
                      </div>
                    </div>
                </div>
            </div>

            {/* TARJETA: Colaboradores (AGREGADO BOTÓN COMPARTIR) */}
            {canEdit && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Asignaciones</h3>
                      </div>
                      <button
                        onClick={openShareModal}
                        disabled={deal.access_level !== 'EDIT' && user?.rol_user !== 'admin'}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                          (deal.access_level === 'EDIT' || user?.rol_user === 'admin')
                          ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          : 'text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <i className="fa-solid fa-plus"></i>Asignar
                      </button>
                    </div>
                    <div className="p-4">
                      {(deal as any).collaborators && (deal as any).collaborators.length > 0 ? (
                        <div className="space-y-2">
                          {(deal as any).collaborators.map((collaborator: any) => (
                            <div key={collaborator.id_user} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                {collaborator.avatar ? (
                                  <img src={collaborator.avatar} alt={collaborator.name} className="w-6 h-6 rounded-full border border-slate-200" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                    {(collaborator.name || 'U').charAt(0)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-700 truncate flex items-center gap-2">
                                    {collaborator.name}
                                    {(collaborator.rol_user || '').toLowerCase() === 'admin' && (
                                      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] text-amber-500 leading-none align-middle" title="Control total por admin">
                                        <i className="fa-solid fa-star"></i>
                                      </span>
                                    )}
                                    {(collaborator.permission_level || '').toUpperCase() === 'OWNER' || collaborator.is_owner ? (
                                      <span className="text-[10px] text-slate-400">(Creador)</span>
                                    ) : null}
                                  </p>
                                  <p className="text-slate-400 truncate">
                                    {(() => {
                                      const level = (collaborator.permission_level || '').toUpperCase();
                                      if (level === 'OWNER' || level === 'EDIT') return 'Asignación principal';
                                      if (level === 'VIEW') return 'Asignación secundaria';
                                      return 'Sin asignación';
                                    })()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-2">Sin asignaciones</p>
                      )}
                    </div>
                </div>
            )}

        </div>

        {/* COLUMNA DERECHA: Contenido (2/3) */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* SECCIÓN: COTIZACIONES */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                Cotizaciones 
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs">{quotes.length}</span>
                            </h3>
                            <p className="text-xs text-slate-500">Documentos financieros</p>
                        </div>
                    </div>
                    {canEdit && (
                        <button 
                            onClick={() => navigate(`/app/quotes/new?dealId=${deal.id_trato}&clientCompanyId=${deal.id_client_company}&contactId=${deal.id_contact}&dealName=${encodeURIComponent(deal.nombre_trato || '')}`)}
                            className="text-[13px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded shadow-sm transition-all"
                        >
                            + Nueva Cotización
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {quotes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {quotes.map(quote => (
                                <Link 
                                    key={quote.id_cotizacion}
                                    to={`/app/quotes/${quote.id_cotizacion}`}
                                    className="group block bg-slate-50 rounded-xl border border-slate-200 p-4 hover:bg-white hover:shadow-md hover:border-brand-200 transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-white text-slate-400 flex items-center justify-center shrink-0 border border-slate-100 group-hover:text-brand-500">
                                                <i className="fa-solid fa-file-invoice text-lg"></i>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-700 text-[15px] group-hover:text-brand-600 transition-colors">
                                                    Cotización #{quote.formatted_no_cotizacion || String(quote.no_cotizacion).padStart(4,'0')}
                                                </h3>
                                                <p className="text-xs text-slate-500">{quote.nombre_cotizacion || 'Sin nombre'}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[13px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <i className="fa-regular fa-calendar text-[11px]"></i> {quote.fecha_emision}
                                                    </span>
                                                    <span className="font-mono bg-white border border-slate-200 px-1.5 rounded text-[11px]">v{quote.version}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-700 text-[17px]">{formatCurrency(quote.total)}</p>
                                            <span 
                                                className="text-[11px] font-bold uppercase inline-block mt-1 px-2 py-0.5 rounded border"
                                                style={{ 
                                                    color: quote.estado_color || '#64748b',
                                                    borderColor: `${quote.estado_color || '#64748b'}30`,
                                                    backgroundColor: `${quote.estado_color || '#64748b'}10`
                                                }}
                                            >
                                                {quote.estado}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                                <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
                            </div>
                            <p className="text-[15px] text-slate-500">No hay cotizaciones activas.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN: HISTORIAL DE INTERACCIONES */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <div className="p-6 pb-0">
                <NewInteractionForm
                  entityId={deal.id_trato}
                  entityType="DEAL"
                  onSuccess={() => {
                    setToast({ message: 'Actividad registrada.', type: 'success' });
                    setRefreshTimelineKey(prev => prev + 1);
                    fetchHistory();
                    setIsTimelineVisible(true);
                  }}
                />
              </div>

              <div 
                className="px-6 py-4 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsTimelineVisible(!isTimelineVisible)}
              >
                <h3 className="font-bold text-slate-800">Historial de Interacciones</h3>
                <button className="text-slate-500 hover:text-slate-700 p-1">
                  <i className={`fa-solid fa-chevron-down text-sm transition-transform duration-200 ${isTimelineVisible ? '' : '-rotate-90'}`}></i>
                </button>
              </div>

              {isTimelineVisible && (
                <div className="p-6 pt-4">
                  {history && history.length > 0 ? (
                    <div className="space-y-8">
                      {(() => {
                        // Ordenar: todos menos antecedentes, luego antecedentes
                        const antecedentes = history.filter(g => g.group_id === 'FASE_PROSPECCION');
                        const otros = history.filter(g => g.group_id !== 'FASE_PROSPECCION');
                        const ordered = [...otros, ...antecedentes];
                        return ordered.map((group, gIdx) => (
                          <div key={group.group_id || gIdx} className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 bg-white rounded-t-xl">
                              <span className={`w-2 h-6 rounded-full ${group.group_id === 'FASE_NEGOCIACION' ? 'bg-emerald-500' : 'bg-blue-400'}`}></span>
                              <h4 className="font-bold text-slate-800 text-sm">{group.group_name}</h4>
                            </div>
                            <div className="p-4 space-y-4">
                              {Array.isArray(group.interactions) && group.interactions.length > 0 ? (
                                group.interactions.map((item, idx) => {
                                  const interactionType = item.type;
                                  // Estilo por fase
                                  const strongStyle = item.is_deal_interaction ? 'border-emerald-200 bg-white' : 'border-slate-100 bg-slate-50';
                                  const textStyle = item.is_deal_interaction ? 'text-slate-800' : 'text-slate-500';
                                  return (
                                    <div key={item.id || idx} className={`flex items-start gap-3 border-l-4 ${strongStyle} rounded-lg p-3 group relative`}>
                                      {/* Solo avatar, sin icono superpuesto */}
                                      <div className="relative w-9 h-9">
                                        <img
                                          src={item.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user_name || 'S')}&background=random`}
                                          alt="avatar"
                                          className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-bold text-sm truncate ${textStyle}`}>{item.user_name || 'Sistema'}</span>
                                          <span className="text-xs text-slate-400">{item.date_fmt}</span>
                                          {/* Channel Badge */}
                                          {item.channel_name && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1" style={{ background: item.channel_color || '#e0e7ff', color: item.channel_color ? '#fff' : '#374151' }}>
                                              {item.channel_icon && <i className={`${item.channel_icon} text-xs mr-1`}></i>}
                                              {item.channel_name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-1">
                                          {interactionType === 'SYSTEM' ? (
                                            <div className="italic text-slate-400 text-[14px] flex items-center gap-2">
                                              <i className="fa-solid fa-gear"></i>
                                              {item.description}
                                            </div>
                                          ) : (
                                            <>
                                              <div className={`text-[15px] whitespace-pre-line ${textStyle}`}>{item.description}</div>
                                              {/* Mostrar acción y fecha planificada si existen, igual que en contactos */}
                                              {(item.planned_action || item.planned_date) && (
                                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                                  <i className="fa-solid fa-arrow-right text-slate-400"></i>
                                                  <span className="font-semibold">Siguiente acción:</span>
                                                  {item.planned_action && <span>{item.planned_action}</span>}
                                                  {item.planned_date && <span className="ml-2">({item.planned_date})</span>}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-center py-4 text-slate-400 italic text-sm">No hay actividad registrada en esta fase.</div>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <i className="fa-solid fa-clock-rotate-left text-slate-200 text-3xl mb-2"></i>
                      <p className="text-[13px] text-slate-400 italic">No hay actividad registrada aún.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

        </div>
      </div>

      {/* --- MODALES --- */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={confirmState.onCancel}
        />
      )}

      {isShareOpen && deal && (
        <ShareModal
          entity="deal"
          id={deal.id_trato}
          entityName={deal.nombre_trato || `Trato #${deal.id_trato}`}
          creatorName={deal.owner_name || ''}
          isOpen={isShareOpen}
          onClose={() => { setIsShareOpen(false); }}
          onShared={() => {
            setToast({ message: 'Asignaciones actualizadas.', type: 'success' });
            refreshShareCollaborators();
            refreshDealCollaborators();
          }}
          currentCollaborators={shareCollaborators}
        />
      )}

      {deal && (
        <DealEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={deal}
          onSuccess={(updatedDeal) => {
            setDeal(updatedDeal);
            setIsEditModalOpen(false);
            setToast({ message: 'Trato actualizado.', type: 'success' });
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default DealDetail;
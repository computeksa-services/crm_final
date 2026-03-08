import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Deal, Quote, DealStatus } from '../../types';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';
import { getImageUrl, getLocalAvatarDataUrl } from '../../utils/imageUtils';

import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import ShareModal from '../../components/ShareModal';
import SelectWinningQuoteModal from '../../components/SelectWinningQuoteModal';
import NewInteractionModal from '../../components/NewInteractionModal';

// --- SKELETON LOADER ---
const DealDetailSkeleton = () => (
  <div className="min-h-screen bg-[#F9F9F8] pb-20 animate-pulse">
    <header className="bg-white border-b border-zinc-200 pt-6 pb-6">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-start">
          <div className="w-1/2 space-y-3">
            <div className="h-8 bg-zinc-200 rounded-lg w-3/4"></div>
            <div className="h-5 bg-zinc-100 rounded-md w-1/4"></div>
          </div>
          <div className="w-1/4 flex flex-col items-end space-y-2">
            <div className="h-4 bg-zinc-100 rounded w-1/3"></div>
            <div className="h-8 bg-zinc-200 rounded w-2/3"></div>
          </div>
        </div>
        <div className="mt-8 flex gap-2.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-1 h-1.5 bg-zinc-200 rounded-full"></div>
          ))}
        </div>
      </div>
    </header>
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <aside className="lg:col-span-4 space-y-8">
        <div className="space-y-4">
          <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-zinc-100 rounded-lg w-full"></div>
          ))}
        </div>
      </aside>
      <section className="lg:col-span-8 space-y-6">
        <div className="flex gap-6 border-b border-zinc-200 pb-3">
          <div className="h-5 bg-zinc-200 rounded w-32"></div>
          <div className="h-5 bg-zinc-100 rounded w-24"></div>
        </div>
        <div className="h-20 bg-white border border-zinc-200 rounded-xl"></div>
        <div className="space-y-4 pt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white border border-zinc-200 rounded-xl ml-10 relative">
              <div className="absolute -left-10 top-2 w-8 h-8 rounded-full bg-zinc-200"></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  </div>
);

// --- HELPER: Obtener Iniciales (Nombre + Apellido) ---
const getInitials = (fullName?: string) => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// --- HELPER: Formato Moneda ---
const formatCurrency = (val: string | number | undefined) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num === undefined || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// --- COMPONENTE: Selector de Estado Minimalista ---
const StatusSelector: React.FC<{
  currentStatusId: string;
  statuses: DealStatus[];
  onSelect: (id: string) => void;
  disabled: boolean;
}> = ({ currentStatusId, statuses, onSelect, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const current = statuses.find(s => s.id_status === currentStatusId) || {
    id_status: '', name: 'Sin estado', color: '#94a3b8', category: 'DRAFT'
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  },[]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white text-zinc-700 border border-zinc-200 shadow-sm transition-colors uppercase ${disabled ? 'opacity-70 cursor-not-allowed' : 'group hover:border-zinc-300'}`}
      >
        <div className="flex items-center gap-1.5 truncate">
            <i className="fa-solid fa-circle text-[8px]" style={{ color: current.color }}></i>
            <span className="truncate">{current.name}</span>
        </div>
        {!disabled && <i className="fa-solid fa-chevron-down text-[8px] text-zinc-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>}
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 overflow-hidden animate-fade-in py-1">
          <div className="max-h-60 overflow-y-auto">
            {statuses.map(status => (
              <button
                key={status.id_status}
                onClick={() => { onSelect(status.id_status); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center justify-between transition-colors border-b border-zinc-50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle text-[8px]" style={{ color: status.color }}></i>
                  <span className="text-[11px] font-bold text-zinc-700 uppercase">{status.name}</span>
                </div>
                {status.id_status === currentStatusId && <i className="fa-solid fa-check text-[10px] text-zinc-400"></i>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE: Selector de Interés Minimalista ---
const InterestSelector: React.FC<{
  currentInterestId: string;
  interests: any[];
  onSelect: (id: string) => void;
  disabled: boolean;
}> = ({ currentInterestId, interests, onSelect, disabled }) => {
  const[isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const current = interests.find(i => i.id_interest === currentInterestId) || {
    id_interest: '', name: 'Sin interés', color: '#94a3b8', icon: 'fa-solid fa-circle'
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  },[]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2 py-0.5 rounded-md text-[11px] font-semibold border border-transparent transition-colors uppercase ${disabled ? 'opacity-70 cursor-not-allowed' : 'group hover:border-zinc-200 hover:bg-white text-zinc-600'}`}
        style={{ color: current.color || '#52525b' }}
      >
        <div className="flex items-center gap-1.5 truncate">
            <i className={`${current.icon || 'fa-solid fa-circle'} text-[10px]`}></i>
            <span className="truncate">{current.name}</span>
        </div>
        {!disabled && <i className="fa-solid fa-chevron-down text-[8px] text-zinc-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>}
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 overflow-hidden animate-fade-in py-1">
          <div className="max-h-60 overflow-y-auto">
            {interests.map(interest => (
              <button
                key={interest.id_interest}
                onClick={() => { onSelect(interest.id_interest); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 transition-colors border-b border-zinc-50 last:border-0"
              >
                <i className={`${interest.icon || 'fa-solid fa-circle'} text-[10px]`} style={{ color: interest.color }}></i>
                <span className="text-[11px] font-bold text-zinc-700 uppercase">{interest.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DealDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dealStatuses: cachedDealStatuses, dealInterests: cachedDealInterests, companies: cachedCompanies, contacts: cachedContacts, users: cachedUsers } = useDataCache();
  
  const routeParams = useParams<{ id: string }>();
  const queryParams = new URLSearchParams(location.search);
  const id = routeParams.id || queryParams.get('id');

  const [deal, setDeal] = useState<Deal | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const[dealStatuses, setDealStatuses] = useState<DealStatus[]>([]);
  const[loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const[activeTab, setActiveTab] = useState<'activity'|'quotes'|'files'>('activity');
  const[toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const[shareCollaborators, setShareCollaborators] = useState<any[]>([]);
  
  const[history, setHistory] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const[showNewInteractionModal, setShowNewInteractionModal] = useState(false);
  const [refreshTimelineKey, setRefreshTimelineKey] = useState(0);

  const[confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '' as React.ReactNode, onConfirm: () => {}, onCancel: () => {} });
  const[selectWinnerModal, setSelectWinnerModal] = useState({ isOpen: false, pendingStatusId: '' });

  const refreshShareCollaborators = useCallback(async () => {
    if (!deal) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/share?id_trato=${deal.id_trato}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) :[];
      const list = Array.isArray(data) ? data : (data.users ||[]);
      const mapped = list.map((u: any) => ({
        id_user: u.id_user,
        name: u.name_user || u.name || u.full_name || u.email || 'Usuario',
        avatar: u.avatar_url || u.avatar || null,
        permission_level: (u.permission_level || 'NONE').toUpperCase() === 'NONE' ? 'BLOCKED' : (u.permission_level || '').toUpperCase(),
        rol_user: u.rol_user,
        is_owner: u.is_owner
      }));
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
      const parsed = JSON.parse(await res.text());
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      setDeal(prev => prev ? { ...prev, collaborators: payload?.collaborators ||[] } as any : prev);
    } catch {}
  },[id, user?.id_tenant, user?.id_user]);

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/deals/detail?id_trato=${id}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const parsed = JSON.parse(await res.text());
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      
      if (!payload) { setDeal(null); return; }

      const mappedStatuses: DealStatus[] = (payload.catalogo_estados ||[]).map((s: any, idx: number) => ({
        id_status: s.id,
        id_tenant: user.id_tenant,
        name: s.name,
        color: s.color,
        status_order: idx,
        icon: s.icon || 'fa-solid fa-circle',
        is_default: false,
        status_category: s.status_category || s.category || 'PROGRESS',
        notify_client: s.notify_client || false
      }));

      const quotesRaw = payload.cotizaciones_activas || payload.cotizaciones || payload.quotes || [];
      const mappedQuotes: Quote[] = quotesRaw.map((q: any) => ({
        id_cotizacion: q.id || q.id_cotizacion,
        id_tenant: user.id_tenant,
        id_user: payload.owner_id,
        id_client_company: payload.id_client_company || '',
        id_contact: payload.id_contact || '',
        no_cotizacion: Number(q.numero || q.no_cotizacion) || 0,
        formatted_no_cotizacion: q.numero || q.formatted_no_cotizacion,
        nombre_cotizacion: q.nombre || q.nombre_cotizacion,
        fecha_emision: q.fecha || q.fecha_emision, 
        total: String(q.total || 0),
        version: q.version || 1,
        id_quote_status: q.id_quote_status || '', 
        id_trato: payload.id_trato,
        estado: q.estado || q.estado_nombre,
        estado_color: q.color_estado || q.estado_color,
      }));

      const cachedCompany = cachedCompanies?.find((c: any) => String(c.id_client_company) === String(payload.id_client_company));
      const cachedContact = cachedContacts?.find((c: any) => String(c.id_contact) === String(payload.id_contact));
      const contactName = cachedContact ?[cachedContact.first_name, cachedContact.last_name].filter(Boolean).join(' ') || cachedContact.email : '';

      const mappedDeal: any = {
        ...payload,
        client_company_name: cachedCompany?.name_company || payload.client_company_name || 'Empresa Desconocida',
        contact_full_name: contactName || payload.contact_full_name || payload.contact_email || 'Sin Contacto',
        estado_actual: {
          id: payload.estado_actual?.id || '',
          name: payload.estado_actual?.name || '',
          color: payload.estado_actual?.color || '#94a3b8',
          category: payload.estado_actual?.category || 'PROGRESS'
        },
        interes_actual: {
          id: payload.interes_actual?.id || '',
          icon: payload.interes_actual?.icon || 'fa-solid fa-circle',
          name: payload.interes_actual?.name || '',
          color: payload.interes_actual?.color || '#94a3b8'
        },
        catalogo_estados: mappedStatuses.length ? mappedStatuses : cachedDealStatuses,
      };

      setDeal(mappedDeal);
      setQuotes(mappedQuotes);
      setDealStatuses(mappedStatuses.length ? mappedStatuses : cachedDealStatuses);
      if (payload?.historial_envios) setEmailHistory(payload.historial_envios);
      
    } catch (e) {
      setToast({ message: 'Error al cargar detalles.', type: 'error' });
      setDeal(null);
    } finally {
      setLoading(false);
    }
  },[id, user, cachedCompanies, cachedContacts, cachedDealStatuses]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.DEALS.HISTORY, { id_trato: id }));
      setHistory(Array.isArray(await res.json()) ? await res.json() : []);
    } catch { setHistory([]); }
  },[id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchHistory(); },[fetchHistory, refreshTimelineKey]);

  useEffect(() => {
    if (location.state?.refresh) {
      fetchData();
    }
  }, [location.state, fetchData]);

  const handleStatusChange = (newStatusId: string) => {
    if (!deal || newStatusId === deal.estado_actual?.id) return;
    const newStatus = dealStatuses.find(s => s.id_status === newStatusId);
    
    const isWonStatus = newStatus?.status_category === 'WON' || newStatus?.name?.toUpperCase().includes('GANADO');
    
    if (isWonStatus && quotes.length > 0) {
      setSelectWinnerModal({ isOpen: true, pendingStatusId: newStatusId });
      return;
    }
    
    setConfirmState({
      isOpen: true,
      title: 'Actualizar Estado',
      message: (
        <div className="space-y-3 text-sm">
          <p>¿Cambiar el estado del trato a <span className="font-bold">"{newStatus?.name}"</span>?</p>
          {newStatus?.notify_client && (
            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded text-blue-800">
              <i className="fa-solid fa-envelope"></i> Se notificará al cliente por correo.
            </div>
          )}
        </div>
      ),
      onConfirm: async () => {
        setConfirmState(prev => ({...prev, isOpen: false}));
        setProcessing(true);
        try {
          const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: newStatusId, id_tenant: user?.id_tenant, id_user: user?.id_user })
          });
          if (!res.ok) throw new Error();
          setDeal(prev => prev ? { ...prev, estado_actual: { id: newStatusId, name: newStatus?.name, color: newStatus?.color, category: newStatus?.status_category } } as any : null);
          setToast({ message: 'Estado actualizado.', type: 'success' });
        } catch {
          setToast({ message: 'Error al actualizar el estado.', type: 'error' });
        } finally { setProcessing(false); }
      },
      onCancel: () => setConfirmState(prev => ({...prev, isOpen: false}))
    });
  };

  const handleInterestChange = (newInterestId: string) => {
    if (!deal) return;
    const newInterest = cachedDealInterests?.find((i: any) => i.id_interest === newInterestId);
    setConfirmState({
      isOpen: true, title: 'Actualizar Interés', message: `¿Cambiar interés a "${newInterest?.name}"?`,
      onConfirm: async () => {
        setConfirmState(prev => ({...prev, isOpen: false}));
        setProcessing(true);
        try {
          await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/interest/deals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_trato: deal.id_trato, id_interest: newInterestId, id_tenant: user?.id_tenant, id_user: user?.id_user })
          });
          setDeal(prev => prev ? { ...prev, interes_actual: { id: newInterestId, name: newInterest?.name, icon: newInterest?.icon, color: newInterest?.color } } as any : null);
          setToast({ message: 'Interés actualizado.', type: 'success' });
        } catch { setToast({ message: 'Error al actualizar.', type: 'error' }); } finally { setProcessing(false); }
      },
      onCancel: () => setConfirmState(prev => ({...prev, isOpen: false}))
    });
  };

  const handleWinningQuoteConfirm = async (selectedQuoteId: string, createInCartera: boolean) => {
    if (!deal || !selectWinnerModal.pendingStatusId || !user?.id_user) return;
    setSelectWinnerModal({ isOpen: false, pendingStatusId: '' });
    setProcessing(true);
    try {
      const resStatus = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/status/deals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_trato: deal.id_trato, id_deal_status: selectWinnerModal.pendingStatusId, id_user: user.id_user, id_cotizacion: selectedQuoteId })
      });
      if (!resStatus.ok) throw new Error();
      await fetchData();
      setToast({ message: 'Cotización ganadora registrada exitosamente.', type: 'success' });
      if (createInCartera) {
        setTimeout(() => navigate(`/app/financials/new?from_deal=${deal.id_trato}&quote_id=${selectedQuoteId}&client_id=${deal.id_client_company}`), 500);
      }
    } catch { setToast({ message: 'Error al procesar victoria.', type: 'error' }); } finally { setProcessing(false); }
  };

  if (loading) return <DealDetailSkeleton />;
  if (!deal) return <div className="text-center mt-20 font-medium text-zinc-500">Trato no encontrado.</div>;

  const canEdit = deal.access_level === 'EDIT' || user?.rol_user === 'admin';
  const dealCategory = deal.estado_actual?.category || 'PROGRESS';
  const pipelineCats =['DRAFT', 'PROGRESS', 'PAUSED', 'WON', 'LOST'];
  const catIndex = pipelineCats.indexOf(dealCategory.toUpperCase());

  // Logic for pipeline blocks
  const renderPipelineBlock = (categoryName: string, label: string, idx: number) => {
    const isCompleted = idx < catIndex;
    const isActive = idx === catIndex;

    if (isCompleted) {
      return (
        <div key={categoryName} className="flex-1 group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="h-1.5 w-full bg-zinc-800 rounded-full mb-2"></div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-900 uppercase tracking-wide">
            <i className="fa-solid fa-circle-check text-zinc-400"></i> {label}
          </div>
        </div>
      );
    }
    
    if (isActive) {
      const activeColor = deal.estado_actual?.color || '#10b981';
      const activeName = deal.estado_actual?.name || 'ACTIVO';
      return (
        <div key={categoryName} className="flex-[1.5] group cursor-pointer">
          <div className="h-1.5 w-full rounded-full mb-2 relative" style={{ backgroundColor: activeColor }}>
             <div className="absolute inset-0 rounded-full animate-pulse opacity-40" style={{ backgroundColor: activeColor }}></div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-900 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}80` }}></span> 
            {label}: <span style={{ color: activeColor }}>{activeName}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={categoryName} className="flex-1 group cursor-pointer hover:opacity-80 transition-opacity">
        <div className="h-1.5 w-full bg-zinc-200 rounded-full mb-2"></div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
          <i className="fa-regular fa-circle text-[10px]"></i> {label}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F9F8] text-zinc-800 pb-20 font-sans">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight truncate">
                  {deal.nombre_trato}
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-500 uppercase tracking-wide border border-zinc-200 shadow-sm">
                  {dealCategory === 'DRAFT' ? 'Inicial' : dealCategory === 'PAUSED' ? 'En Espera' : dealCategory === 'WON' ? 'Cerrado' : dealCategory === 'LOST' ? 'Perdido' : 'Progreso'}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
              <div className="text-left sm:text-right mr-2">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Valor del Trato</div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {formatCurrency(deal.valor_numeric).split('.')[0]}<span className="text-zinc-400 text-lg">.{formatCurrency(deal.valor_numeric).split('.')[1]}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {setIsShareOpen(true); refreshShareCollaborators();}} className="h-9 w-9 flex items-center justify-center rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm" title="Compartir">
                  <i className="fa-solid fa-share-nodes text-[13px]"></i>
                </button>
                <button onClick={() => navigate(`/app/deals/edit?id=${deal.id_trato}`)} className="h-9 px-4 bg-zinc-900 text-white rounded-md font-medium text-[13px] hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
                  <i className="fa-solid fa-pen text-[11px]"></i> Editar
                </button>
              </div>
            </div>
          </div>

          {/* PIPELINE VISUAL */}
          <div className="mt-8 overflow-x-auto scrollbar-hide">
            <div className="flex min-w-[700px] gap-2.5">
              {renderPipelineBlock('DRAFT', 'Inicial', 0)}
              {renderPipelineBlock('PROGRESS', 'En Curso', 1)}
              {renderPipelineBlock('PAUSED', 'En Espera', 2)}
              {renderPipelineBlock('WON', 'Ganado', 3)}
              {renderPipelineBlock('LOST', 'Perdido', 4)}
            </div>
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* COLUMNA IZQUIERDA */}
        <aside className="lg:col-span-4 space-y-8">
          
          {deal.deal_description && (
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Descripción</h3>
              <p className="text-[13px] text-zinc-700 leading-relaxed bg-white border border-zinc-200 p-3 rounded-lg shadow-sm whitespace-pre-wrap">
                {deal.deal_description}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Acerca del trato</span>
            </h3>
            
            <div className="space-y-1">
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-regular fa-building w-4 text-center"></i> Empresa
                </div>
                <div className="w-2/3 text-zinc-900 text-[13px] font-medium truncate hover:text-blue-600 hover:underline">
                  <Link to={`/app/client-companies/${deal.id_client_company}`}>{deal.client_company_name}</Link>
                </div>
              </div>

              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-regular fa-envelope w-4 text-center"></i> Email
                </div>
                <div className="w-2/3 text-zinc-600 text-[13px] truncate hover:text-blue-600 hover:underline">
                  <a href={`mailto:${deal.contact_email}`}>{deal.contact_email || 'Sin correo'}</a>
                </div>
              </div>

              {deal.channel && (
                <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                  <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                    <i className="fa-solid fa-bullhorn w-4 text-center"></i> Origen
                  </div>
                  <div className="w-2/3 flex items-center gap-1.5 text-zinc-700 text-[13px] uppercase font-medium">
                    {deal.channel === 'WHATSAPP' && <i className="fa-brands fa-whatsapp text-emerald-500"></i>}
                    {deal.channel}
                  </div>
                </div>
              )}

              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-solid fa-bars-progress w-4 text-center"></i> Estado
                </div>
                <div className="w-2/3 flex items-center gap-2">
                  <StatusSelector 
                    currentStatusId={deal.estado_actual?.id || ''} 
                    statuses={dealStatuses} 
                    onSelect={handleStatusChange} 
                    disabled={!canEdit || processing}
                  />
                </div>
              </div>

              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-regular fa-star w-4 text-center"></i> Interés
                </div>
                <div className="w-2/3 flex items-center text-zinc-700 text-[13px]">
                   <InterestSelector 
                      currentInterestId={deal.interes_actual?.id || ''} 
                      interests={cachedDealInterests ||[]} 
                      onSelect={handleInterestChange} 
                      disabled={!canEdit || processing}
                  />
                </div>
              </div>
              
              <div className="flex items-center group py-1.5 hover:bg-zinc-50 rounded-md px-2 -mx-2 cursor-pointer transition-colors mt-2">
                <div className="w-1/3 text-zinc-500 text-[13px] flex items-center gap-2">
                  <i className="fa-regular fa-calendar w-4 text-center"></i> Fechas
                </div>
                <div className="w-2/3 flex flex-col justify-center text-[12px]">
                  <span className="text-zinc-700">Creado: <span className="text-zinc-500">{deal.created_at_fmt?.split(' ')[0]}</span></span>
                  <span className="text-zinc-700">Update: <span className="text-zinc-500">{deal.updated_at_fmt?.split(' ')[0]}</span></span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Equipo Asignado</span>
              {canEdit && <button onClick={() => {setIsShareOpen(true); refreshShareCollaborators();}} className="text-[11px] text-blue-600 hover:underline font-medium">Gestionar</button>}
            </h3>
            
            <div className="space-y-2">
              {(deal.collaborators ||[]).map((collab: any) => {
                 const isOwner = collab.permission_level === 'OWNER' || collab.is_owner;
                 const badgeColors = isOwner ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                  : collab.permission_level === 'EDIT' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' 
                                  : 'bg-white text-zinc-400 border-zinc-200';
                 const avBg = isOwner ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-600';
                 
                 return (
                  <div key={collab.id_user} className="flex items-center justify-between group py-1 px-2 -mx-2 hover:bg-zinc-50 rounded-md cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      {collab.avatar ? (
                        <img src={collab.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${avBg}`}>
                          {getInitials(collab.name || collab.id_user)}
                        </div>
                      )}
                      <span className="text-[13px] font-medium text-zinc-900 group-hover:text-blue-600 transition-colors truncate">{collab.name || collab.id_user}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide ${badgeColors}`}>
                      {collab.permission_level}
                    </span>
                  </div>
                 );
              })}
            </div>
          </div>

        </aside>

        {/* COLUMNA DERECHA (TABS REACTIVOS) */}
        <section className="lg:col-span-8 relative">
          
          <div className="flex gap-6 border-b border-zinc-200 mb-8 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('activity')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 ${activeTab === 'activity' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>
              Muro de Actividad
            </button>
            <button onClick={() => setActiveTab('quotes')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'quotes' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>
              Cotizaciones <span className="bg-zinc-100 text-zinc-600 px-1.5 rounded-full text-[10px] font-semibold">{quotes.length}</span>
            </button>
            <button onClick={() => setActiveTab('files')} className={`pb-3 text-[13px] whitespace-nowrap transition-colors border-b-2 ${activeTab === 'files' ? 'font-semibold text-zinc-900 border-zinc-900' : 'font-medium text-zinc-500 border-transparent hover:text-zinc-800'}`}>
              Archivos
            </button>
          </div>

          {/* TAB 1: MURO */}
          {activeTab === 'activity' && (
            <div className="animate-fade-in">
              <div className="bg-white border border-zinc-200 rounded-lg shadow-sm focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 transition-all mb-8 cursor-text" onClick={() => setShowNewInteractionModal(true)}>
                <textarea placeholder="Escribe una nota interna o registra una actividad..." className="w-full text-[13px] p-3 text-zinc-800 bg-transparent border-0 focus:ring-0 resize-none h-16 outline-none pointer-events-none" readOnly spellCheck="false"></textarea>
                <div className="flex justify-between items-center px-3 py-2 border-t border-zinc-100 bg-zinc-50/50 rounded-b-lg">
                  <div className="flex gap-1">
                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"><i class="fa-solid fa-phone text-[12px]"></i></button>
                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors bg-emerald-50"><i class="fa-brands fa-whatsapp text-[13px]"></i></button>
                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"><i class="fa-regular fa-envelope text-[12px]"></i></button>
                  </div>
                  <button type="button" className="px-3 py-1.5 bg-zinc-900 text-white text-[12px] font-medium rounded hover:bg-zinc-800 transition-colors shadow-sm">Registrar</button>
                </div>
              </div>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:w-[1px] before:bg-zinc-200">
                {history.length === 0 && emailHistory.length === 0 && (
                   <p className="pl-10 text-[13px] text-zinc-400 italic">No hay actividad registrada aún.</p>
                )}

                {/* Render History from API */}
                {history.map((group: any, gIdx: number) => {
                  const interactions = Array.isArray(group.interactions) ? group.interactions :[];
                  if (interactions.length === 0) return null;
                  
                  return (
                    <React.Fragment key={`grp-${gIdx}`}>
                      <div className="relative pl-10 pt-2 mb-2">
                        <div className="absolute left-[-4px] top-3 w-[39px] h-[1px] bg-zinc-200"></div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-white border border-zinc-200 text-zinc-600 shadow-sm relative z-10">
                          {group.group_name}
                        </span>
                      </div>

                      {interactions.map((item: any) => {
                        const isSystem = item.type === 'SYSTEM';
                        const isWhatsapp = item.channel_name?.toUpperCase() === 'WHATSAPP';
                        
                        return (
                          <div key={item.id} className="relative pl-10 group">
                            <div className="absolute left-0 top-1 w-8 h-8 rounded-full border border-zinc-200 bg-white overflow-hidden z-10 shadow-sm flex items-center justify-center text-zinc-400">
                              {isSystem ? <i className="fa-solid fa-code-branch text-[11px]"></i> : (
                                item.user_avatar ? <img src={getImageUrl(item.user_avatar)} alt="av" className="w-full h-full object-cover" /> 
                                : <span className="text-[10px] font-bold text-zinc-600">{getInitials(item.user_name)}</span>
                              )}
                            </div>

                            {isSystem ? (
                               <div className="pt-1.5 pb-2">
                                <p className="text-[13px] text-zinc-600">
                                  <span className="font-semibold text-zinc-900">{item.user_name || 'Sistema'}</span> {item.description}
                                </p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">{item.date_fmt} • {item.time_fmt}</p>
                              </div>
                            ) : (
                              <div className={`bg-white border rounded-lg p-3 shadow-sm mt-1 hover:shadow-md transition-shadow relative ${isWhatsapp ? 'border-emerald-100 hover:border-emerald-300' : 'border-zinc-200 hover:border-zinc-300'}`}>
                                {isWhatsapp && (
                                  <div className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-sm border-2 border-white" title="WhatsApp">
                                    <i className="fa-brands fa-whatsapp text-[12px]"></i>
                                  </div>
                                )}
                                <div className="flex justify-between items-start mb-1.5">
                                  <p className="text-[13px] font-bold text-zinc-900">{item.user_name}</p>
                                  <span className="text-[11px] text-zinc-400 font-medium">{item.date_fmt} • {item.time_fmt}</span>
                                </div>
                                <p className="text-[13px] text-zinc-700 leading-relaxed whitespace-pre-line mb-2">
                                  {item.description}
                                </p>

                                {/* Scheduled Action */}
                                {(item.planned_action || item.planned_date) && (
                                  <div className={`rounded-md p-2.5 flex items-start gap-2.5 mt-2 border ${item.is_planned_overdue ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                                    <i className={`fa-solid ${item.is_planned_overdue ? 'fa-triangle-exclamation text-red-500' : 'fa-calendar text-blue-500'} text-[12px] mt-0.5`}></i>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <p className={`text-[11px] font-bold uppercase tracking-wide ${item.is_planned_overdue ? 'text-red-700' : 'text-blue-700'}`}>
                                          Acción {item.is_planned_overdue ? '(Vencida)' : 'Planificada'}
                                        </p>
                                        <span className={`text-[11px] font-bold bg-white border px-1.5 py-0.5 rounded flex items-center gap-1 ${item.is_planned_overdue ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-200'}`}>
                                          <i className="fa-regular fa-calendar-check text-[10px]"></i> {item.planned_date}
                                        </span>
                                      </div>
                                      <p className={`text-[12px] font-medium ${item.is_planned_overdue ? 'text-red-900' : 'text-blue-900'}`}>{item.planned_action}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Render Emails Sent */}
                {emailHistory.map((em: any, idx: number) => (
                  <div key={em.id_sent || `em-${idx}`} className="relative pl-10 pt-4">
                    <div className="absolute left-0 top-5 w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center z-10 text-blue-500 shadow-sm">
                      <i className="fa-regular fa-envelope text-[11px]"></i>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm mt-1 hover:border-zinc-300 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-[13px] font-medium text-zinc-900">
                          Cotización enviada a <a href={`mailto:${em.enviado_a}`} className="text-blue-600 font-semibold hover:underline">{em.enviado_a}</a>
                        </p>
                        <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap ml-2">{em.fecha}</span>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200/60 rounded-md p-3 text-[12px]">
                        <p className="font-bold text-zinc-800 mb-1">Asunto: {em.subject}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 shadow-sm rounded text-zinc-700 font-semibold hover:bg-zinc-50 hover:text-sky-600 cursor-pointer transition-colors">
                            <i className="fa-solid fa-file-invoice-dollar text-sky-500"></i> Ver Cotización (v{em.version || 1})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: COTIZACIONES */}
          {activeTab === 'quotes' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-zinc-900">Documentos Financieros</h3>
                {canEdit && (
                  <button onClick={() => navigate(`/app/quotes/new?dealId=${deal.id_trato}&clientCompanyId=${deal.id_client_company}&contactId=${deal.id_contact}&dealName=${encodeURIComponent(deal.nombre_trato || '')}`)} className="text-[12px] font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
                    <i className="fa-solid fa-plus text-[10px]"></i> Nueva Cotización
                  </button>
                )}
              </div>

              {quotes.length > 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-6 md:col-span-5">Cotización</div>
                    <div className="col-span-3 hidden md:block">Fecha / Valor</div>
                    <div className="col-span-3">Estado</div>
                    <div className="col-span-3 md:col-span-1 text-right"></div>
                  </div>

                  {quotes.map(q => {
                    const isRejected = q.estado.toUpperCase() === 'RECHAZADO' || q.estado.toUpperCase() === 'RECHAZADA';
                    const isApproved = q.estado.toUpperCase() === 'APROBADO' || q.estado.toUpperCase() === 'APROBADA';
                    const rowClass = isRejected ? 'opacity-70 hover:opacity-100' : '';
                    const iconColor = isApproved ? 'text-emerald-500 group-hover:border-emerald-200' : isRejected ? 'text-red-500 group-hover:border-red-200' : 'text-zinc-400 group-hover:border-sky-200 group-hover:text-sky-500';
                    const titleColor = isRejected ? 'text-zinc-600 line-through group-hover:text-red-600' : isApproved ? 'text-zinc-900 group-hover:text-emerald-600' : 'text-zinc-900 group-hover:text-sky-600';
                    const badgeColors = isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isRejected ? 'bg-red-50 text-red-600 border-red-100' : 'bg-sky-50 text-sky-700 border-sky-100';

                    return (
                      <div key={q.id_cotizacion} onClick={() => navigate(`/app/quotes/${q.id_cotizacion}`)} className={`grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-zinc-100 hover:bg-zinc-50 transition-colors group cursor-pointer last:border-0 ${rowClass}`}>
                        <div className="col-span-6 md:col-span-5 flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-md bg-white border border-zinc-200 shadow-sm flex items-center justify-center transition-colors shrink-0 ${iconColor}`}>
                            <i className="fa-solid fa-file-invoice-dollar"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-[13px] font-bold transition-colors truncate ${titleColor}`}>
                              Cotización #{q.formatted_no_cotizacion || String(q.no_cotizacion).padStart(4,'0')}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono bg-zinc-100 border border-zinc-200 px-1 rounded text-[9px] font-bold text-zinc-600">v{q.version}</span>
                              {q.nombre_cotizacion || 'Sin título'}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-3 hidden md:block">
                          <div className="text-[12px] text-zinc-500 font-medium">{q.fecha_emision}</div>
                          <div className="text-[13px] font-bold text-zinc-900 mt-0.5">{formatCurrency(q.total)}</div>
                        </div>

                        <div className="col-span-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${badgeColors}`} style={!isApproved && !isRejected && q.estado_color ? { color: q.estado_color, backgroundColor: `${q.estado_color}15`, borderColor: `${q.estado_color}30` } : {}}>
                            {q.estado}
                          </span>
                          <div className="text-[12px] font-bold text-zinc-900 mt-1 md:hidden">{formatCurrency(q.total)}</div>
                        </div>

                        <div className="col-span-3 md:col-span-1 text-right">
                          <button className="text-zinc-400 hover:text-zinc-900 w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 transition-colors">
                            <i className="fa-solid fa-chevron-right text-[11px]"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-zinc-50/50 border border-dashed border-zinc-300 rounded-xl p-12 text-center text-zinc-500">
                   <i className="fa-solid fa-file-invoice-dollar text-2xl text-zinc-300 mb-3"></i>
                   <p className="text-[13px] font-medium">No hay cotizaciones activas.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ARCHIVOS */}
          {activeTab === 'files' && (
            <div className="animate-fade-in">
              <div className="border-2 border-dashed border-zinc-300 bg-zinc-50/50 rounded-xl p-12 text-center hover:bg-zinc-50 transition-colors hover:border-zinc-400 cursor-pointer">
                 <div className="w-12 h-12 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center mx-auto mb-3 text-zinc-400 group-hover:text-blue-500 transition-colors">
                   <i className="fa-solid fa-cloud-arrow-up"></i>
                 </div>
                 <h3 className="text-[14px] font-semibold text-zinc-900 mb-1">Sube archivos adjuntos</h3>
                 <p className="text-[13px] text-zinc-500">Arrastra PDFs, órdenes de compra o especificaciones técnicas aquí.</p>
              </div>
            </div>
          )}
          
        </section>
      </main>

      
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

      {selectWinnerModal.isOpen && (
        <SelectWinningQuoteModal 
          isOpen={selectWinnerModal.isOpen} 
          onClose={() => setSelectWinnerModal({ isOpen: false, pendingStatusId: '' })} 
          onConfirm={handleWinningQuoteConfirm} 
          quotes={quotes} 
          dealName={deal.nombre_trato || ''} 
          hasCarteraAccess={user?.module_access?.financials || user?.rol_user === 'admin'} 
        />
      )}

      {isShareOpen && (
        <ShareModal 
          entity="deal" 
          id={deal.id_trato} 
          entityName={deal.nombre_trato || ''} 
          creatorName={deal.owner_name || ''} 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)} 
          onShared={() => { 
            setToast({ message: 'Asignaciones actualizadas.', type: 'success' }); 
            refreshShareCollaborators(); 
            refreshDealCollaborators(); 
          }} 
          currentCollaborators={shareCollaborators} 
        />
      )}

      <NewInteractionModal 
        isOpen={showNewInteractionModal} 
        onClose={() => setShowNewInteractionModal(false)} 
        entityId={deal.id_trato} 
        entityType="DEAL" 
        contactName={deal.contact_full_name || deal.client_company_name} 
        contactEmail={deal.contact_email} 
        collaborators={deal.collaborators || []}
        onSuccess={() => {
          setShowNewInteractionModal(false);
          setRefreshTimelineKey(prev => prev + 1);
          setToast({ message: 'Gestión registrada.', type: 'success' });
        }}
      />
    </div>
  );
};

export default DealDetail;
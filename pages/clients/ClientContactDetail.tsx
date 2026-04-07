import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ClientContact } from '../../types';
import Toast from '../../components/Toast';
import { apiFetch } from '../../services/apiClient';
import { GATEWAY_CONFIG } from '../../services/gatewayConfig';
import ConfirmModal from '../../components/ConfirmModal';
import ContactForm from './ContactForm';
import ShareModal from '../../components/ShareModal';
import NewInteractionModal from '../../components/NewInteractionModal';
import ContactHistoryTimeline from '../../components/ContactHistoryTimeline';
import { BrandSpinner } from '../../components/AppLoaders';

const ClientContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // --- ESTADOS ---
  const [contact, setContact] = useState<ClientContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [refreshTimelineKey, setRefreshTimelineKey] = useState(0);
  const [isTimelineVisible, setIsTimelineVisible] = useState(true);
  const [showNewInteractionModal, setShowNewInteractionModal] = useState(false);
  const [markLostConfirmOpen, setMarkLostConfirmOpen] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);
  
  // Asignaciones
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCollaborators, setShareCollaborators] = useState<any[]>([]);

  // Editar contacto
  const [showEditContact, setShowEditContact] = useState(false);

  // Permisos
  const isOwnerContact = contact?.created_by === user?.id_user;
  const isOwnerCompany = contact?.company_details?.created_by === user?.id_user;
  const contactAccess: 'VIEW' | 'EDIT' = (contact?.access_level as any) || (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canShare = (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany) && contactAccess === 'EDIT';
  const isDirectoryContact = !contact?.next_contact_date;


  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;
    try {
      const contactResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/detail?id_contact=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!contactResponse.ok) {
        if (contactResponse.status === 404) {
          setContact(null);
        } else {
          throw new Error('Error al cargar contacto.');
        }
        setLoading(false);
        return;
      }
      const contactText = await contactResponse.text();
      const foundContact = contactText 
        ? (Array.isArray(JSON.parse(contactText)) ? JSON.parse(contactText)[0] : JSON.parse(contactText)) 
        : null;
      setContact(foundContact);
      
      // Load collaborators from response
      if (foundContact?.collaborators && Array.isArray(foundContact.collaborators)) {
        const mapped = foundContact.collaborators.map((u: any) => ({
          id_user: u.id_user,
          name: u.name || u.name_user || u.full_name || u.email || 'Usuario',
          avatar: u.avatar || u.avatar_url || null,
          permission_level: (u.permission_level || '').toUpperCase() === 'NONE' ? 'BLOCKED' : u.permission_level,
          rol_user: u.rol_user,
          is_owner: u.is_owner
        }));
        setShareCollaborators(mapped);
      }
      
      // Update breadcrumb with contact name
      if (foundContact) {
        const contactName = foundContact.first_name && foundContact.last_name 
          ? `${foundContact.first_name} ${foundContact.last_name}`
          : foundContact.first_name || foundContact.email;
        navigate(location.pathname, { state: { breadcrumb: contactName }, replace: true });
      }
    } catch (e: any) {
      console.error("Error:", e);
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setContact(null);
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate, location.pathname]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if ((location.state as any)?.openShare && contact) {
      openShareModal();
      navigate(location.pathname, { state: { breadcrumb: (location.state as any)?.breadcrumb }, replace: true });
    }
  }, [contact, location.pathname, location.state, navigate]);

  // --- HANDLERS ASIGNAR ---
  const refreshShareCollaborators = useCallback(async () => {
    if (!user?.id_tenant || !contact?.id_contact) return;
    try {
      const shareRes = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/contacts/share?id_contact=${contact.id_contact}`);
      const shareText = await shareRes.text();
      const shareData = shareText ? JSON.parse(shareText) : [];
      const shareList = Array.isArray(shareData) ? shareData : (shareData.users || []);
      const mapped = shareList.map((u: any) => {
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
  }, [contact?.id_contact, user?.id_tenant]);

  const refreshContactCollaborators = useCallback(async () => {
    if (!contact?.id_contact || !user?.id_tenant || !user?.id_user) return;
    try {
      const contactResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/detail?id_contact=${contact.id_contact}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!contactResponse.ok) return;
      const contactText = await contactResponse.text();
      const foundContact = contactText
        ? (Array.isArray(JSON.parse(contactText)) ? JSON.parse(contactText)[0] : JSON.parse(contactText))
        : null;
      const collaborators = Array.isArray(foundContact?.collaborators) ? foundContact.collaborators : [];
      setContact(prev => (prev ? ({ ...(prev as any), collaborators } as any) : prev));
    } catch {
      // keep current state on error
    }
  }, [contact?.id_contact, user?.id_tenant, user?.id_user]);

  const openShareModal = async () => {
    if (!user?.id_tenant || !contact?.id_contact) return;
    if (!shareCollaborators.length) {
      await refreshShareCollaborators();
    }
    setShareModalOpen(true);
  };

  const handleEditSuccess = async () => {
    await fetchData();
    setShowEditContact(false);
    setToast({ message: 'Contacto actualizado.', type: 'success' });
  };

  const getVisibleContactStatus = useCallback((status?: string | null) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'DORMANT') return 'Perdido';
    if (!normalized) return 'SIN ESTADO';
    return normalized;
  }, []);

  const handleMarkAsLost = useCallback(async () => {
    if (!contact?.id_contact) return;
    if (!contact?.next_contact_date) {
      setMarkLostConfirmOpen(false);
      setToast({ message: 'Esta acción aplica solo a contactos con seguimiento activo.', type: 'error' });
      return;
    }
    if (String(contact.contact_status || '').toUpperCase() === 'DORMANT') {
      setMarkLostConfirmOpen(false);
      setToast({ message: 'Este contacto ya está marcado como perdido.', type: 'success' });
      return;
    }

    setMarkingLost(true);
    try {
      const payload = {
        id_contact: contact.id_contact,
        contact_status: 'DORMANT',
      };

      const response = await apiFetch(GATEWAY_CONFIG.API.CLIENTS.CONTACTS_UPDATE_STATUS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado del contacto.');
      }

      setContact(prev => (prev ? { ...prev, contact_status: 'DORMANT' } : prev));
      setToast({ message: 'Prospección finalizada. Estado: Perdido.', type: 'success' });
      setMarkLostConfirmOpen(false);
      await fetchData();
    } catch {
      setToast({ message: 'Error al marcar contacto como perdido.', type: 'error' });
    } finally {
      setMarkingLost(false);
    }
  }, [contact, fetchData]);

  // Función para obtener color de avatar basado en hash del nombre
  const getAvatarColor = (name: string = '') => {
    const colors = [
      { bg: '#F0E6E6', text: '#A67C7C' },    // Rojo suave
      { bg: '#F5EAF0', text: '#B397AA' },    // Rosa suave
      { bg: '#EDE4F5', text: '#9B7DB0' },    // Púrpura suave
      { bg: '#E8E0F0', text: '#8B7BA3' },    // Índigo suave
      { bg: '#E1E8F5', text: '#7A8FB5' },    // Azul suave
      { bg: '#DFF0ED', text: '#7BA89C' },    // Teal suave
      { bg: '#E9F0E8', text: '#7FA08' },     // Verde suave
      { bg: '#EEF2E7', text: '#92A680' },    // Verde claro suave
      { bg: '#F5F2E1', text: '#B8AC5B' },    // Amarillo suave
      { bg: '#F7EFEA', text: '#B88263' },    // Naranja suave
      { bg: '#EFE8E4', text: '#8B7B6F' },    // Marrón suave
      { bg: '#E8E8E8', text: '#707070' },    // Gris suave
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // --- RENDER ---
  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <BrandSpinner size="xl" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando contacto...</p>
      </div>
    </div>
  );
  
  if (!contact) return (
    <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
            <h3 className="text-lg font-bold text-red-700">Contacto no encontrado</h3>
            <button onClick={() => navigate('/app/client-contacts')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Volver</button>
        </div>
    </div>
  );

  return (
    <div className="w-full space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
                {(() => {
                    const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`;
                    const color = getAvatarColor(contactName);
                    return (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-slate-500 font-bold text-3xl border shadow-sm" style={{ backgroundColor: color.bg, color: color.text, borderColor: color.text, borderWidth: '2px' }}>
                            {contact.first_name.charAt(0)}{contact.last_name?.charAt(0)}
                        </div>
                    );
                })()}
                
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{contact.first_name} {contact.last_name}</h1>
                    <p className="text-sm text-slate-500 font-medium">{contact.position || 'Cargo no especificado'}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
              {contactAccess === 'EDIT' && (
                <>
                  {!isDirectoryContact && (
                    <button
                      onClick={() => setMarkLostConfirmOpen(true)}
                      disabled={markingLost || String(contact.contact_status || '').toUpperCase() === 'DORMANT'}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fa-solid fa-circle-xmark"></i>
                      {String(contact.contact_status || '').toUpperCase() === 'DORMANT' ? 'Perdido' : 'Marcar perdido'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowEditContact(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 shadow-sm"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    Editar
                  </button>
                </>
              )}
                <button
                  onClick={openShareModal}
                  disabled={!canShare}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    canShare 
                    ? 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                  }`}
                >
                  <i className="fa-solid fa-user-plus"></i>
                  Asignar
                </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Contact Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Datos de Contacto</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-400 mb-1">Correo Electrónico</p>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors break-all">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i className="fa-regular fa-envelope"></i></div>
                      {contact.email}
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0"><i className="fa-regular fa-envelope"></i></div>
                      No registrado
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-xs text-slate-400 mb-1">Teléfono Móvil</p>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0"><i className="fa-solid fa-phone"></i></div>
                      {contact.phone}
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0"><i className="fa-solid fa-phone"></i></div>
                      No registrado
                  </div>
                )}
              </div>
            </div>
          </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Información</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Creado por</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{(contact as any).creator_name || 'No especificado'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{contact.created_at ? new Date(contact.created_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Estado</p>
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 truncate">{getVisibleContactStatus((contact as any).contact_status)}</span>
                  </div>
                </div>
                {contact.last_contact_date && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Último Contacto</p>
                    <p className="text-sm font-medium text-slate-700">{new Date(contact.last_contact_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</p>
                  </div>
                )}
              </div>
            </div>
          
          {contact?.company_details && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => navigate(`/app/client-companies/${contact.company_details?.id}`)}>
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const companyName = contact.company_details?.name || 'Empresa';
                    const color = getAvatarColor(companyName);
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: color.bg, color: color.text }}>
                          {companyName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{contact.company_details?.name}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <i className="fa-solid fa-chevron-right text-slate-300 shrink-0"></i>
              </div>
              <div className="p-4 space-y-2">
                {contact.company_details?.email && (
                  <a href={`mailto:${contact.company_details.email}`} className="flex items-center gap-2 text-xs text-slate-700 hover:text-brand-600 transition-colors truncate">
                    <i className="fa-regular fa-envelope text-blue-600 shrink-0"></i>
                    <span className="truncate">{contact.company_details.email}</span>
                  </a>
                )}
                {contact.company_details?.phone && (
                  <a href={`tel:${contact.company_details.phone}`} className="flex items-center gap-2 text-xs text-slate-700 hover:text-brand-600 transition-colors truncate">
                    <i className="fa-solid fa-phone text-green-600 shrink-0"></i>
                    <span className="truncate">{contact.company_details.phone}</span>
                  </a>
                )}
                {contact.company_details?.website && (
                  <a href={contact.company_details.website.startsWith('http') ? contact.company_details.website : `https://${contact.company_details.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-slate-700 hover:text-brand-600 transition-colors truncate">
                    <i className="fa-solid fa-globe text-purple-600 shrink-0"></i>
                    <span className="truncate">{contact.company_details.website}</span>
                  </a>
                )}
                {contact.company_details?.address && (
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <i className="fa-solid fa-map-pin text-slate-400 shrink-0 mt-0.5"></i>
                    <span className="line-clamp-2">{contact.company_details.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Asignaciones */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Asignaciones</h3>
              </div>
              <button
                onClick={openShareModal}
                disabled={!canShare}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                  canShare
                  ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                <i className="fa-solid fa-gear"></i>Gestionar
              </button>
            </div>
            <div className="p-4">
              {(contact as any).collaborators && (contact as any).collaborators.length > 0 ? (
                <div className="space-y-2">
                  {[...(contact as any).collaborators].sort((a: any, b: any) => {
                    const getOrder = (collab: any) => {
                      const level = (collab.permission_level || '').toUpperCase();
                      if (level === 'OWNER' || collab.is_owner) return 0; // Creador primero
                      if (level === 'EDIT') return 1; // Principal segundo
                      if (level === 'VIEW') return 2; // Secundaria tercero
                      return 3; // Sin asignación al final
                    };
                    return getOrder(a) - getOrder(b);
                  }).map((collaborator: any) => (
                    <div key={collaborator.id_user} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {collaborator.avatar ? (
                          <img src={collaborator.avatar} alt={collaborator.name} className="w-6 h-6 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {(collaborator.name || 'U').charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-700 truncate flex items-center gap-2">
                            {collaborator.name}
                            {(collaborator.rol_user || '').toLowerCase() === 'admin' && (
                              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] text-amber-500 leading-none align-middle" title="Control total por admin">
                                <i className="fa-solid fa-star"></i>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {(() => {
                          const level = (collaborator.permission_level || '').toUpperCase();
                          if (level === 'OWNER') {
                            return (
                              <>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-star text-[9px]"></i>Creador
                                </span>
                              </>
                            );
                          }
                          if (collaborator.is_owner) {
                            return (
                              <>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-crown text-[9px]"></i>Principal
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-star text-[9px]"></i>Creador
                                </span>
                              </>
                            );
                          }
                          if (level === 'EDIT') {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1">
                                <i className="fa-solid fa-crown text-[9px]"></i>Principal
                              </span>
                            );
                          }
                          if (level === 'VIEW') {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                <i className="fa-solid fa-user text-[9px]"></i>Secundaria
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200 inline-flex items-center gap-1">
                              <i className="fa-regular fa-circle text-[9px]"></i>Sin asignación
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">Sin asignaciones</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Seguimiento General */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Interacciones</h3>
              <button
                onClick={() => setShowNewInteractionModal(true)}
                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2 transition-all shadow-sm hover:shadow group"
                title="Añadir actividad"
              >
                <i className="fa-solid fa-plus text-[12px] group-hover:scale-110 transition-transform"></i>
                <span className="text-[12px] font-semibold">Añadir actividad</span>
              </button>
            </div>
            {isTimelineVisible && (
              <ContactHistoryTimeline
                contactId={contact.id_contact}
                refreshKey={refreshTimelineKey}
              />
            )}
          </div>
        </div>
      </div>

      {/* EDIT CONTACT MODAL */}
      {showEditContact && contact && (
        <ContactForm
          isOpen={showEditContact}
          onClose={() => setShowEditContact(false)}
          mode="edit"
          initialData={contact}
          preselectedCompanyId={contact.id_client_company || ''}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* NEW INTERACTION MODAL */}
      {showNewInteractionModal && contact && (
        <NewInteractionModal
          isOpen={showNewInteractionModal}
          onClose={() => setShowNewInteractionModal(false)}
          entityId={contact.id_contact}
          entityType="CONTACT"
          contactEmail={contact.email}
          contactName={contact.first_name && contact.last_name ? `${contact.first_name} ${contact.last_name}` : (contact.first_name || contact.email || 'Contacto')}
          collaborators={shareCollaborators}
          onSuccess={() => {
            setToast({ message: 'Actividad registrada.', type: 'success' });
            setRefreshTimelineKey(prev => prev + 1);
            setIsTimelineVisible(true);
          }}
        />
      )}

      {shareModalOpen && contact && (
        <ShareModal
          entity="contact"
          id={contact.id_contact}
          entityName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email}
          creatorName={(contact as any).creator_name || (contact as any).created_by_name || ''}
          isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); }}
          onShared={() => {
            setToast({ message: 'Asignaciones actualizadas.', type: 'success' });
            refreshShareCollaborators();
            refreshContactCollaborators();
          }}
          currentCollaborators={shareCollaborators}
        />
      )}

      <ConfirmModal
        isOpen={markLostConfirmOpen}
        onClose={() => {
          if (!markingLost) setMarkLostConfirmOpen(false);
        }}
        onConfirm={handleMarkAsLost}
        title="Finalizar prospección"
        message="Este prospecto se marcará como Perdido y quedará como contacto simple."
        confirmText={markingLost ? 'Procesando...' : 'Marcar perdido'}
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};

export default ClientContactDetail;

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ClientContact, ClientCompany } from '../../types';
import Toast from '../../components/Toast';
import { apiFetch } from '../../services/apiClient';
import ConfirmModal from '../../components/ConfirmModal';
import ContactFormModal from '../clients/ContactFormModal';
import NewInteractionForm from '../../components/NewInteractionForm';
// import InteractionTimeline from '../../components/InteractionTimeline';

const ClientContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // --- ESTADOS ---
  const [contact, setContact] = useState<ClientContact | null>(null);
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [refreshTimelineKey, setRefreshTimelineKey] = useState(0);
  const [isTimelineVisible, setIsTimelineVisible] = useState(true);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
    // --- HISTORIAL DE INTERACCIONES (como en deals) ---
    const fetchHistory = useCallback(async () => {
      if (!contact?.id_contact || !user) return;
      setLoadingHistory(true);
      try {
        const url = `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/history?id_contact=${contact.id_contact}&id_tenant=${user.id_tenant}&id_user=${user.id_user}`;
        const response = await apiFetch(url);
        if (response.ok) {
          const data = await response.json();
          setHistory(Array.isArray(data) ? data : []);
        } else {
          setHistory([]);
        }
      } catch (error) {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }, [contact?.id_contact, user]);

    useEffect(() => {
      fetchHistory();
    }, [fetchHistory, refreshTimelineKey]);
  
  // Compartir
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  // Editar contacto
  const [showEditContact, setShowEditContact] = useState(false);

  // Permisos
  const isOwnerContact = contact?.created_by === user?.id_user;
  const isOwnerCompany = company?.created_by === user?.id_user;
  const contactAccess: 'VIEW' | 'EDIT' = (contact?.access_level as any) || (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canShare = (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany) && contactAccess === 'EDIT';

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // 1. Obtener Contacto
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

      // Update breadcrumb with contact name
      if (foundContact) {
        const contactName = foundContact.first_name && foundContact.last_name 
          ? `${foundContact.first_name} ${foundContact.last_name}`
          : foundContact.first_name || foundContact.email;
        navigate(location.pathname, { state: { breadcrumb: contactName }, replace: true });
      }

      if (!foundContact) {
        setLoading(false);
        return;
      }

      // 2. Obtener Empresa (si existe)
      if (foundContact.id_client_company) {
        const companyResponse = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/detail?id_client_company=${foundContact.id_client_company}&id_tenant=${tenantId}&id_user=${userId}`);
        if (companyResponse.ok) {
          const companyText = await companyResponse.text();
          let parsed: any = null;
          if (companyText) parsed = JSON.parse(companyText);
          
          const foundCompany = Array.isArray(parsed)
            ? parsed.find((c: ClientCompany) => c.id_client_company === foundContact.id_client_company) || parsed[0]
            : parsed;
          
          setCompany(foundCompany || null);
        }
      }

    } catch (e: any) {
      console.error("Error:", e);
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setContact(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS COMPARTIR (Nuevo formato Checkboxes) ---
  const openShareModal = async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Error cargando usuarios');
      const data = await res.json();
      const activos = Array.isArray(data)
        ? data.filter((u: any) => u.status_user !== 'Inactivo' && u.id_user !== user.id_user)
        : [];
      setShareUsers(activos);
      setShareTargets([]);
      setSharePermission('VIEW');
      setShareModalOpen(true);
    } catch (e: any) {
      setToast({ message: 'Error al cargar usuarios.', type: 'error' });
    }
  };

  // Función Toggle para seleccionar usuarios
  const toggleShareTarget = (userId: string) => {
    setShareTargets(prev => 
        prev.includes(userId) 
        ? prev.filter(id => id !== userId) // Quitar
        : [...prev, userId] // Agregar
    );
  };

  const handleShareContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !user?.id_tenant || shareTargets.length === 0) {
      setToast({ message: 'Selecciona al menos un usuario.', type: 'error' });
      return;
    }
    setShareSubmitting(true);
    try {
      const requests = shareTargets.map(target =>
        apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/contacts/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_contact: contact.id_contact,
            id_user_target: target,
            id_tenant: user.id_tenant,
            permission_level: sharePermission,
          }),
        })
      );
      await Promise.all(requests);
      setToast({ message: 'Contacto compartido.', type: 'success' });
      setShareModalOpen(false);
    } catch (error: any) {
      setToast({ message: 'Error al compartir.', type: 'error' });
    } finally {
      setShareSubmitting(false);
    }
  };

  const handleEditSuccess = async () => {
    await fetchData();
    setShowEditContact(false);
    setToast({ message: 'Contacto actualizado.', type: 'success' });
  };

  // --- RENDER ---
  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-3xl border-4 border-white shadow-sm">
                    {contact.first_name.charAt(0)}{contact.last_name?.charAt(0)}
                </div>
                
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{contact.first_name} {contact.last_name}</h1>
                    <p className="text-sm text-slate-500 font-medium">{contact.position || 'Cargo no especificado'}</p>
                    {company && (
                        <Link to={`/app/client-companies/${company.id_client_company}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-1">
                            <i className="fa-solid fa-building"></i> {company.name_company}
                        </Link>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
              {contactAccess === 'EDIT' && (
                <button
                  onClick={() => setShowEditContact(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 shadow-sm"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  Editar
                </button>
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
                  <i className="fa-solid fa-share-nodes"></i>
                  Compartir
              </button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Contact Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Datos de Contacto</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-400 mb-1">Correo Electrónico</p>
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors break-all">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i className="fa-regular fa-envelope"></i></div>
                    {contact.email}
                </a>
              </div>
              
              <div>
                <p className="text-xs text-slate-400 mb-1">Teléfono Móvil</p>
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0"><i className="fa-solid fa-phone"></i></div>
                    {contact.phone || 'No registrado'}
                </a>
              </div>
            </div>
          </div>
          
          {contact.next_contact_date && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seguimiento Activo</h3>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Fecha Próximo Contacto</p>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><i className="fa-solid fa-calendar-check"></i></div>
                      {new Date(contact.next_contact_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 mb-1">Siguiente Acción</p>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0"><i className="fa-solid fa-clipboard-list"></i></div>
                      {contact.next_action_desc || 'No especificada'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {company && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4 hover:border-brand-200 transition-colors cursor-pointer group" onClick={() => navigate(`/app/client-companies/${company.id_client_company}`)}>
                 <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl shrink-0 group-hover:bg-indigo-100 transition-colors">
                   <i className="fa-solid fa-building"></i>
                 </div>
                 <div>
                   <p className="text-xs text-slate-400 font-bold uppercase mb-0.5">Empresa</p>
                   <h4 className="font-bold text-slate-800 text-sm group-hover:text-brand-700 transition-colors">{company.name_company}</h4>
                   <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[150px]">{company.industry}</p>
                 </div>
                 <i className="fa-solid fa-chevron-right text-slate-300 ml-auto group-hover:text-brand-400"></i>
            </div>
          )}
        </div>

        {/* Right Column: Timeline / Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <NewInteractionForm 
              contactId={contact.id_contact} 
              onSuccess={() => {
                setToast({ message: 'Actividad registrada.', type: 'success' });
                setRefreshTimelineKey(prev => prev + 1);
                setIsTimelineVisible(true);
              }} 
            />

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
                loadingHistory ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500"></i>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <i className="fa-solid fa-comments text-3xl text-slate-300"></i>
                    </div>
                    <h4 className="font-bold text-slate-700">Aún no hay actividad registrada</h4>
                    <p className="text-sm text-slate-500 max-w-xs mt-2">
                      ¡Inicia el seguimiento registrando tu primera gestión!
                    </p>
                  </div>
                ) : (
                  <div className="flow-root p-6">
                    <ul className="-mb-8">
                      {history.map((item, idx) => {
                        const interactionType = item.type || item.interaction_type;
                        const isLast = idx === history.length - 1;
                        let icon = 'fa-solid fa-note-sticky', iconColor = 'text-blue-400', bg = 'bg-gray-50', typeLabel = 'NOTA';
                        if (interactionType === 'CALL') { icon = 'fa-solid fa-phone'; iconColor = 'text-green-500'; bg = 'bg-sky-50'; typeLabel = 'LLAMADA'; }
                        if (interactionType === 'MEETING') { icon = 'fa-solid fa-handshake'; iconColor = 'text-purple-500'; bg = 'bg-purple-50'; typeLabel = 'REUNIÓN'; }
                        if (interactionType === 'EMAIL') { icon = 'fa-solid fa-envelope'; iconColor = 'text-amber-500'; bg = 'bg-amber-50'; typeLabel = 'EMAIL'; }
                        if (interactionType === 'SYSTEM') { icon = 'fa-solid fa-robot'; iconColor = 'text-slate-400'; bg = 'bg-slate-100'; typeLabel = 'SISTEMA'; }
                        return (
                          <li key={item.id_interaction}>
                            <div className="relative pb-8">
                              {!isLast && (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                              )}
                              <div className="flex items-start gap-3">
                                {/* Avatar/Icono */}
                                <div className="relative w-9 h-9">
                                  <img
                                    src={item.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user_name || 'S')}&background=random`}
                                    alt="avatar"
                                    className="w-9 h-9 rounded-full border border-slate-200 object-cover absolute top-0 left-0 z-0"
                                  />
                                  <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center text-xs border-2 border-white bg-slate-100 z-10 ${iconColor}`}
                                    title={typeLabel}
                                  >
                                    <i className={`${icon}`}></i>
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-sm truncate">
                                      {item.user_name || 'Sistema'}
                                    </span>
                                    <span className="text-xs text-slate-400">{item.date_fmt || (item.created_at && new Date(item.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                      interactionType === 'CALL' ? 'bg-green-50 text-green-600 border-green-100' :
                                      interactionType === 'MEETING' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                      interactionType === 'EMAIL' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                      interactionType === 'SYSTEM' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                      'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                      {typeLabel}
                                    </span>
                                    {item.is_deal_interaction !== undefined && (
                                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.is_deal_interaction ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                        {item.is_deal_interaction ? 'FASE TRATO' : 'FASE PROSPECCIÓN'}
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
                                        <div className="text-slate-700 text-[15px] whitespace-pre-line">{item.description}</div>
                                        {(item.next_action_desc || item.next_contact_date) && (
                                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                            <i className="fa-solid fa-arrow-right text-slate-400"></i>
                                            <span className="font-semibold">Siguiente acción:</span>
                                            {item.next_action_desc && <span>{item.next_action_desc}</span>}
                                            {item.next_contact_date && <span className="ml-2">({new Date(item.next_contact_date).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })})</span>}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )
              )}
          </div>
        </div>
      </div>

      {/* EDIT CONTACT MODAL */}
      {showEditContact && contact && (
        <ContactFormModal
          isOpen={showEditContact}
          onClose={() => setShowEditContact(false)}
          mode="edit"
          initialData={contact}
          preselectedCompanyId={contact.id_client_company || ''}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* SHARE MODAL MEJORADO (Estilo Lista Checkbox) */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Compartir Contacto</h2>
                <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fa-solid fa-times text-lg"></i>
                </button>
            </div>

            <form className="p-6 space-y-6" onSubmit={handleShareContact}>
              
              {/* USUARIOS (CHECKBOX LIST) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Usuario</label>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 custom-scrollbar">
                    {shareUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No hay usuarios disponibles.</p>
                    ) : (
                        shareUsers.map(u => {
                            const isSelected = shareTargets.includes(u.id_user);
                            return (
                                <div 
                                    key={u.id_user} 
                                    onClick={() => toggleShareTarget(u.id_user)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                                        isSelected 
                                        ? 'bg-brand-50 border-brand-200' 
                                        : 'hover:bg-slate-50 border-transparent'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                        isSelected 
                                        ? 'bg-brand-600 border-brand-600 text-white' 
                                        : 'bg-white border-slate-300'
                                    }`}>
                                        {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-slate-700'}`}>
                                            {u.name_user}
                                        </p>
                                        <p className="text-xs text-slate-400">{u.email_user}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
              </div>

              {/* PERMISOS (SEGMENTED CONTROL) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Permiso</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    key="VIEW"
                    onClick={() => setSharePermission('VIEW')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        sharePermission === 'VIEW' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Solo ver
                  </button>
                  <button
                    type="button"
                    key="EDIT"
                    onClick={() => setSharePermission('EDIT')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        sharePermission === 'EDIT' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Puede editar
                  </button>
                </div>
              </div>

              {/* FOOTER */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShareModalOpen(false)} className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors">Cancelar</button>
                <button
                  type="submit"
                  disabled={shareSubmitting || shareTargets.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all disabled:opacity-50"
                >
                  {shareSubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Compartir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientContactDetail;

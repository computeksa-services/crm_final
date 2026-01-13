import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientContact, ClientCompany } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

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
  
  // Compartir
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

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
      const contactResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/detail?id_contact=${id}&id_tenant=${tenantId}&id_user=${userId}`);
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
        navigate(location.pathname, { state: { breadcrumb: foundContact.full_name || foundContact.email }, replace: true });
      }

      if (!foundContact) {
        setLoading(false);
        return;
      }

      // 2. Obtener Empresa (si existe)
      if (foundContact.id_client_company) {
        const companyResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies/detail?id_client_company=${foundContact.id_client_company}&id_tenant=${tenantId}&id_user=${userId}`);
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
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
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
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/contacts/share`, {
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
                <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fa-solid fa-arrow-left text-xl"></i>
                </button>
                
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Historial de Interacciones</h3>
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">Próximamente</span>
             </div>
             
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-timeline text-3xl text-slate-300"></i>
                </div>
                <h4 className="font-bold text-slate-700">Sin actividad reciente</h4>
                <p className="text-sm text-slate-500 max-w-xs mt-2">Aquí podrás ver correos, llamadas y reuniones asociadas a {contact.first_name}.</p>
             </div>
          </div>
        </div>
      </div>

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
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { ClientContact, ClientCompany } from '../types';
import Toast from '../components/Toast'; // Necesario para los mensajes de error

const ClientContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(); // Usar useAuth

  const [contact, setContact] = useState<ClientContact | null>(null);
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null); // Añadir estado del toast
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // 1. Obtener el contacto
      const contactResponse = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts/detail?id_contact=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!contactResponse.ok) {
        if (contactResponse.status === 404) {
          setContact(null);
        } else {
          const errorText = await contactResponse.text();
          throw new Error(`Error del servidor al cargar contacto: ${contactResponse.status} - ${errorText}`);
        }
        setLoading(false);
        return;
      }
      const contactText = await contactResponse.text();
      const foundContact: ClientContact | null = contactText ? (Array.isArray(JSON.parse(contactText)) ? JSON.parse(contactText)[0] : JSON.parse(contactText)) : null;
      setContact(foundContact);

      if (!foundContact) { // Si no se encuentra el contacto, no hay empresa
        setLoading(false);
        return;
      }

      // 2. Obtener la empresa asociada (si existe)
      if (foundContact.id_client_company) {
        const companyResponse = await fetch(`https://service.computeksa.com/webhook/api/clients/companies/detail?id_client_company=${foundContact.id_client_company}&id_tenant=${tenantId}&id_user=${userId}`);
        if (!companyResponse.ok) {
          if (companyResponse.status === 404) {
            setCompany(null);
          } else {
            const errorText = await companyResponse.text();
            throw new Error(`Error del servidor al cargar empresa: ${companyResponse.status} - ${errorText}`);
          }
        } else {
          const companyText = await companyResponse.text();
          let parsed: any = null;
          if (companyText) {
            try {
              parsed = JSON.parse(companyText);
            } catch (err) {
              console.warn('No se pudo parsear respuesta de empresa', err);
            }
          }
          const foundCompany: ClientCompany | null = Array.isArray(parsed)
            ? parsed.find((c: ClientCompany) => c.id_client_company === foundContact.id_client_company) || parsed[0] || null
            : parsed || null;
          setCompany(foundCompany);
        }
      }

    } catch (e: any) {
      console.error("Error fetching contact details:", e);
      setToast({ message: e.message || 'Error al cargar los detalles del contacto.', type: 'error' });
      setContact(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isOwnerContact = contact?.created_by === user?.id_user;
  const isOwnerCompany = company?.created_by === user?.id_user;
  const contactAccess: 'VIEW' | 'EDIT' = (contact?.access_level as any) || (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canDelete = isOwnerContact; // Solo owner puede eliminar
  const canShare = (user?.rol_user === 'admin' || isOwnerContact || isOwnerCompany) && contactAccess === 'EDIT';

  const openShareModal = async () => {
    if (!user?.id_tenant || !user?.id_user) {
      setToast({ message: 'No se pudo cargar usuarios. Vuelve a iniciar sesión.', type: 'error' });
      return;
    }
    try {
      const res = await fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('No se pudo cargar usuarios');
      const data = await res.json();
      const activos = Array.isArray(data)
        ? data.filter((u: any) => u.status_user !== 'Inactivo' && u.id_user !== user.id_user)
        : [];
      setShareUsers(activos);
      setShareTargets([]);
      setSharePermission('VIEW');
      setShareModalOpen(true);
    } catch (e: any) {
      setToast({ message: e.message || 'Error al cargar usuarios.', type: 'error' });
    }
  };

  const handleShareContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !user?.id_tenant || shareTargets.length === 0) {
      setToast({ message: 'Selecciona al menos un usuario para compartir.', type: 'error' });
      return;
    }
    if (!canShare) {
      setToast({ message: 'Solo puedes compartir si tienes permisos de edición.', type: 'error' });
      return;
    }
    setShareSubmitting(true);
    try {
      const requests = shareTargets.map(target =>
        fetch('https://service.computeksa.com/webhook/api/contacts/share', {
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
      const responses = await Promise.all(requests);
      const failed = responses.find(r => !r.ok);
      if (failed) throw new Error('No se pudo compartir con alguno de los usuarios');
      setToast({ message: 'Contacto compartido correctamente.', type: 'success' });
      setShareModalOpen(false);
    } catch (error: any) {
      setToast({ message: error.message || 'Error al compartir contacto.', type: 'error' });
    } finally {
      setShareSubmitting(false);
    }
  };


  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles del contacto...</div>;
  if (!contact) return <div className="p-8 text-center text-red-500">Contacto no encontrado.</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{contact.first_name} {contact.last_name}</h1>
            <p className="text-sm text-slate-500">{contact.position || 'Cargo no especificado'}</p>
          </div>
        </div>
        <button
          onClick={openShareModal}
          disabled={!canShare}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${canShare ? 'border-slate-200 text-slate-700 hover:border-brand-500 hover:text-brand-700' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          <i className="fa-solid fa-share-nodes text-slate-500"></i>
          Compartir
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Contact Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información de Contacto</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-500">Email</label>
                <a href={`mailto:${contact.email}`} className="font-medium text-brand-600 hover:underline break-all">{contact.email}</a>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500">Teléfono</label>
                <p className="text-slate-800">{contact.phone || '-'}</p>
              </div>
            </div>
          </div>
          
          {company && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Empresa Asociada</h3>
              <div className="flex items-center">
                 <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 mr-3 text-xl">
                   <i className="fa-solid fa-building"></i>
                 </div>
                 <div>
                   <Link to={`/client-companies/${company.id_client_company}`} className="font-bold text-slate-800 hover:text-brand-600 transition-colors">{company.name_company}</Link>
                   <p className="text-xs text-slate-500">{company.industry || 'Industria no especificada'}</p>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Activity History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-60">
             <h3 className="font-bold text-slate-700 mb-2">Historial de Actividad</h3>
             <p className="text-sm text-slate-500 italic">Esta sección mostrará el historial de interacciones (cotizaciones, tratos, reuniones) con {contact.first_name} próximamente.</p>
          </div>
        </div>
      </div>

      {/* Modal compartir contacto */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400">Compartir contacto</p>
                <h3 className="text-lg font-bold text-slate-800 mt-1">{contact.first_name} {contact.last_name}</h3>
              </div>
              <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleShareContact}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario</label>
                <select
                  multiple
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                  value={shareTargets}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    setShareTargets(options);
                  }}
                  size={Math.min(8, Math.max(3, shareUsers.length))}
                >
                  {shareUsers.map(u => (
                    <option key={u.id_user} value={u.id_user}>
                      {u.name_user} ({u.email_user})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Puedes elegir varios usuarios (Ctrl/Cmd + click).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Permiso</label>
                <div className="flex gap-3">
                  {(['VIEW','EDIT'] as const).map(level => (
                    <button
                      type="button"
                      key={level}
                      onClick={() => setSharePermission(level)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${sharePermission === level ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
                    >
                      {level === 'VIEW' ? 'Solo ver' : 'Puede editar'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShareModalOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300">Cancelar</button>
                <button
                  type="submit"
                  disabled={shareSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {shareSubmitting ? 'Compartiendo...' : 'Compartir'}
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

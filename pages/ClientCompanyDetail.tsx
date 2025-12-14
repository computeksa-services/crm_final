import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { ClientCompany, ClientContact } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientCompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(); // Usar useAuth

  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]);
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  const isOwnerCompany = company?.created_by === user?.id_user;
  const companyAccess: 'VIEW' | 'EDIT' = (company?.access_level as any) || (user?.rol_user === 'admin' || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canEditCompany = companyAccess === 'EDIT';
  const canDeleteContact = (contact: ClientContact) => contact.created_by === user?.id_user; // Solo owner puede eliminar

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // 1. Obtener la empresa cliente (llamando al endpoint de lista y filtrando)
      const companyResponse = await fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_client_company=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!companyResponse.ok) {
        if (companyResponse.status === 404) {
          setCompany(null);
        } else {
          const errorText = await companyResponse.text();
          throw new Error(`Error del servidor al cargar empresa: ${companyResponse.status} - ${errorText}`);
        }
        setLoading(false);
        return;
      }
      const companyText = await companyResponse.text();
      const parsedCompanies = companyText ? JSON.parse(companyText) : [];
      const foundCompany: ClientCompany | null = Array.isArray(parsedCompanies) ? parsedCompanies.find((c: ClientCompany) => c.id_client_company === id) || null : parsedCompanies || null;
      setCompany(foundCompany);

      if (!foundCompany) { // Si no se encuentra la empresa, no hay contactos
        setLoading(false);
        setContacts([]);
        return;
      }

      // 2. Obtener los contactos asociados a esta empresa
      const contactsResponse = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_client_company=${foundCompany.id_client_company}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!contactsResponse.ok) {
        if (contactsResponse.status === 404) {
          setContacts([]);
        } else {
          const errorText = await contactsResponse.text();
          throw new Error(`Error del servidor al cargar contactos: ${contactsResponse.status} - ${errorText}`);
        }
      } else {
        const contactsText = await contactsResponse.text();
        let contactsData: ClientContact[] = [];
        if (contactsText) {
          const parsedContacts = JSON.parse(contactsText);
          if (Array.isArray(parsedContacts)) {
            // Filtrar solo los contactos que pertenecen a esta empresa
            contactsData = parsedContacts.filter((contact: ClientContact) => 
              contact.id_client_company === foundCompany.id_client_company
            );
          } else {
            console.warn("API de contactos devolvió un formato inesperado:", parsedContacts);
            setToast({ message: 'Formato de contactos inesperado desde el servidor.', type: 'error' });
          }
        }
        setContacts(contactsData);
      }

    } catch (e: any) {
      console.error("Error fetching company details:", e);
      setToast({ message: e.message || 'Error al cargar los detalles de la empresa.', type: 'error' });
      setCompany(null);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleContactRowClick = (contactId: string) => {
    navigate(`/client-contacts/${contactId}`);
  };

  // --- CONTACT HANDLERS ---
  const handleAddContact = () => {
    if (!user?.id_tenant || !user?.id_user) {
      setToast({ message: 'Error de sesión. Vuelve a iniciar sesión.', type: 'error' });
      return;
    }
    if (!canEditCompany) {
      setToast({ message: 'No tienes permisos para crear contactos en modo solo lectura.', type: 'error' });
      return;
    }
    setEditingContact({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      id_client_company: id, // Pre-asignamos el ID de la empresa actual
      id_tenant: user.id_tenant, // Aseguramos id_tenant para nuevo contacto
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEditContact = (contact: ClientContact) => {
    if (!canEditCompany && contact.access_level === 'VIEW') {
      setToast({ message: 'Este contacto es solo lectura.', type: 'error' });
      return;
    }
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  // --- SHARE COMPANY HANDLERS ---
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

  const handleShareCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user?.id_tenant || shareTargets.length === 0) {
      setToast({ message: 'Selecciona al menos un usuario para compartir.', type: 'error' });
      return;
    }
    setShareSubmitting(true);
    try {
      const requests = shareTargets.map(target =>
        fetch('https://service.computeksa.com/webhook/api/companies/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_client_company: company.id_client_company,
            id_user_target: target,
            id_tenant: user.id_tenant,
            permission_level: sharePermission,
          }),
        })
      );
      const responses = await Promise.all(requests);
      const failed = responses.find(r => !r.ok);
      if (failed) throw new Error('No se pudo compartir con alguno de los usuarios');
      setToast({ message: 'Empresa compartida correctamente.', type: 'success' });
      setShareModalOpen(false);
    } catch (error: any) {
      setToast({ message: error.message || 'Error al compartir empresa.', type: 'error' });
    } finally {
      setShareSubmitting(false);
    }
  };

  const canShare = user?.rol_user === 'admin' || company?.created_by === user?.id_user;

  const handleDeleteContact = (contact: ClientContact) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Se eliminará este contacto de la empresa.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant || !user?.id_user) return;
        if (!canDeleteContact(contact)) {
          setToast({ message: 'Solo el creador puede eliminar este contacto.', type: 'error' });
          return;
        }
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id_contact: contact.id_contact, 
              id_tenant: user.id_tenant, 
              id_user: user.id_user // id_user para auditoría/permisos
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar contacto.' }));
            throw new Error(errorData.message || 'Error al eliminar contacto.');
          }
          setToast({ message: 'Contacto eliminado.', type: 'success' });
          await fetchData(); // Recargar datos para actualizar la UI
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar contacto.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !user?.id_tenant || !user?.id_user) return;
    setSubmitting(true);

    const payload = {
        ...editingContact,
        id_client_company: id, // Aseguramos que el contacto se asocia a la empresa actual
        id_tenant: user.id_tenant, // Aseguramos id_tenant
        id_user: user.id_user, // id_user para auditoría/permisos
    };

    try {
      if (isEditMode && payload.id_contact) {
        const response = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al actualizar contacto.' }));
            throw new Error(errorData.message || 'Error al actualizar contacto.');
        }
        setToast({ message: 'Contacto actualizado.', type: 'success' });
      } else {
        const response = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al crear contacto.' }));
            throw new Error(errorData.message || 'Error al crear contacto.');
        }
        setToast({ message: 'Contacto creado.', type: 'success' });
      }
      setIsModalOpen(false);
      await fetchData(); // Recargar datos para actualizar la UI
    } catch (error: any) {
      console.error("Error saving contact:", error);
      setToast({ message: error.message || 'Error al guardar el contacto.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingContact(prev => (prev ? { ...prev, [name]: value } : null));
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles...</div>;
  if (!company) return <div className="p-8 text-center text-red-500">Empresa no encontrada.</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/client-companies')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{company.name_company}</h1>
            <p className="text-sm text-slate-500">{company.industry || 'Industria no especificada'} • {company.city || 'Ciudad no especificada'}</p>
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
        
        {/* Left Column: Company Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información General</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{company.id_type || 'ID'}</label>
                <p className="font-mono text-sm text-slate-800">{company.id_number}</p>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contacto Principal</label>
                <div className="flex items-center space-x-2 text-sm text-slate-700">
                   <i className="fa-solid fa-envelope w-4 text-slate-400"></i>
                   <a href={`mailto:${company.email_company}`} className="hover:text-brand-600 truncate">{company.email_company || '-'}</a>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-700 mt-1">
                   <i className="fa-solid fa-phone w-4 text-slate-400"></i>
                   <span>{company.phone_company || '-'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Ubicación</label>
                <p className="text-sm text-slate-700">{company.address || '-'}</p>
              </div>

              {company.website && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Web</label>
                  <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline break-all">
                    {company.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Activity/History - Placeholder */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-60">
             <h3 className="font-bold text-slate-700 mb-2">Historial de Actividad</h3>
             <p className="text-sm text-slate-500 italic">Esta sección mostrará el historial de interacciones con {company.name_company} próximamente.</p>
          </div>

        </div>

        {/* Right Column: Contacts List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700">Contactos ({contacts.length})</h3>
              <button onClick={handleAddContact} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded">
                <i className="fa-solid fa-user-plus mr-1"></i> Añadir Contacto
              </button>
            </div>
            {contacts.length === 0 ? (
              <div className="p-6 text-center text-slate-400 italic">No hay contactos para esta empresa.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-white border-b">
                    <tr>
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Cargo</th>
                      <th className="px-6 py-3">Contacto</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.map((contact) => {
                      const contactAccess: 'VIEW' | 'EDIT' = (contact.access_level as any) || (contact.created_by === user?.id_user || user?.rol_user === 'admin' ? 'EDIT' : 'VIEW');
                      const disableEdit = contactAccess === 'VIEW' && !canEditCompany;
                      const disableDelete = !canDeleteContact(contact);
                      return (
                      <tr key={contact.id_contact} onClick={() => handleContactRowClick(contact.id_contact)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4 font-medium text-slate-800">{contact.first_name} {contact.last_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{contact.position || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="text-slate-800">{contact.email || '-'}</div>
                          <div className="text-xs text-slate-500">{contact.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            disabled={disableEdit}
                            onClick={(e) => { e.stopPropagation(); if (!disableEdit) handleEditContact(contact); }}
                            className={`p-2 ${disableEdit ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600'}`}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            disabled={disableDelete}
                            onClick={(e) => { e.stopPropagation(); if (!disableDelete) handleDeleteContact(contact); }}
                            className={`p-2 ${disableDelete ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600'}`}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal compartir empresa */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400">Compartir empresa</p>
                <h3 className="text-lg font-bold text-slate-800 mt-1">{company.name_company}</h3>
              </div>
              <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleShareCompany}>
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
                <p className="text-xs text-slate-500 mt-1">Puedes elegir varios usuarios (Ctrl/Cmd + click).</p>
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

      {/* Contact Modal */}
      {isModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                  <input name="first_name" value={editingContact.first_name || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Apellido</label>
                  <input name="last_name" value={editingContact.last_name || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cargo / Puesto</label>
                <input name="position" value={editingContact.position || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                <input type="email" name="email" value={editingContact.email || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                <input name="phone" value={editingContact.phone || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="flex justify-end pt-4 space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                    {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                    Guardar
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCompanyDetail;
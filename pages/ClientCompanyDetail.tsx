import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientCompany, ClientContact } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientCompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- ESTADOS DE DATOS ---
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- ESTADOS COMPARTIR (SHARE) ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<{ id_user: string; name_user: string; email_user: string; status_user?: string }[]>([]);
  const [shareTargets, setShareTargets] = useState<string[]>([]); // Array de IDs seleccionados
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  // --- PERMISOS ---
  const isOwnerCompany = company?.created_by === user?.id_user;
  const companyAccess: 'VIEW' | 'EDIT' = (company?.access_level as any) || (user?.rol_user === 'admin' || isOwnerCompany ? 'EDIT' : 'VIEW');
  const canEditCompany = companyAccess === 'EDIT';
  const canShare = user?.rol_user === 'admin' || isOwnerCompany;
  const canDeleteContact = (contact: ClientContact) => contact.created_by === user?.id_user;

  // --- MODALES EDICIÓN ---
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

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!id || !user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      // 1. Obtener Empresa
      const companyResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/companies?id_client_company=${id}&id_tenant=${tenantId}&id_user=${userId}`);
      if (!companyResponse.ok) throw new Error(`Error al cargar empresa.`);
      
      const companyText = await companyResponse.text();
      const parsedCompanies = companyText ? JSON.parse(companyText) : [];
      const foundCompany = Array.isArray(parsedCompanies) 
        ? parsedCompanies.find((c: ClientCompany) => c.id_client_company === id) 
        : parsedCompanies;
      
      setCompany(foundCompany || null);

      if (!foundCompany) {
        setLoading(false);
        setContacts([]);
        return;
      }

      // 2. Obtener Contactos
      const contactsResponse = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts?id_client_company=${foundCompany.id_client_company}&id_tenant=${tenantId}&id_user=${userId}`);
      if (contactsResponse.ok) {
        const contactsText = await contactsResponse.text();
        if (contactsText) {
          const parsedContacts = JSON.parse(contactsText);
          if (Array.isArray(parsedContacts)) {
            const filtered = parsedContacts.filter((contact: ClientContact) => 
              contact.id_client_company === foundCompany.id_client_company
            );
            setContacts(filtered);
          }
        }
      }

    } catch (e: any) {
      console.error("Error:", e);
      setToast({ message: 'Error al cargar los detalles.', type: 'error' });
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleContactRowClick = (contactId: string) => navigate(`/client-contacts/${contactId}`);

  // --- HANDLERS CONTACTO (Create/Edit/Delete) ---
  // ... (Mantenemos la lógica de contactos igual que antes)
  const handleAddContact = () => {
    if (!user?.id_tenant) return;
    if (!canEditCompany) { setToast({ message: 'No tienes permisos.', type: 'error' }); return; }
    setEditingContact({
      first_name: '', last_name: '', email: '', phone: '', position: '',
      id_client_company: id, id_tenant: user.id_tenant,
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEditContact = (contact: ClientContact) => {
    if (!canEditCompany && contact.access_level === 'VIEW') { setToast({ message: 'Solo lectura.', type: 'error' }); return; }
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDeleteContact = (contact: ClientContact) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Se eliminará este contacto.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_contact: contact.id_contact, id_tenant: user.id_tenant, id_user: user.id_user }),
          });
          setToast({ message: 'Contacto eliminado.', type: 'success' });
          await fetchData();
        } catch (error: any) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !user?.id_tenant) return;
    setSubmitting(true);
    const payload = { ...editingContact, id_client_company: id, id_tenant: user.id_tenant, id_user: user.id_user };
    try {
      const url = isEditMode && payload.id_contact
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts/update`
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/clients/contacts`;
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setToast({ message: isEditMode ? 'Contacto actualizado.' : 'Contacto creado.', type: 'success' });
      setIsModalOpen(false);
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingContact(prev => (prev ? { ...prev, [name]: value } : null));
  };

  // --- HANDLERS COMPARTIR (Nueva Lógica de UI) ---
  const openShareModal = async () => {
    if (!user?.id_tenant) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users?id_tenant=${user.id_tenant}&id_user=${user.id_user}`);
      if (!res.ok) throw new Error('Error');
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

  // Función para seleccionar/deseleccionar usuarios (Checkbox logic)
  const toggleShareTarget = (userId: string) => {
    setShareTargets(prev => 
        prev.includes(userId) 
        ? prev.filter(id => id !== userId) // Quitar si ya está
        : [...prev, userId] // Agregar si no está
    );
  };

  const handleShareCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user?.id_tenant || shareTargets.length === 0) {
      setToast({ message: 'Selecciona al menos un usuario.', type: 'error' });
      return;
    }
    setShareSubmitting(true);
    try {
      const requests = shareTargets.map(target =>
        fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/companies/share`, {
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
      await Promise.all(requests);
      setToast({ message: 'Empresa compartida.', type: 'success' });
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
        <p className="text-slate-500 font-medium animate-pulse">Cargando...</p>
      </div>
    </div>
  );
  
  if (!company) return (
    <div className="flex h-64 items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-xl border border-red-100">
            <h3 className="text-lg font-bold text-red-700">Empresa no encontrada</h3>
            <button onClick={() => navigate('/client-companies')} className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Volver</button>
        </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-5">
                <button onClick={() => navigate('/client-companies')} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fa-solid fa-arrow-left text-xl"></i>
                </button>
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm text-indigo-600 text-3xl">
                    <i className="fa-solid fa-building"></i>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{company.name_company}</h1>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        {company.industry && <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{company.industry}</span>}
                        {company.city && <span><i className="fa-solid fa-location-dot mr-1 text-slate-400"></i> {company.city}</span>}
                    </div>
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
        
        {/* Detalles Empresa */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Información Clave</h3>
            </div>
            <div className="p-6 space-y-5">
                <div>
                    <p className="text-xs text-slate-400 mb-1">Identificación ({company.id_type || 'ID'})</p>
                    <p className="font-mono text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                        {company.id_number}
                    </p>
                </div>

                {company.website && (
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Sitio Web</p>
                        <a href={company.website} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                            {company.website} <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 pt-2 border-t border-dashed border-slate-100">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Email Principal</p>
                        <a href={`mailto:${company.email_company}`} className="text-sm text-slate-700 hover:text-brand-600 flex items-center gap-2">
                            <i className="fa-regular fa-envelope text-slate-400"></i>
                            {company.email_company || 'No registrado'}
                        </a>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Teléfono</p>
                        <div className="text-sm text-slate-700 flex items-center gap-2">
                            <i className="fa-solid fa-phone text-slate-400"></i>
                            {company.phone_company || 'No registrado'}
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-slate-400 mb-1">Dirección</p>
                    <p className="text-sm text-slate-700 leading-snug">{company.address || 'Sin dirección'}</p>
                </div>
            </div>
          </div>
        </div>

        {/* Lista Contactos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-users text-slate-400"></i> Contactos
                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{contacts.length}</span>
                </h3>
                <button 
                    onClick={handleAddContact} 
                    disabled={!canEditCompany}
                    className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i className="fa-solid fa-plus mr-1"></i> Nuevo
                </button>
            </div>

            {contacts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i className="fa-regular fa-address-book text-4xl mb-3 opacity-30"></i>
                    <p>No hay contactos registrados.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-3 border-b border-slate-100">Nombre</th>
                                <th className="px-6 py-3 border-b border-slate-100">Cargo</th>
                                <th className="px-6 py-3 border-b border-slate-100">Info</th>
                                <th className="px-6 py-3 border-b border-slate-100 text-right w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {contacts.map((contact) => {
                                const disableEdit = !canEditCompany;
                                const disableDelete = !canDeleteContact(contact);
                                return (
                                    <tr 
                                        key={contact.id_contact} 
                                        onClick={() => handleContactRowClick(contact.id_contact)} 
                                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                                                    {(contact.first_name || 'C').charAt(0)}
                                                </div>
                                                <span className="font-medium text-slate-700">{contact.first_name} {contact.last_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{contact.position || '-'}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">{contact.email}</div>
                                            <div className="text-xs text-slate-400">{contact.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    disabled={disableEdit}
                                                    onClick={(e) => { e.stopPropagation(); if (!disableEdit) handleEditContact(contact); }}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button
                                                    disabled={disableDelete}
                                                    onClick={(e) => { e.stopPropagation(); if (!disableDelete) handleDeleteContact(contact); }}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* SHARE MODAL MEJORADO (Estilo de la imagen) */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h2 className="font-bold text-lg text-slate-800 uppercase tracking-wide">Compartir Empresa</h2>
                <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fa-solid fa-times text-lg"></i>
                </button>
            </div>

            <form className="p-6 space-y-6" onSubmit={handleShareCompany}>
              
              {/* LISTA DE USUARIOS (CHECKBOXES) */}
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
                <button 
                    type="button" 
                    onClick={() => setShareModalOpen(false)} 
                    className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                  type="submit"
                  disabled={shareSubmitting || shareTargets.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {shareSubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Compartir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONTACTO (Mismo estilo que lista) */}
      {isModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                  <input name="first_name" value={editingContact.first_name || ''} onChange={handleInputChange} required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apellido</label>
                  <input name="last_name" value={editingContact.last_name || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Pérez" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cargo</label>
                <input name="position" value={editingContact.position || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Gerente" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input type="email" name="email" value={editingContact.email || ''} onChange={handleInputChange} required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="email@ejemplo.com" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                <input name="phone" value={editingContact.phone || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="+593..." />
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100 mt-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                    {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
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
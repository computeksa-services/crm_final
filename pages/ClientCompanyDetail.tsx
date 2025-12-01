

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MockApi } from '../services/mockApi';
import { ClientCompany, ClientContact } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientCompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<ClientCompany | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
    if (!id) return;
    setLoading(true);
    try {
      const foundCompany = await MockApi.getClientCompanyById(id);
      
      if (!foundCompany) {
        setCompany(null);
      } else {
        setCompany(foundCompany);
        
        const allContacts = await MockApi.getClientContacts();
        
        const filteredContacts = allContacts.filter(c => {
            return String(c.id_client_company).trim() === String(id).trim();
        });
        
        setContacts(filteredContacts);
      }
    } catch (e) {
      setToast({ message: 'Error al cargar detalles.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleContactRowClick = (contactId: string) => {
    navigate(`/client-contacts/${contactId}`);
  };

  // --- CONTACT HANDLERS ---
  const handleAddContact = () => {
    setEditingContact({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      id_client_company: id // Pre-asignamos el ID
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEditContact = (contact: ClientContact) => {
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDeleteContact = (contactId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Se eliminará este contacto de la empresa.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await MockApi.deleteClientContact(contactId);
          await fetchData(); // Recargar datos para actualizar la UI y la caché
          setToast({ message: 'Contacto eliminado.', type: 'success' });
        } catch (error) {
          setToast({ message: 'Error al eliminar contacto.', type: 'error' });
        }
      },
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setSubmitting(true);

    try {
      if (isEditMode && editingContact.id_contact) {
        await MockApi.updateClientContact(editingContact.id_contact, editingContact);
        setToast({ message: 'Contacto actualizado.', type: 'success' });
      } else {
        const payload = { 
            ...editingContact, 
            id_client_company: id 
        };
        await MockApi.addClientContact(payload);
        setToast({ message: 'Contacto añadido.', type: 'success' });
      }
      setIsModalOpen(false);
      await fetchData(); // Recargar datos para actualizar la UI y la caché
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error al guardar contacto.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <div className="flex items-center space-x-4 mb-2">
        <button onClick={() => navigate('/client-companies')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{company.name_company}</h1>
          <p className="text-sm text-slate-500">{company.industry || 'Industria no especificada'} • {company.city || 'Ciudad no especificada'}</p>
        </div>
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
        </div>

        {/* Right Column: Contacts & Activity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Contacts Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-700">Contactos Asociados</h3>
              <button onClick={handleAddContact} className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded shadow-sm transition-colors font-medium">
                <i className="fa-solid fa-user-plus mr-1"></i> Añadir Contacto
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic bg-slate-50/50">
                No hay contactos registrados para esta empresa.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Nombre</th>
                    <th className="px-6 py-3">Cargo</th>
                    <th className="px-6 py-3">Email / Teléfono</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {contacts.map((contact) => (
                    <tr 
                      key={contact.id_contact} 
                      onClick={() => handleContactRowClick(contact.id_contact)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-6 py-3 font-medium text-slate-700">
                        {contact.first_name} {contact.last_name}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{contact.position || '-'}</td>
                      <td className="px-6 py-3">
                        <div className="text-slate-800">{contact.email}</div>
                        <div className="text-xs text-slate-500">{contact.phone}</div>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEditContact(contact); }} className="text-slate-400 hover:text-brand-600"><i className="fa-solid fa-pen"></i></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id_contact); }} className="text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Placeholder for Deals/Quotes history */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-60">
             <h3 className="font-bold text-slate-700 mb-2">Historial de Cotizaciones y Tratos</h3>
             <p className="text-sm text-slate-500 italic">Esta sección mostrará el historial de actividad comercial con {company.name_company} próximamente.</p>
          </div>

        </div>
      </div>

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
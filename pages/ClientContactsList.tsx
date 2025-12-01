

import React, { useEffect, useState, useCallback } from 'react';
import { MockApi } from '../services/mockApi';
import { ClientContact, ClientCompany } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';

const ClientContactsList: React.FC = () => {
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<ClientContact> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation Modal
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [contactsData, companiesData] = await Promise.all([
        MockApi.getClientContacts(),
        MockApi.getClientCompanies()
      ]);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
    } catch (e) {
      setToast({ message: 'Error al cargar datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCompanyName = (id: string | undefined) => {
    if (!id) return '- Sin Empresa -';
    const comp = companies.find(c => c.id_client_company === id);
    return comp ? comp.name_company : 'Desconocida';
  };

  const handleRowClick = (id: string) => {
    navigate(`/client-contacts/${id}`);
  };

  const handleAddNew = () => {
    if (companies.length === 0) {
      setToast({ message: 'Primero debes crear una Empresa Cliente.', type: 'error' });
      return;
    }
    setEditingContact({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      id_client_company: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (contact: ClientContact) => {
    setEditingContact(contact);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await MockApi.deleteClientContact(id);
          await fetchData(); // Recargar datos para actualizar la UI y la caché
          setToast({ message: 'Contacto eliminado.', type: 'success' });
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    
    if (!editingContact.id_client_company) {
        setToast({ message: 'Debes seleccionar una Empresa Cliente.', type: 'error' });
        return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && editingContact.id_contact) {
        await MockApi.updateClientContact(editingContact.id_contact, editingContact);
        setToast({ message: 'Contacto actualizado.', type: 'success' });
      } else {
        await MockApi.addClientContact(editingContact);
        setToast({ message: 'Contacto creado.', type: 'success' });
      }
      setIsModalOpen(false);
      await fetchData(); // Recargar datos para actualizar la UI y la caché
    } catch (error) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingContact(prev => (prev ? { ...prev, [name]: value } : null));
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Contactos Clientes</h1>
           <p className="text-slate-500 text-sm">Base de datos global de personas de contacto.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-user-plus mr-2"></i> Nuevo Contacto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando contactos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Nombre</th>
                  <th className="px-6 py-4 border-b">Empresa</th>
                  <th className="px-6 py-4 border-b">Cargo</th>
                  <th className="px-6 py-4 border-b">Contacto</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay contactos registrados.</td></tr>
                ) : (
                  contacts.map((contact) => (
                    <tr 
                      key={contact.id_contact} 
                      onClick={() => handleRowClick(contact.id_contact)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {contact.first_name} {contact.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                           <i className="fa-solid fa-building mr-1"></i>
                           {getCompanyName(contact.id_client_company)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{contact.position || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-slate-800">{contact.email}</div>
                        <div className="text-xs text-slate-500">{contact.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(contact); }} className="p-2 text-slate-400 hover:text-brand-600">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(contact.id_contact); }} className="p-2 text-slate-400 hover:text-red-600">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente <span className="text-red-500">*</span></label>
                 <select 
                    name="id_client_company" 
                    value={editingContact.id_client_company || ''} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                 >
                    <option value="">-- Seleccione una empresa --</option>
                    {companies.map(comp => (
                        <option key={comp.id_client_company} value={comp.id_client_company}>
                            {comp.name_company}
                        </option>
                    ))}
                 </select>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                    <input type="email" name="email" value={editingContact.email || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                    <input name="phone" value={editingContact.phone || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
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

export default ClientContactsList;
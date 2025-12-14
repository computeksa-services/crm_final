import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { ClientContact, ClientCompany } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientContactsList: React.FC = () => {
  const { user } = useAuth(); // Usar useAuth
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();
  
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
    if (!user?.id_tenant || !user?.id_user) return; // Asegurar que user y tenant/user IDs existan
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [contactsRes, companiesRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/clients/contacts?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return []; // Si no se encuentra, devolver array vacío
          const errorText = await res.text();
          throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        let data = [];
        if (text) {
          const parsed = JSON.parse(text);

          
          if (Array.isArray(parsed)) {
            data = parsed;
          } else {
            console.warn("API devolvió un formato inesperado (no un array):", parsed);
            setToast({ message: 'Formato de datos inesperado desde el servidor.', type: 'error' });
          }
        }
        return data;
      };

      const contactsData = await parseResponse(contactsRes);
      const companiesData = await parseResponse(companiesRes);

      setContacts(contactsData);
      setCompanies(companiesData);
    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: e.message || 'Error al cargar datos de contactos o empresas.', type: 'error' });
      setContacts([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        if (!user?.id_tenant || !user?.id_user) return; // Asegurar user IDs
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/clients/contacts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_contact: id, id_tenant: user.id_tenant, id_user: user.id_user }), // Añadir id_tenant y id_user
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar contacto.' }));
            throw new Error(errorData.message || 'Error al eliminar contacto.');
          }
          await fetchData(); // Recargar datos para actualizar la UI
          setToast({ message: 'Contacto eliminado.', type: 'success' });
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !user?.id_tenant || !user?.id_user) return; // Asegurar user IDs
    
    if (!editingContact.id_client_company) {
        setToast({ message: 'Debes seleccionar una Empresa Cliente.', type: 'error' });
        return;
    }

    setSubmitting(true);
    
    const payload = {
        ...editingContact,
        id_tenant: user.id_tenant,
        id_user: user.id_user, // Añadir id_user al payload
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
      setToast({ message: error.message || 'Error al guardar el contacto.', type: 'error' });
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
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Cargando contactos...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay contactos registrados.</td></tr>
              ) : (
                Array.isArray(contacts) && contacts.map((contact) => (
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
      </div>

      {isModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="id_client_company" className="block text-xs font-bold text-slate-500 mb-1">Empresa Cliente</label>
                <select
                  id="id_client_company"
                  name="id_client_company"
                  required
                  value={editingContact.id_client_company || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Empresa --</option>
                  {companies.map(company => (
                    <option key={company.id_client_company} value={company.id_client_company}>
                      {company.name_company}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    value={editingContact.first_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-xs font-bold text-slate-500 mb-1">Apellido</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={editingContact.last_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="position" className="block text-xs font-bold text-slate-500 mb-1">Cargo</label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={editingContact.position || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={editingContact.email || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={editingContact.phone || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end pt-4 space-x-2 border-t mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >Cancelar</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center"
                >
                  {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                  Guardar Contacto
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
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { ClientCompany, User } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ClientCompaniesList: React.FC = () => {
  const { user } = useAuth(); // Usar useAuth
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [users, setUsers] = useState<User[]>([]); // Para mostrar el nombre del creador
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<ClientCompany> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setLoading(true);
    const tenantId = user.id_tenant;
    const userId = user.id_user;

    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch(`https://service.computeksa.com/webhook/api/clients/companies?id_tenant=${tenantId}&id_user=${userId}`),
        fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${tenantId}&id_user=${userId}`)
      ]);

      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const errorText = await res.text();
          throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const companiesData = await parseResponse(companiesRes);
      const usersData = await parseResponse(usersRes);

      setCompanies(companiesData);
      setUsers(usersData);
    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: e.message || 'Error al cargar empresas o usuarios.', type: 'error' });
      setCompanies([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getUserName = (id: string | undefined) => {
    if (!id) return '-';
    const creator = users.find(u => u.id_user === id);
    return creator ? creator.name_user : 'Desconocido';
  };

  const handleRowClick = (id: string) => {
    navigate(`/client-companies/${id}`);
  };

  const handleAddNew = () => {
    if (!user?.id_tenant || !user?.id_user) {
      setToast({ message: 'Error de sesión. Vuelve a iniciar sesión.', type: 'error' });
      return;
    }
    setEditingCompany({
      id_type: 'RUC',
      id_number: '',
      name_company: '',
      industry: '',
      address: '',
      city: '',
      website: '',
      phone_company: '',
      email_company: '',
      id_tenant: user.id_tenant, // Asegurar id_tenant para nueva empresa
      created_by: user.id_user, // Asegurar created_by para nueva empresa
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (comp: ClientCompany) => {
    setEditingCompany(comp);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Empresa Cliente',
      message: '¿Estás seguro? Esto eliminará la empresa y sus contactos asociados.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant || !user?.id_user) return; // Asegurar user IDs
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/client-companies/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id_client_company: id, 
              id_tenant: user.id_tenant, 
              id_user: user.id_user // id_user para auditoría/permisos
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar empresa.' }));
            throw new Error(errorData.message || 'Error al eliminar empresa.');
          }
          setToast({ message: 'Empresa cliente eliminada.', type: 'success' });
          await fetchData(); 
        } catch (error: any) {
          setToast({ message: error.message || 'Error al eliminar.', type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState({ ...confirmState, isOpen: false });
        }
      },
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      setIsModalOpen(false);
      setConfirmState({
        isOpen: true,
        title: 'Guardar Cambios',
        message: '¿Confirmas guardar los cambios de esta empresa?',
        isDestructive: false,
        onConfirm: () => performSubmit(),
      });
    } else {
      performSubmit();
    }
  };

  const performSubmit = async () => {
    if (!editingCompany || !user?.id_tenant || !user?.id_user) return;
    setSubmitting(true);
    
    const payload = {
        ...editingCompany,
        id_tenant: user.id_tenant, // Asegura que el tenant ID sea el del usuario logueado
        id_user: user.id_user, // id_user para auditoría/permisos en update/create
        created_by: editingCompany.created_by || user.id_user, // Mantener si existe, o usar el actual al crear
    };

    try {
      if (isEditMode && payload.id_client_company) {
        // --- LÓGICA DE ACTUALIZACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/client-companies/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al actualizar empresa.' }));
            throw new Error(errorData.message || 'Error al actualizar empresa.');
        }
        setToast({ message: 'Empresa actualizada.', type: 'success' });
      } else {
        // --- LÓGICA DE CREACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/client-companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al crear empresa.' }));
            throw new Error(errorData.message || 'Error al crear empresa.');
        }
        setToast({ message: 'Empresa creada.', type: 'success' });
      }
      setIsModalOpen(false); 
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar la empresa.', type: 'error' });
    } finally {
      setSubmitting(false); 
      setConfirmState({ ...confirmState, isOpen: false });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingCompany(prev => (prev ? { ...prev, [name]: value } : null));
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
           <h1 className="text-2xl font-bold text-slate-800">Empresas Clientes (B2B)</h1>
           <p className="text-slate-500 text-sm">Gestiona tu cartera de clientes corporativos.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-plus mr-2"></i> Nueva Empresa
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando clientes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Identificación</th>
                  <th className="px-6 py-4 border-b">Razón Social</th>
                  <th className="px-6 py-4 border-b">Industria</th>
                  <th className="px-6 py-4 border-b">Creado Por</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay empresas registradas.</td></tr>
                ) : (
                  companies.map((comp) => (
                    <tr 
                      key={comp.id_client_company} 
                      onClick={() => handleRowClick(comp.id_client_company)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded mr-2">{comp.id_type || 'ID'}</span>
                        <span className="text-slate-700 font-mono text-sm">{comp.id_number}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{comp.name_company}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{comp.industry || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getUserName(comp.created_by)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(comp); }} className="p-2 text-slate-400 hover:text-brand-600">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(comp.id_client_company); }} className="p-2 text-slate-400 hover:text-red-600">
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

      {isModalOpen && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Empresa Cliente' : 'Nueva Empresa Cliente'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="id_type" className="block text-xs font-bold text-slate-500 mb-1">Tipo de Identificación</label>
                <select
                  id="id_type"
                  name="id_type"
                  required
                  value={editingCompany.id_type || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Seleccionar Tipo --</option>
                  <option value="RUC">RUC</option>
                  <option value="CI">Cédula</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label htmlFor="id_number" className="block text-xs font-bold text-slate-500 mb-1">Número de Identificación</label>
                <input
                  type="text"
                  id="id_number"
                  name="id_number"
                  required
                  value={editingCompany.id_number || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="name_company" className="block text-xs font-bold text-slate-500 mb-1">Razón Social</label>
                <input
                  type="text"
                  id="name_company"
                  name="name_company"
                  required
                  value={editingCompany.name_company || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="industry" className="block text-xs font-bold text-slate-500 mb-1">Industria</label>
                <input
                  type="text"
                  id="industry"
                  name="industry"
                  value={editingCompany.industry || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-xs font-bold text-slate-500 mb-1">Ciudad</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={editingCompany.city || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-xs font-bold text-slate-500 mb-1">Dirección</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={editingCompany.address || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email_company" className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    id="email_company"
                    name="email_company"
                    value={editingCompany.email_company || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="phone_company" className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                  <input
                    type="text"
                    id="phone_company"
                    name="phone_company"
                    value={editingCompany.phone_company || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="website" className="block text-xs font-bold text-slate-500 mb-1">Web</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={editingCompany.website || ''}
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
                  Guardar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCompaniesList;
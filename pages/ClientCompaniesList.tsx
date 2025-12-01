

import React, { useEffect, useState, useCallback } from 'react';
import { MockApi } from '../services/mockApi';
import { ClientCompany, User } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';

const ClientCompaniesList: React.FC = () => {
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
    setLoading(true);
    try {
      const [companiesData, usersData] = await Promise.all([
        MockApi.getClientCompanies(),
        MockApi.getUsers()
      ]);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (e) {
      setToast({ message: 'Error al cargar datos.', type: 'error' });
      setCompanies([]); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getUserName = (id: string | undefined) => {
    if (!id) return '-';
    const user = users.find(u => u.id_user === id);
    return user ? user.name_user : 'Desconocido';
  };

  const handleRowClick = (id: string) => {
    navigate(`/client-companies/${id}`);
  };

  const handleAddNew = () => {
    setEditingCompany({
      id_type: 'RUC',
      id_number: '',
      name_company: '',
      industry: '',
      city: '',
      email_company: '',
      phone_company: '',
      website: '',
      address: ''
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
        const original = [...companies];
        setCompanies(prev => prev.filter(c => c.id_client_company !== id));
        try {
          await MockApi.deleteClientCompany(id);
          setToast({ message: 'Empresa cliente eliminada.', type: 'success' });
        } catch (error) {
          setToast({ message: 'Error al eliminar.', type: 'error' });
          setCompanies(original);
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
    if (!editingCompany) return;
    setSubmitting(true);
    try {
      if (isEditMode && editingCompany.id_client_company) {
        await MockApi.updateClientCompany(editingCompany.id_client_company, editingCompany);
        setToast({ message: 'Empresa actualizada.', type: 'success' });
      } else {
        await MockApi.addClientCompany(editingCompany);
        setToast({ message: 'Empresa creada.', type: 'success' });
      }
      setIsModalOpen(false); // Cerrar modal después del éxito
      await fetchData(); // Recargar datos para actualizar la UI y la caché
    } catch (error) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally {
      setSubmitting(false);
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
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center">
                           <i className="fa-solid fa-user-circle text-slate-400 mr-2"></i>
                           {getUserName(comp.created_by)}
                        </div>
                      </td>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                   <label className="block text-xs font-bold text-slate-500 mb-1">Tipo ID</label>
                   <select name="id_type" value={editingCompany.id_type || 'RUC'} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="RUC">RUC</option>
                      <option value="CI">Cédula</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="OTRO">Otro</option>
                   </select>
                </div>
                <div className="col-span-2">
                   <label className="block text-xs font-bold text-slate-500 mb-1">Número Identificación</label>
                   <input name="id_number" value={editingCompany.id_number || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Razón Social / Nombre</label>
                <input name="name_company" value={editingCompany.name_company || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Industria</label>
                   <input name="industry" value={editingCompany.industry || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Ciudad</label>
                   <input name="city" value={editingCompany.city || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Dirección</label>
                <input name="address" value={editingCompany.address || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                   <input type="email" name="email_company" value={editingCompany.email_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                   <input name="phone_company" value={editingCompany.phone_company || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Sitio Web</label>
                <input name="website" value={editingCompany.website || ''} onChange={handleInputChange} placeholder="https://" className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="flex justify-end pt-4 space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                    {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                    {isEditMode ? 'Guardar Cambios' : 'Crear Empresa'}
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

import React, { useEffect, useState, useCallback } from 'react';
import { MockApi } from '../services/mockApi';
import { User, Tenant } from '../types'; // Updated types
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]); // Was companies
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
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
      const [usersData, tenantsData] = await Promise.all([
        MockApi.getUsers(),
        MockApi.getTenants()
      ]);
      setUsers(usersData || []);
      setTenants(tenantsData || []);
    } catch (e) {
      console.error(e);
      setToast({ message: 'No se pudieron cargar algunos datos.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    if (tenants.length === 0) {
      setToast({ message: 'Primero debes crear un Tenant (Empresa Suscriptora).', type: 'error' });
      return;
    }

    setEditingUser({ 
      name_user: '', 
      email_user: '', 
      phone_user: '', 
      password: '', 
      rol_user: 'usuario', 
      job_title: '', 
      id_tenant: tenants[0]?.id_tenant || '' // Default to first tenant
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser({ ...user, password: '' });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: '¿Estás seguro? Esta acción eliminará al usuario permanentemente.',
      isDestructive: true,
      onConfirm: async () => {
        const originalUsers = [...users];
        setUsers(prev => prev.filter(u => u.id_user !== id));
        try {
          await MockApi.deleteUser(id);
          setToast({ message: 'Usuario eliminado.', type: 'success' });
        } catch (error) { 
          setToast({ message: 'Error al eliminar.', type: 'error' });
          setUsers(originalUsers); 
        }
      },
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      setIsModalOpen(false); // Close first
      setConfirmState({
        isOpen: true,
        title: 'Guardar Cambios',
        message: '¿Confirmas que deseas guardar los cambios para este usuario?',
        onConfirm: () => performSubmit(),
        isDestructive: false,
      });
    } else {
      performSubmit();
    }
  };

  const performSubmit = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      if (isEditMode && editingUser.id_user) {
        const apiResponse = await MockApi.updateUser(editingUser.id_user, editingUser);
        const updatedUser = { ...editingUser, ...apiResponse } as User;
        
        setUsers(prev => prev.map(u => u.id_user === updatedUser.id_user ? updatedUser : u));
        setToast({ message: 'Usuario actualizado.', type: 'success' });
      } else {
        const apiResponse = await MockApi.addUser(editingUser);
        const newUser = { ...editingUser, ...apiResponse } as User;
        
        setUsers(prev => [newUser, ...prev]);
        setToast({ message: 'Usuario creado.', type: 'success' });
        setIsModalOpen(false);
      }
    } catch (error) { 
      setToast({ message: 'Error al guardar.', type: 'error' });
    } finally { 
      setSubmitting(false); 
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser(prev => (prev ? { ...prev, [name]: value } : null));
  };

  const getTenantName = (id: string) => tenants.find(t => t.id_tenant === id)?.name_tenant || id;

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
           <h1 className="text-2xl font-bold text-slate-800">Staff del Tenant</h1>
           <p className="text-slate-500 text-sm">Usuarios que pueden acceder a la plataforma bajo un Tenant.</p>
        </div>
        <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <i className="fa-solid fa-user-plus mr-2"></i> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Usuario</th>
                  <th className="px-6 py-4 border-b">Tenant (Empresa)</th>
                  <th className="px-6 py-4 border-b">Rol</th>
                  <th className="px-6 py-4 border-b">Estado</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">No hay usuarios registrados.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr 
                      key={user.id_user} 
                      onClick={() => handleEdit(user)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img className="h-9 w-9 rounded-full object-cover mr-3" src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.name_user}`} alt="" />
                          <div>
                            <div className="font-medium text-slate-800">{user.name_user}</div>
                            <div className="text-xs text-slate-500">{user.email_user}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                         <i className="fa-solid fa-server text-slate-400 mr-1"></i> {getTenantName(user.id_tenant)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          user.rol_user === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.rol_user}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${user.status_user === 'Activo' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-100'}`}>{user.status_user}</span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(user); }} className="p-2 text-slate-400 hover:text-brand-600">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(user.id_user); }} className="p-2 text-slate-400 hover:text-red-600">
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

      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nombre Completo</label>
                <input name="name_user" value={editingUser.name_user || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Tenant (Empresa)</label>
                   <select name="id_tenant" value={editingUser.id_tenant || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      {tenants.map(c => <option key={c.id_tenant} value={c.id_tenant}>{c.name_tenant}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Rol</label>
                   <select name="rol_user" value={editingUser.rol_user || 'usuario'} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="usuario">Usuario</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                   </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cargo</label>
                <input name="job_title" value={editingUser.job_title || ''} onChange={handleInputChange} placeholder="Ej: Gerente de Ventas" className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                <input type="email" name="email_user" value={editingUser.email_user || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                <input name="phone_user" value={editingUser.phone_user || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Contraseña</label>
                  <input type="password" name="password" value={editingUser.password || ''} onChange={handleInputChange} required={!isEditMode} placeholder={isEditMode ? 'Dejar en blanco para no cambiar' : ''} className="w-full px-3 py-2 border rounded-lg" />
              </div>
               <div className="flex justify-end pt-4 space-x-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                 <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm flex items-center">
                    {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>}
                    {isEditMode ? 'Guardar Cambios' : 'Crear Usuario'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;

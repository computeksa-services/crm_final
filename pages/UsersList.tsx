import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Importar useAuth
import { User, Tenant } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const UsersList: React.FC = () => {
  const { user } = useAuth(); // Obtener el usuario del contexto
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
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
      const usersRes = await fetch(`https://service.computeksa.com/webhook/api/users?id_tenant=${tenantId}&id_user=${userId}`);
      
      const parseResponse = async (res: Response) => {
        if (!res.ok) {
          if (res.status === 404) return [];
          const errorText = await res.text();
          throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      };

      const usersData = await parseResponse(usersRes);
      setUsers(usersData);

      // Cargar tenants solo si es superadmin
      if (user.rol_user === 'superadmin') {
        const tenantsRes = await fetch(`https://service.computeksa.com/webhook/api/tenants?id_user=${userId}`);
        const tenantsData = await parseResponse(tenantsRes);
        setTenants(tenantsData);
      } else {
        setTenants([]); // Asegurar que esté vacío si no es superadmin
      }

    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: e.message || 'Error al cargar usuarios o tenants.', type: 'error' });
      setUsers([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [user]); // Dependencia del objeto user

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    if (!user?.id_tenant) {
      setToast({ message: 'Error: No se pudo identificar tu empresa (tenant).', type: 'error' });
      return;
    }
    // Si es superadmin, y no hay tenants aún, no permitir crear
    if (user.rol_user === 'superadmin' && tenants.length === 0) {
      setToast({ message: 'Primero debe crear un Tenant (Empresa Suscriptora).', type: 'error' });
      return;
    }

    setEditingUser({ 
      name_user: '', 
      email_user: '', 
      password: '', 
      phone_user: '', 
      rol_user: 'usuario', 
      job_title: '',
      id_tenant: user.rol_user === 'superadmin' && tenants.length > 0 ? tenants[0]?.id_tenant : user.id_tenant, // Asigna tenant
      status_user: 'Activo',
      avatar_url: ''
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (u: User) => {
    setEditingUser({ ...u, password: '' }); // No cargar la contraseña
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
        if (!user?.id_tenant || !user?.id_user) return; // Asegurar user IDs
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/users/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_user: id, id_tenant: user.id_tenant, id_current_user: user.id_user }), // id_current_user para auditoría
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al eliminar usuario.' }));
            throw new Error(errorData.message || 'Error al eliminar usuario.');
          }
          setToast({ message: 'Usuario eliminado.', type: 'success' });
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
    if (!editingUser || !user?.id_tenant || !user?.id_user) return;
    setSubmitting(true);
    
    const payload = {
        ...editingUser,
        id_tenant: editingUser.id_tenant || user.id_tenant, // Asegura que el tenant ID sea el del usuario logueado o el seleccionado por superadmin
        id_current_user: user.id_user, // Para auditoría en la API
        created_by: user.id_user, // Campo específico para la creación
    };
    
    try {
      if (isEditMode && payload.id_user) {
        // --- LÓGICA DE ACTUALIZACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/users/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al actualizar usuario.' }));
            throw new Error(errorData.message || 'Error al actualizar usuario.');
        }
        setToast({ message: 'Usuario actualizado.', type: 'success' });
      } else {
        // --- LÓGICA DE CREACIÓN ---
        const response = await fetch(`https://service.computeksa.com/webhook/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error al crear usuario.' }));
            throw new Error(errorData.message || 'Error al crear usuario.');
        }
        setToast({ message: 'Usuario creado.', type: 'success' });
      }
      setIsModalOpen(false);
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message || 'Error al guardar el usuario.', type: 'error' });
    } finally { 
      setSubmitting(false); 
      setConfirmState({ ...confirmState, isOpen: false });
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
        {user?.rol_user && (user.rol_user === 'admin' || user.rol_user === 'superadmin') && (
          <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
            <i className="fa-solid fa-user-plus mr-2"></i> Nuevo Usuario
          </button>
        )}
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
                  users.map((u) => (
                    <tr 
                      key={u.id_user} 
                      onClick={() => handleEdit(u)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img className="h-9 w-9 rounded-full object-cover mr-3" src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.name_user}`} alt="" />
                          <div>
                            <div className="font-medium text-slate-800">{u.name_user}</div>
                            <div className="text-xs text-slate-500">{u.email_user}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {getTenantName(u.id_tenant)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 capitalize">{u.rol_user}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          u.status_user === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.status_user}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(u); }} className="p-2 text-slate-400 hover:text-brand-600">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id_user); }} className="p-2 text-slate-400 hover:text-red-600">
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-times text-slate-400"></i></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Si es superadmin, puede elegir el tenant */}
              {user?.rol_user === 'superadmin' && tenants.length > 0 && (
                <div>
                  <label htmlFor="id_tenant" className="block text-xs font-bold text-slate-500 mb-1">Tenant (Empresa)</label>
                  <select
                    id="id_tenant"
                    name="id_tenant"
                    required
                    value={editingUser.id_tenant || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">-- Seleccionar Tenant --</option>
                    {tenants.map(t => (
                      <option key={t.id_tenant} value={t.id_tenant}>
                        {t.name_tenant}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name_user" className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                  <input type="text" id="name_user" name="name_user" required value={editingUser.name_user || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label htmlFor="email_user" className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                  <input type="email" id="email_user" name="email_user" required value={editingUser.email_user || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label htmlFor="job_title" className="block text-xs font-bold text-slate-500 mb-1">Cargo</label>
                <input type="text" id="job_title" name="job_title" value={editingUser.job_title || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label htmlFor="phone_user" className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
                <input type="text" id="phone_user" name="phone_user" value={editingUser.phone_user || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label htmlFor="rol_user" className="block text-xs font-bold text-slate-500 mb-1">Rol</label>
                <select id="rol_user" name="rol_user" required value={editingUser.rol_user || 'usuario'} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="usuario">Usuario</option>
                  <option value="admin">Admin</option>
                  {user?.rol_user === 'superadmin' && <option value="superadmin">Superadmin</option>}
                </select>
              </div>
              {isEditMode ? (
                <div>
                  <label htmlFor="status_user" className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                  <select id="status_user" name="status_user" required value={editingUser.status_user || 'Activo'} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-slate-500 mb-1">Contraseña</label>
                  <input type="password" id="password" name="password" required={!isEditMode} value={editingUser.password || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              )}
              
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
                  Guardar Usuario
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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Tenant } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const UsersList: React.FC = () => {
  const { user } = useAuth();
  
  // Datos
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  // UI & Filtros
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal & Edición
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

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    if (!user?.id_tenant || !user?.id_user) return;
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

      let fetchedTenants: Tenant[] = [];
      if (user.rol_user === 'superadmin') {
        const tenantsRes = await fetch(`https://service.computeksa.com/webhook/api/tenants?id_user=${userId}`);
        fetchedTenants = await parseResponse(tenantsRes);
      } else if (user.id_tenant) {
        const tenantDetailRes = await fetch(`https://service.computeksa.com/webhook/api/tenants/detail?id_tenant=${user.id_tenant}`);
        const tenantDetailData = await parseResponse(tenantDetailRes);
        if (tenantDetailData) {
          fetchedTenants = Array.isArray(tenantDetailData) ? tenantDetailData : [tenantDetailData];
        }
      }
      setTenants(fetchedTenants);

    } catch (e: any) {
      console.error("Error fetching data:", e);
      setToast({ message: e.message || 'Error al cargar usuarios.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTROS ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        (u.name_user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email_user || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter ? u.rol_user === roleFilter : true;
      const matchesStatus = statusFilter ? u.status_user === statusFilter : true;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // --- HANDLERS ---
  const handleAddNew = () => {
    if (!user?.id_tenant) return;
    if (user.rol_user === 'superadmin' && tenants.length === 0) {
      setToast({ message: 'Primero debe crear un Tenant.', type: 'error' });
      return;
    }

    setEditingUser({ 
      name_user: '', 
      email_user: '', 
      phone_user: '', 
      rol_user: 'usuario', 
      job_title: '',
      id_tenant: user.rol_user === 'superadmin' && tenants.length > 0 ? tenants[0]?.id_tenant : user.id_tenant,
      status_user: 'Activo'
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: '¿Estás seguro? Esta acción eliminará al usuario permanentemente y perderá acceso al sistema.',
      isDestructive: true,
      onConfirm: async () => {
        if (!user?.id_tenant) return;
        setSubmitting(true);
        try {
          const response = await fetch(`https://service.computeksa.com/webhook/api/users/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_user: id, id_tenant: user.id_tenant, id_current_user: user.id_user }),
          });
          if (!response.ok) throw new Error('Error al eliminar usuario.');
          
          setToast({ message: 'Usuario eliminado.', type: 'success' });
          await fetchData(); 
        } catch (error: any) {
          setToast({ message: error.message, type: 'error' });
        } finally {
          setSubmitting(false);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !user?.id_tenant) return;
    
    // Validación básica
    if(!editingUser.name_user || !editingUser.email_user) {
        setToast({ message: 'Nombre y Email son obligatorios.', type: 'error' });
        return;
    }

    setSubmitting(true);
    
    const payload = {
        ...editingUser,
        id_tenant: editingUser.id_tenant || user.id_tenant,
        id_current_user: user.id_user
    };
    
    // Convertir strings vacíos y undefined a null para que la BD los interprete como NULL
    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        (value === null || value === undefined || value === '') ? null : value
      ])
    );
    
    try {
      const url = isEditMode 
        ? `https://service.computeksa.com/webhook/api/users/update` 
        : `https://service.computeksa.com/webhook/api/users`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedPayload),
      });

      if (!response.ok) throw new Error(isEditMode ? 'Error al actualizar.' : 'Error al crear.');
      
      setToast({ message: isEditMode ? 'Usuario actualizado.' : 'Usuario creado.', type: 'success' });
      setIsModalOpen(false);
      await fetchData(); 
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally { 
      setSubmitting(false); 
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser(prev => (prev ? { ...prev, [name]: value } : null));
  };

  const getTenantName = (id: string) => tenants.find(t => t.id_tenant === id)?.name_tenant || id;

  // Renderizado condicional
  const renderContent = () => {
    if (loading) {
        return (
          <div className="p-12 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500 mb-4"></i>
              <p className="text-slate-500 font-medium">Cargando usuarios...</p>
          </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-users text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-700">No hay usuarios</h3>
                <p className="text-slate-500 max-w-sm mt-1 mb-6">Agrega miembros a tu equipo para colaborar.</p>
                {(user?.rol_user === 'admin' || user?.rol_user === 'superadmin') && (
                    <button onClick={handleAddNew} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-brand-700 transition-all">
                        Crear Primer Usuario
                    </button>
                )}
            </div>
        );
    }

    if (filteredUsers.length === 0) {
        return (
            <div className="p-12 text-center">
                <i className="fa-solid fa-search text-3xl text-slate-200 mb-4"></i>
                <p className="text-slate-500">No se encontraron usuarios con los filtros actuales.</p>
                <button onClick={() => { setSearchTerm(''); setRoleFilter(''); setStatusFilter(''); }} className="text-brand-600 font-medium mt-2 hover:underline">Limpiar filtros</button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 border-b">Usuario</th>
                  <th className="px-6 py-4 border-b">Rol</th>
                  <th className="px-6 py-4 border-b">Empresa (Tenant)</th>
                  <th className="px-6 py-4 border-b">Estado</th>
                  <th className="px-6 py-4 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((u) => (
                    <tr 
                      key={u.id_user} 
                      onClick={() => handleEdit(u)}
                      className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <img 
                            className="h-10 w-10 rounded-full object-cover border border-slate-200" 
                            src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name_user)}&background=random&size=100`} 
                            alt="" 
                          />
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{u.name_user}</div>
                            <div className="text-xs text-slate-500">{u.email_user}</div>
                            {u.job_title && <div className="text-[10px] text-slate-400 mt-0.5">{u.job_title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${
                            u.rol_user === 'superadmin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                            u.rol_user === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                            {u.rol_user}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                        {getTenantName(u.id_tenant)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          u.status_user === 'Activo' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status_user === 'Activo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {u.status_user}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(u); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id_user); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Usuarios</h1>
           <p className="text-slate-500 text-sm mt-1">Administra el acceso y roles de tu equipo.</p>
        </div>
        {(user?.rol_user === 'admin' || user?.rol_user === 'superadmin') && (
          <button onClick={handleAddNew} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 text-sm font-medium transition-all flex items-center justify-center">
            <i className="fa-solid fa-user-plus mr-2"></i> Nuevo Usuario
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-2.5 text-slate-400">
                <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input 
                type="text"
                placeholder="Buscar por nombre o email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative w-full md:w-40">
                <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                    <option value="">Todos los Roles</option>
                    <option value="admin">Admin</option>
                    <option value="usuario">Usuario</option>
                    {user?.rol_user === 'superadmin' && <option value="superadmin">Superadmin</option>}
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
             </div>

             <div className="relative w-full md:w-40">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                >
                    <option value="">Todos los Estados</option>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                </select>
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
             </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {renderContent()}
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
         <span>Mostrando {filteredUsers.length} de {users.length} usuarios</span>
      </div>

      {/* Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-5">
              
              {/* Sección Principal */}
              <div className="flex flex-col items-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center mb-2 overflow-hidden">
                      {editingUser.avatar_url ? (
                          <img src={editingUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(editingUser.name_user || 'Usuario')}&background=random&size=128`} 
                            alt="Avatar generado" 
                            className="w-full h-full object-cover"
                          />
                      )}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Completo</label>
                  <input type="text" name="name_user" required value={editingUser.name_user || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all" placeholder="Juan Pérez" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input type="email" name="email_user" required value={editingUser.email_user || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all" placeholder="juan@empresa.com" />
                </div>
              </div>

              {/* Roles y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rol</label>
                    <div className="relative">
                        <select name="rol_user" required value={editingUser.rol_user || 'usuario'} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none">
                            <option value="usuario">Usuario</option>
                            <option value="admin">Administrador</option>
                            {user?.rol_user === 'superadmin' && <option value="superadmin">Superadmin</option>}
                        </select>
                        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs"><i className="fa-solid fa-chevron-down"></i></div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                    <div className="relative">
                        <select name="status_user" required value={editingUser.status_user || 'Activo'} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none">
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                        </select>
                        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none text-xs"><i className="fa-solid fa-chevron-down"></i></div>
                    </div>
                </div>
              </div>

              {/* Info Adicional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cargo</label>
                  <input type="text" name="job_title" value={editingUser.job_title || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="Ej. Gerente de Ventas" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                  <input type="text" name="phone_user" value={editingUser.phone_user || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" placeholder="+593..." />
                </div>
              </div>

              {/* Superadmin Tenant Selector */}
              {user?.rol_user === 'superadmin' && tenants.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Asignar a Empresa (Tenant)</label>
                  <select name="id_tenant" required value={editingUser.id_tenant || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-purple-100 rounded-xl bg-purple-50 outline-none focus:ring-2 focus:ring-purple-500 text-purple-900">
                    <option value="">-- Seleccionar --</option>
                    {tenants.map(t => <option key={t.id_tenant} value={t.id_tenant}>{t.name_tenant}</option>)}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 font-medium flex items-center transition-all disabled:opacity-70">
                  {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
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
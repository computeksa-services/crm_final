/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/sections/TenantUsers.tsx
 * Ruta anterior: /app/users
 * Nueva ruta: /app/account-settings?tab=tenantUsers
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { User, Tenant } from '../../types';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import UserModal from '../../components/UserModal';
import { apiFetch } from '../../services/apiClient';
import { handleApiResponse } from '../../utils/apiResponseHandler';

const UsersList: React.FC = () => {
  const { user } = useAuth();
  const { users: cachedUsers, tenants: cachedTenants, loading: cacheLoading, invalidateUsers, currentUser: freshCurrentUser } = useDataCache();
  
  // Obtener usuario actual con todos los campos (incluido is_owner)
  // Priorizar datos frescos del /api/me
  const currentUser = useMemo(() => {
    return freshCurrentUser || cachedUsers.find(u => u.id_user === user?.id_user) || user;
  }, [freshCurrentUser, cachedUsers, user]);
  
  // UI & Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedTenants, setExpandedTenants] = useState<{ [key: string]: boolean }>({});
  
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

  // --- FILTROS ---
  const filteredUsers = useMemo(() => {
    return cachedUsers.filter(u => {
      const matchesSearch = 
        (u.name_user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email_user || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter ? u.rol_user === roleFilter : true;
      const matchesStatus = statusFilter ? u.status_user === statusFilter : true;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [cachedUsers, searchTerm, roleFilter, statusFilter]);

  // --- HANDLERS ---
  const handleAddNew = () => {
    if (!user?.id_tenant) return;
    if (user.rol_user === 'superadmin' && cachedTenants.length === 0) {
      setToast({ message: 'Primero debe crear un Tenant.', type: 'error' });
      return;
    }

    setEditingUser({ 
      name_user: '', 
      email_user: '', 
      phone_user: '', 
      rol_user: 'usuario', 
      job_title: '',
      id_tenant: user.rol_user === 'superadmin' && cachedTenants.length > 0 ? cachedTenants[0]?.id_tenant : user.id_tenant,
      status_user: 'Activo',
      is_owner: false,
      module_access: {
        crm: true,
        marketing: false,
        financials: false
      }
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
          const response = await apiFetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/users/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_user: id, id_tenant: user.id_tenant, id_current_user: user.id_user }),
          });
          
          const result = await handleApiResponse(
            response,
            'Usuario eliminado correctamente.',
            'Error al eliminar usuario.'
          );
          
          if (!result.success) {
            throw new Error(result.message);
          }
          
          setToast({ message: result.message, type: 'success' });
          await invalidateUsers(); 
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
        ? `${import.meta.env.VITE_WEBHOOK_URL}/api/users/update` 
        : `${import.meta.env.VITE_WEBHOOK_URL}/api/users`;

      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedPayload),
      });

      const result = await handleApiResponse(
        response,
        isEditMode ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.',
        isEditMode ? 'Error al actualizar usuario.' : 'Error al crear usuario.'
      );
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      setToast({ message: result.message, type: 'success' });
      setIsModalOpen(false);
      await invalidateUsers(); 
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally { 
      setSubmitting(false); 
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkboxes
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      
      // Si es propietario, no permitir desmarcar módulos
      if (name.startsWith('module_') && editingUser?.is_owner && !checked) {
        return; // No hacer nada, los módulos no se pueden desmarcar si es propietario
      }
      
      // Handle module_access checkboxes
      if (name.startsWith('module_')) {
        const moduleName = name.replace('module_', '');
        setEditingUser(prev => prev ? { 
          ...prev, 
          module_access: {
            ...prev.module_access,
            [moduleName]: checked
          }
        } : null);
      } else if (name === 'is_owner') {
        // Si se marca como propietario, marcar todos los módulos
        if (checked) {
          setEditingUser(prev => prev ? { 
            ...prev, 
            [name]: checked,
            module_access: {
              crm: true,
              marketing: true,
              financials: true
            }
          } : null);
        } else {
          // Si se desmarcar propietario, solo actualizar el flag
          setEditingUser(prev => prev ? { ...prev, [name]: checked } : null);
        }
      } else {
        // Handle other checkboxes
        setEditingUser(prev => prev ? { ...prev, [name]: checked } : null);
      }
    } else {
      // Handle regular inputs
      setEditingUser(prev => prev ? { ...prev, [name]: value } : null);
    }
  };

  const getTenantName = (id: string) => cachedTenants.find(t => t.id_tenant === id)?.name_tenant || id;

  // Agrupar usuarios por tenant
  const groupedUsersByTenant = useMemo(() => {
    const groups: { [key: string]: User[] } = {};
    filteredUsers.forEach(u => {
      const tenantId = u.id_tenant || 'sin-tenant';
      if (!groups[tenantId]) groups[tenantId] = [];
      groups[tenantId].push(u);
    });
    return groups;
  }, [filteredUsers]);

  // Renderizado condicional
  const renderContent = () => {
    if (cacheLoading) {
        return (
          <div className="divide-y divide-slate-100">
            {/* Skeleton Loader - 3 grupos de usuarios */}
            {[1, 2, 3].map((groupIndex) => (
              <div key={groupIndex} className="p-4">
                {/* Tenant Header Skeleton */}
                <div className="flex items-center gap-3 mb-3 animate-pulse">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                  <div className="h-5 bg-slate-200 rounded w-32"></div>
                  <div className="h-4 bg-slate-200 rounded w-12"></div>
                </div>
                
                {/* User Rows Skeleton */}
                {[1, 2].map((rowIndex) => (
                  <div key={rowIndex} className="flex items-center gap-4 p-3 mb-2 animate-pulse">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-40"></div>
                      <div className="h-3 bg-slate-200 rounded w-56"></div>
                    </div>
                    <div className="h-6 bg-slate-200 rounded-full w-24"></div>
                    <div className="h-6 bg-slate-200 rounded-full w-20"></div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                      <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
    }

    if (cachedUsers.length === 0) {
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

    // Vista de Superadmin - Tablas Agrupadas por Empresa (Desplegables)
    if (user?.rol_user === 'superadmin') {
      return (
        <div className="space-y-3">
          {Object.entries(groupedUsersByTenant).map(([tenantId, users]) => {
            const tenantData = cachedTenants.find(t => t.id_tenant === tenantId);
            const isExpanded = expandedTenants[tenantId] !== false; // Por defecto expandido
            
            return (
              <div key={tenantId} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {/* Header Desplegable */}
                <button
                  onClick={() => setExpandedTenants(prev => ({ ...prev, [tenantId]: !prev[tenantId] }))}
                  className="w-full px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 text-sm ${!isExpanded ? '-rotate-90' : ''}`}></i>
                    <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-building text-sm"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{tenantData?.name_tenant || tenantId}</h3>
                      <p className="text-xs text-slate-400">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-400 group-hover:text-slate-600">
                    {isExpanded ? 'Contraer' : 'Expandir'}
                  </div>
                </button>

                {/* Tabla (Contraible) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest sticky top-0">
                        <tr>
                          <th className="px-6 py-3 border-b w-[35%] min-w-[300px]">Usuario</th>
                          <th className="px-6 py-3 border-b w-[25%] min-w-[200px]">Rol & Estado</th>
                          <th className="px-6 py-3 border-b w-[25%] min-w-[250px]">Módulos</th>
                          <th className="px-6 py-3 border-b w-[10%] min-w-[100px]">Conexiones</th>
                          <th className="px-6 py-3 border-b w-[5%] min-w-[80px] text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {users.map((u) => (
                          <tr 
                            key={u.id_user} 
                            onClick={() => handleEdit(u)}
                            className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                          >
                            {/* Usuario Info */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <img 
                                    className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" 
                                    src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name_user)}&background=random&size=100`} 
                                    alt="" 
                                  />
                                  {u.is_owner && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm border border-white" title="Propietario">
                                      <i className="fa-solid fa-crown text-white text-[8px]"></i>
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 text-sm truncate">{u.name_user}</div>
                                  <div className="text-xs text-slate-500 truncate">{u.email_user}</div>
                                  {u.job_title && <div className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider truncate">{u.job_title}</div>}
                                </div>
                              </div>
                            </td>
                            
                            {/* Rol & Estado */}
                            <td className="px-6 py-4">
                              <div className="space-y-1.5 flex flex-col">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold w-fit shadow-sm border-0 ${
                                    u.rol_user === 'superadmin' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                                    u.rol_user === 'admin' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                                    'bg-gradient-to-r from-slate-500 to-slate-600 text-white'
                                }`}>
                                    <i className={`fa-solid ${
                                      u.rol_user === 'superadmin' ? 'fa-shield-halved' :
                                      u.rol_user === 'admin' ? 'fa-user-shield' :
                                      'fa-user'
                                    } text-[9px]`}></i>
                                    {u.rol_user === 'admin' ? 'Administrador' : u.rol_user === 'usuario' ? 'Usuario' : u.rol_user}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold w-fit shadow-sm border-0 ${
                                  u.status_user === 'Activo' 
                                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                }`}>
                                  <span className="w-2 h-2 rounded-full bg-white opacity-60"></span>
                                  {u.status_user}
                                </span>
                              </div>
                            </td>
                            
                            {/* Módulos */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 flex-wrap">
                                {u.module_access?.crm && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold border border-emerald-300 shadow-sm" title="CRM">
                                    <i className="fa-solid fa-users text-[8px]"></i>
                                    CRM
                                  </span>
                                )}
                                {u.module_access?.marketing && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold border border-indigo-300 shadow-sm" title="Marketing">
                                    <i className="fa-solid fa-bullhorn text-[8px]"></i>
                                    MKT
                                  </span>
                                )}
                                {u.module_access?.financials && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-300 shadow-sm" title="Financials">
                                    <i className="fa-solid fa-dollar-sign text-[8px]"></i>
                                    FIN
                                  </span>
                                )}
                                {!u.module_access?.crm && !u.module_access?.marketing && !u.module_access?.financials && (
                                  <span className="text-xs text-slate-400 italic">Sin módulos</span>
                                )}
                              </div>
                            </td>
                            
                            {/* Conexiones */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5">
                                {u.google_connected && (
                                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" title="Google conectado">
                                    <i className="fa-brands fa-google text-sm" style={{ color: '#4285F4' }}></i>
                                  </div>
                                )}
                                {u.outlook_connected && (
                                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" title="Outlook conectado">
                                    <i className="fa-brands fa-microsoft text-sm" style={{ color: '#0078D4' }}></i>
                                  </div>
                                )}
                                {!u.google_connected && !u.outlook_connected && (
                                  <span className="text-xs text-slate-300 italic">—</span>
                                )}
                              </div>
                            </td>
                            
                            {/* Acciones */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEdit(u); }} 
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(u.id_user); }} 
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Vista de Admin - Tabla
    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4 border-b">Usuario</th>
                  <th className="px-6 py-4 border-b">Rol & Permisos</th>
                  <th className="px-6 py-4 border-b">Módulos</th>
                  <th className="px-6 py-4 border-b">Conexiones</th>
                  <th className="px-6 py-4 border-b">Empresa</th>
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
                      {/* Usuario Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" 
                              src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name_user)}&background=random&size=100`} 
                              alt="" 
                            />
                            {u.is_owner && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm border border-white" title="Propietario">
                                <i className="fa-solid fa-crown text-white text-[8px]"></i>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-sm truncate">{u.name_user}</div>
                            <div className="text-xs text-slate-500 truncate">{u.email_user}</div>
                            {u.job_title && <div className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider truncate">{u.job_title}</div>}
                          </div>
                        </div>
                      </td>
                      
                      {/* Rol & Permisos */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold capitalize shadow-sm ${
                              u.rol_user === 'superadmin' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                              u.rol_user === 'admin' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                              'bg-slate-100 text-slate-700'
                          }`}>
                              <i className={`fa-solid ${
                                u.rol_user === 'superadmin' ? 'fa-shield-halved' :
                                u.rol_user === 'admin' ? 'fa-user-shield' :
                                'fa-user'
                              } text-[10px]`}></i>
                              {u.rol_user}
                          </span>
                        </div>
                      </td>
                      
                      {/* Módulos */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {u.module_access?.crm && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200" title="CRM">
                              <i className="fa-solid fa-users text-[8px]"></i>
                              CRM
                            </span>
                          )}
                          {u.module_access?.marketing && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200" title="Marketing">
                              <i className="fa-solid fa-bullhorn text-[8px]"></i>
                              MKT
                            </span>
                          )}
                          {u.module_access?.financials && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200" title="Financials">
                              <i className="fa-solid fa-dollar-sign text-[8px]"></i>
                              FIN
                            </span>
                          )}
                          {!u.module_access?.crm && !u.module_access?.marketing && !u.module_access?.financials && (
                            <span className="text-xs text-slate-400 italic">Sin acceso</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Conexiones */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {u.google_connected && (
                            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" title="Google conectado">
                              <i className="fa-brands fa-google text-sm" style={{ color: '#4285F4' }}></i>
                            </div>
                          )}
                          {u.outlook_connected && (
                            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm" title="Outlook conectado">
                              <i className="fa-brands fa-microsoft text-sm" style={{ color: '#0078D4' }}></i>
                            </div>
                          )}
                          {!u.google_connected && !u.outlook_connected && (
                            <span className="text-xs text-slate-300 italic">Sin conexión</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Tenant */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 font-medium truncate max-w-[150px]" title={u.name_tenant || getTenantName(u.id_tenant)}>
                          {u.name_tenant || getTenantName(u.id_tenant)}
                        </div>
                      </td>
                      
                      {/* Estado */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${
                          u.status_user === 'Activo' 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status_user === 'Activo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {u.status_user}
                        </span>
                      </td>
                      
                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEdit(u); }} 
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            {user?.rol_user === 'superadmin' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(u.id_user); }} 
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
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
    <>
    <div className="w-full space-y-6 animate-fade-in pb-12 px-6">
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
         <span>Mostrando {filteredUsers.length} de {cachedUsers.length} usuarios</span>
      </div>
    </div>

    {/* Modal */}
    <UserModal
      isOpen={isModalOpen}
      isEditMode={isEditMode}
      editingUser={editingUser}
      submitting={submitting}
      tenants={cachedTenants}
      currentUserRole={currentUser?.rol_user || ''}
      currentUserTenant={currentUser?.id_tenant}
      currentUserIsOwner={currentUser?.is_owner}
      onClose={() => setIsModalOpen(false)}
      onSubmit={handleFormSubmit}
      onInputChange={handleInputChange}
    />

    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </>
  );
};

export default UsersList;

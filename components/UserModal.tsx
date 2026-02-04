import React from 'react';
import { User, Tenant } from '../types';

interface UserModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  editingUser: Partial<User> | null;
  submitting: boolean;
  tenants: Tenant[];
  currentUserRole: string;
  currentUserTenant?: string;
  currentUserIsOwner?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  isEditMode,
  editingUser,
  submitting,
  tenants,
  currentUserRole,
  currentUserTenant,
  currentUserIsOwner,
  onClose,
  onSubmit,
  onInputChange,
}) => {
  // Chequeo temprano de null
  if (!isOpen || !editingUser) return null;
  
  // Determinar si puede marcar como propietario
  // Superadmin: puede marcar cualquier admin como propietario
  // Admin + Owner: solo puede marcar admins del mismo tenant
  const isSameTenant = String(editingUser?.id_tenant) === String(currentUserTenant);
  const isAdminOwner = currentUserRole === 'admin' && currentUserIsOwner === true;
  const isSuperadmin = currentUserRole === 'superadmin';
  
  const canMarkOwner = isSuperadmin || (isAdminOwner && isSameTenant);
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que tenga acceso a al menos una herramienta
    const hasModuleAccess = editingUser?.module_access?.crm || 
                            editingUser?.module_access?.marketing || 
                            editingUser?.module_access?.financials;
    
    if (!hasModuleAccess) {
      alert('El usuario debe tener acceso a al menos una herramienta (CRM, Marketing o Financials)');
      return;
    }
    
    // Validar que si es propietario, debe ser administrador
    if (editingUser?.is_owner && editingUser?.rol_user !== 'admin') {
      alert('Solo los Administradores pueden ser marcados como Propietarios');
      return;
    }
    
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md">
              <i className="fa-solid fa-user"></i>
            </div>
            {isEditMode ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="overflow-y-auto px-8 py-6 space-y-6">
          {/* Grid de 2 columnas + Avatar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Columna 1 - Avatar e Info Básica */}
            <div className="space-y-5">
              {/* Avatar Section */}
              <div className="flex flex-col items-center py-4 px-4 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200">
                <div className="relative mb-3">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-lg flex items-center justify-center overflow-hidden">
                    {editingUser.avatar_url ? (
                      <img src={editingUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(editingUser.name_user || 'Usuario')}&background=random&size=128`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {editingUser.is_owner && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      <i className="fa-solid fa-crown text-white text-xs"></i>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-semibold">Perfil de Usuario</p>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="name_user" 
                  required 
                  value={editingUser.name_user || ''} 
                  onChange={onInputChange} 
                  disabled={isEditMode && currentUserRole === 'admin'}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium disabled:opacity-60 placeholder:text-slate-400" 
                  placeholder="Juan Pérez" 
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input 
                  type="email" 
                  name="email_user" 
                  required 
                  value={editingUser.email_user || ''} 
                  onChange={onInputChange} 
                  disabled={isEditMode && currentUserRole === 'admin'}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm disabled:opacity-60 placeholder:text-slate-400" 
                  placeholder="juan@empresa.com" 
                />
              </div>

              {/* Cargo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Cargo
                </label>
                <input 
                  type="text" 
                  name="job_title" 
                  value={editingUser.job_title || ''} 
                  onChange={onInputChange} 
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm placeholder:text-slate-400" 
                  placeholder="Ej: Gerente de Ventas" 
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Teléfono
                </label>
                <input 
                  type="tel" 
                  name="phone_user" 
                  value={editingUser.phone_user || ''} 
                  onChange={onInputChange} 
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm placeholder:text-slate-400" 
                  placeholder="+593 98 1234567" 
                />
              </div>
            </div>

            {/* Columna 2 - Configuración y Permisos */}
            <div className="space-y-5">
              {/* Rol */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Rol de Usuario <span className="text-red-500">*</span>
                </label>
                <select 
                  name="rol_user" 
                  required 
                  value={editingUser.rol_user || 'usuario'} 
                  onChange={onInputChange} 
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium"
                >
                  <option value="">-- Seleccionar rol --</option>
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                  {currentUserRole === 'superadmin' && <option value="superadmin">Superadmin</option>}
                </select>
              </div>

              {/* Propietario */}
              {canMarkOwner && (
                <div className={`p-3.5 rounded-xl border-2 ${
                  editingUser.rol_user === 'admin' 
                    ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200' 
                    : 'bg-slate-100 border-slate-300'
                }`}>
                  <label className={`flex items-center gap-3 ${editingUser.rol_user === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input 
                      type="checkbox" 
                      name="is_owner" 
                      checked={editingUser.is_owner || false}
                      onChange={onInputChange}
                      disabled={editingUser.rol_user !== 'admin'}
                      className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-crown text-amber-600"></i>
                        <span className={`font-bold text-sm ${editingUser.rol_user === 'admin' ? 'text-amber-900' : 'text-slate-600'}`}>
                          Marcar como Propietario
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${editingUser.rol_user === 'admin' ? 'text-amber-700' : 'text-slate-500'}`}>
                        {editingUser.rol_user === 'admin' 
                          ? 'Acceso completo a todas las funciones' 
                          : 'Solo Administradores pueden ser Propietarios'}
                      </p>
                    </div>
                  </label>
                </div>
              )}
              
              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Estado de Cuenta <span className="text-red-500">*</span>
                </label>
                <select 
                  name="status_user" 
                  required 
                  value={editingUser.status_user || 'Activo'} 
                  onChange={onInputChange} 
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              {/* Empresa (Tenant) */}
              {(currentUserRole === 'superadmin') && tenants.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Empresa <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="id_tenant" 
                    required 
                    value={editingUser.id_tenant || ''} 
                    onChange={onInputChange} 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium"
                  >
                    <option value="">-- Seleccionar empresa --</option>
                    {tenants.map(t => <option key={t.id_tenant} value={t.id_tenant}>{t.name_tenant}</option>)}
                  </select>
                </div>
              )}

              {/* Módulos */}
              <div className="space-y-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  📦 Módulos Disponibles {editingUser.is_owner && <span className="text-amber-600">(todos requeridos para propietarios)</span>}
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 transition-all ${
                    editingUser.is_owner 
                      ? 'bg-slate-100 cursor-not-allowed opacity-60' 
                      : 'bg-white hover:bg-blue-50 cursor-pointer hover:border-blue-300'
                  }`}>
                    <input 
                      type="checkbox" 
                      name="module_crm" 
                      checked={editingUser.module_access?.crm || false}
                      onChange={onInputChange}
                      disabled={editingUser.is_owner}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-users text-blue-600"></i>
                        <span className="font-semibold text-sm text-slate-700">CRM</span>
                      </div>
                      <p className="text-xs text-slate-500">Gestión de contactos y relaciones</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 transition-all ${
                    editingUser.is_owner 
                      ? 'bg-slate-100 cursor-not-allowed opacity-60' 
                      : 'bg-white hover:bg-indigo-50 cursor-pointer hover:border-indigo-300'
                  }`}>
                    <input 
                      type="checkbox" 
                      name="module_marketing" 
                      checked={editingUser.module_access?.marketing || false}
                      onChange={onInputChange}
                      disabled={editingUser.is_owner}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-bullhorn text-indigo-600"></i>
                        <span className="font-semibold text-sm text-slate-700">Marketing</span>
                      </div>
                      <p className="text-xs text-slate-500">Campañas y automatización</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 transition-all ${
                    editingUser.is_owner 
                      ? 'bg-slate-100 cursor-not-allowed opacity-60' 
                      : 'bg-white hover:bg-amber-50 cursor-pointer hover:border-amber-300'
                  }`}>
                    <input 
                      type="checkbox" 
                      name="module_financials" 
                      checked={editingUser.module_access?.financials || false}
                      onChange={onInputChange}
                      disabled={editingUser.is_owner}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-2 focus:ring-amber-500 cursor-pointer disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-dollar-sign text-amber-600"></i>
                        <span className="font-semibold text-sm text-slate-700">Financials</span>
                      </div>
                      <p className="text-xs text-slate-500">Reportes y análisis financiero</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Conexiones OAuth (si existen) */}
          {isEditMode && (editingUser.google_connected || editingUser.outlook_connected) && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                🔗 Conexiones Externas
              </label>
              <div className="flex flex-wrap gap-2">
                {editingUser.google_connected && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <i className="fa-brands fa-google text-lg" style={{ color: '#4285F4' }}></i>
                    <span className="text-slate-700 font-semibold text-sm">Google Conectado</span>
                  </div>
                )}
                {editingUser.outlook_connected && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <i className="fa-brands fa-microsoft text-lg" style={{ color: '#0078D4' }}></i>
                    <span className="text-slate-700 font-semibold text-sm">Outlook Conectado</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Footer con botones */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-brand-200 hover:shadow-xl hover:shadow-brand-300 hover:from-brand-700 hover:to-brand-800 disabled:opacity-50 disabled:shadow-none transition-all duration-200 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i>
                  {isEditMode ? 'Guardar Cambios' : 'Crear Usuario'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
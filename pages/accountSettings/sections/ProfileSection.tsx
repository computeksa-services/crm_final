import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';

const ProfileSection: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="w-full md:max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Mi Perfil</h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Información personal y configuración de tu cuenta</p>
      </div>

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <img
            src={user.avatar_url || ''}
            alt={user.name_user}
            className="w-16 sm:w-20 h-16 sm:h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
          />
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{user.name_user}</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-3">{user.job_title || 'Sin cargo definido'}</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-medium uppercase tracking-wide">
                <i className="fas fa-user-tag text-slate-500"></i>
                {user.rol_user}
              </span>
              {user.is_owner && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium uppercase tracking-wide">
                  <i className="fas fa-crown"></i>
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Información de Contacto</h3>
          
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-envelope text-slate-400 w-4"></i>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Email</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 pl-6">{user.email_user}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-building text-slate-400 w-4"></i>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Workspace</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 pl-6">{user.name_tenant || 'Sin asignar'}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-id-badge text-slate-400 w-4"></i>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">ID Usuario</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 font-mono text-sm pl-6">{user.id_user}</p>
            </div>
          </div>
        </div>

        {/* Access Permissions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Permisos y Accesos</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Rol de Usuario</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">{user.rol_user}</span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Propietario</span>
              {user.is_owner ? (
                <i className="fas fa-check-circle text-green-600 dark:text-green-500"></i>
              ) : (
                <i className="fas fa-times-circle text-slate-300 dark:text-slate-600"></i>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Acceso CRM</span>
              <i className="fas fa-check-circle text-green-600 dark:text-green-500"></i>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Acceso Marketing</span>
              <i className="fas fa-check-circle text-green-600 dark:text-green-500"></i>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">Acceso Finanzas</span>
              <i className="fas fa-check-circle text-green-600 dark:text-green-500"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Account Status */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 mt-6">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Estado de la Cuenta</h3>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <i className="fas fa-circle text-green-500 text-xs"></i>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Estado</span>
            </div>
            <p className="text-slate-900 dark:text-slate-100 pl-6">Cuenta Activa</p>
          </div>

          {user.provider && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className={`fab fa-${user.provider === 'google' ? 'google' : 'microsoft'} text-slate-400`}></i>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Proveedor OAuth</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 capitalize pl-6">{user.provider}</p>
            </div>
          )}

          {user.email_connected && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-link text-slate-400"></i>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Conectado</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 pl-6">{user.email_connected}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;

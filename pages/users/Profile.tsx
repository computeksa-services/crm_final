/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/AccountSettings.tsx
 * Ruta anterior: /app/profile
 * Nueva ruta: /app/account-settings
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { getImageUrl } from '../../utils/imageUtils';
import { BrandSpinner } from '../../components/AppLoaders';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [integrationsExpanded, setIntegrationsExpanded] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData(user);
      setLoading(false);
    }
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BrandSpinner size="xl" className="mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Simple */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-6 p-8">
          <div className="flex items-start gap-6">
            <img
              src={getImageUrl(profileData.avatar_url) || ''}
              alt={profileData.name_user}
              className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{profileData.name_user}</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-3">{profileData.job_title || 'Sin cargo definido'}</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-medium uppercase tracking-wide">
                  <i className="fas fa-user-tag text-slate-500"></i>
                  {profileData.rol_user}
                </span>
                {profileData.is_owner && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium uppercase tracking-wide">
                    <i className="fas fa-crown"></i>
                    Owner
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Grid Principal 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Columna Izquierda */}
          <div className="space-y-6">
            
            {/* Información de Contacto */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Información de Contacto</h2>
              
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-envelope text-slate-400 w-4"></i>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Email</span>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 pl-6">{profileData.email_user}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-building text-slate-400 w-4"></i>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Workspace</span>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 pl-6">{profileData.name_tenant || 'Sin asignar'}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-id-badge text-slate-400 w-4"></i>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">ID Usuario</span>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 font-mono text-sm pl-6">{profileData.id_user}</p>
                </div>
              </div>
            </div>

            {/* Accesos Rápidos */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Accesos Rápidos</h2>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/app/integrations')}
                  className="w-full flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <i className="fas fa-user-cog text-slate-600 dark:text-slate-400"></i>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mis Integraciones</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Google Calendar, Gmail</p>
                    </div>
                  </div>
                  <i className="fas fa-arrow-right text-slate-400"></i>
                </button>

                {(profileData.is_owner || ['admin', 'superadmin'].includes(profileData.rol_user?.toLowerCase() || '')) && (
                  <button
                    onClick={() => navigate('/app/workspace-settings')}
                    className="w-full flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <i className="fas fa-building-shield text-slate-600 dark:text-slate-400"></i>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Configuración Workspace</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Integraciones corporativas</p>
                      </div>
                    </div>
                    <i className="fas fa-arrow-right text-slate-400"></i>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-6">
            
            {/* Permisos y Accesos */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Permisos y Accesos</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Rol de Usuario</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">{profileData.rol_user}</span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Propietario</span>
                  {profileData.is_owner ? (
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

            {/* Estado de la Cuenta */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Estado de la Cuenta</h2>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-circle text-green-500 text-xs"></i>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Estado</span>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 pl-6">Cuenta Activa</p>
                </div>

                {profileData.provider && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`fab fa-${profileData.provider === 'google' ? 'google' : 'microsoft'} text-slate-400`}></i>
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Proveedor OAuth</span>
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 capitalize pl-6">{profileData.provider}</p>
                  </div>
                )}

                {profileData.email_connected && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-link text-slate-400"></i>
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Conectado</span>
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 pl-6">{profileData.email_connected}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Estado de Integraciones - Discreto */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIntegrationsExpanded(!integrationsExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <i className="fas fa-plug text-slate-400 text-sm"></i>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Estado de Integraciones</span>
                </div>
                <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform ${integrationsExpanded ? 'rotate-180' : ''}`}></i>
              </button>

              {integrationsExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 animate-fadeIn">
                  <div className="space-y-4">
                    {/* Integraciones Personales */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personal</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-calendar text-slate-400 text-xs w-4"></i>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Google Calendar</span>
                          </div>
                          {profileData.sync_calendar ? (
                            <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
                              <i className="fas fa-circle text-[6px]"></i>
                              Conectado
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No conectado</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-envelope text-slate-400 text-xs w-4"></i>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Gmail</span>
                          </div>
                          {profileData.sync_emails ? (
                            <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
                              <i className="fas fa-circle text-[6px]"></i>
                              Conectado
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No conectado</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-paper-plane text-slate-400 text-xs w-4"></i>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Enviar Emails</span>
                          </div>
                          {profileData.send_emails ? (
                            <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
                              <i className="fas fa-circle text-[6px]"></i>
                              Activo
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

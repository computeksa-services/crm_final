/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/AccountSettings.tsx
 * Ruta anterior: /app/account-settings (versión antigua)
 * Nueva ruta: /app/account-settings (versión nueva con sidebar modular)
 * 
 * NOTE: Este archivo se mantuvo solo para referencia histórica.
 * La nueva versión está completamente modularizada sob la carpeta pages/accountSettings/
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { getImageUrl } from '../../utils/imageUtils';
import { BrandSpinner } from '../../components/AppLoaders';

type SettingsSection = 'profile' | 'integrations' | 'workspace-integrations';

const AccountSettings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  
  // Leer la sección de la URL o usar 'profile' por defecto
  const currentSection = (searchParams.get('section') as SettingsSection) || 'profile';

  useEffect(() => {
    if (user) {
      setProfileData(user);
      setLoading(false);
    }
  }, [user]);

  const handleSectionChange = (section: SettingsSection) => {
    setSearchParams({ section });
  };

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BrandSpinner size="xl" className="mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const isAdmin = profileData.is_owner || ['admin', 'superadmin'].includes(profileData.rol_user?.toLowerCase() || '');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuración</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestiona tu cuenta</p>
          </div>

          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {/* Perfil */}
              <button
                onClick={() => handleSectionChange('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  currentSection === 'profile'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-user w-4"></i>
                <span>Perfil</span>
              </button>

              {/* Integraciones Personales */}
              <button
                onClick={() => handleSectionChange('integrations')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  currentSection === 'integrations'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <i className="fas fa-plug w-4"></i>
                <span>Mis Integraciones</span>
              </button>

              {/* Integraciones Workspace (solo admin/owner) */}
              {isAdmin && (
                <>
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Workspace
                    </p>
                  </div>
                  <button
                    onClick={() => handleSectionChange('workspace-integrations')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                      currentSection === 'workspace-integrations'
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <i className="fas fa-building w-4"></i>
                    <span>Integraciones Corporativas</span>
                  </button>
                </>
              )}
            </div>
          </nav>

          {/* Back Button */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => navigate('/app/dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
              <span>Volver al inicio</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {currentSection === 'profile' && <ProfileSection profileData={profileData} />}
          {currentSection === 'integrations' && <IntegrationsSection profileData={profileData} />}
          {currentSection === 'workspace-integrations' && isAdmin && <WorkspaceIntegrationsSection />}
        </div>
      </div>
    </div>
  );
};

// Sección de Perfil
const ProfileSection: React.FC<{ profileData: User }> = ({ profileData }) => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Perfil</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Información de tu cuenta y preferencias
        </p>
      </div>

      <div className="space-y-6">
        {/* Header con Avatar */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start gap-6">
            <img
              src={getImageUrl(profileData.avatar_url) || ''}
              alt={profileData.name_user}
              className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {profileData.name_user}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-3">
                {profileData.job_title || 'Sin cargo definido'}
              </p>
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

        {/* Información de Contacto */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
            Información de Contacto
          </h3>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">
                Email
              </label>
              <p className="text-slate-900 dark:text-slate-100">{profileData.email_user}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">
                Workspace
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {profileData.name_tenant || 'Sin asignar'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">
                ID Usuario
              </label>
              <p className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                {profileData.id_user}
              </p>
            </div>
          </div>
        </div>

        {/* Permisos */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
            Permisos y Accesos
          </h3>
          <div className="space-y-3">
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
      </div>
    </div>
  );
};

// Sección de Integraciones Personales
const IntegrationsSection: React.FC<{ profileData: User }> = ({ profileData }) => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Mis Integraciones
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Gestiona tus conexiones personales con servicios externos
        </p>
      </div>

      <div className="space-y-6">
        {/* Google Calendar */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <i className="fab fa-google text-xl text-slate-600 dark:text-slate-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Google Calendar
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Sincroniza tus eventos y reuniones
                </p>
                {profileData.sync_calendar ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                    <i className="fas fa-circle text-[6px]"></i>
                    Conectado
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No conectado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gmail */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <i className="fas fa-envelope text-xl text-slate-600 dark:text-slate-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Gmail
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Lee y envía correos desde la plataforma
                </p>
                {profileData.sync_emails ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                    <i className="fas fa-circle text-[6px]"></i>
                    Conectado
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No conectado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Estado de Conexión */}
        {profileData.email_connected && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-3">
              <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Email conectado
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {profileData.email_connected}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Sección de Integraciones Workspace
const WorkspaceIntegrationsSection: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Integraciones Corporativas
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Configuración de integraciones para todo el workspace
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Contenido de integraciones corporativas próximamente...
        </p>
      </div>
    </div>
  );
};

export default AccountSettings;

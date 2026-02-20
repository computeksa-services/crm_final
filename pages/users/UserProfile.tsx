import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import Toast from '../../components/Toast';
import { getImageUrl } from '../../utils/imageUtils';
import { PersonalIntegrations } from '../../src/components/users/PersonalIntegrations';

// Helper para traducir scopes a descripciones amigables
const scopeDescriptions: Record<string, { name: string; description: string; icon: string }> = {
  'openid': {
    name: 'OpenID',
    description: 'Permiso básico para autenticación.',
    icon: 'fa-id-card'
  },
  'profile': {
    name: 'Perfil Básico',
    description: 'Acceso a tu nombre, foto de perfil e información pública.',
    icon: 'fa-user-circle'
  },
  'email': {
    name: 'Correo Electrónico',
    description: 'Acceso a tu dirección de correo electrónico principal.',
    icon: 'fa-envelope'
  },
  'https://www.googleapis.com/auth/calendar': {
    name: 'Google Calendar',
    description: 'Ver, crear y editar eventos en tu calendario.',
    icon: 'fa-google'
  },
  'https://www.googleapis.com/auth/gmail.modify': {
    name: 'Gestión de Gmail',
    description: 'Leer, modificar y organizar tus correos.',
    icon: 'fa-google'
  },
  'https://www.googleapis.com/auth/gmail.send': {
    name: 'Envío desde Gmail',
    description: 'Enviar correos electrónicos en tu nombre.',
    icon: 'fa-google'
  },
  'User.Read': {
    name: 'Lectura de Usuario',
    description: 'Leer tu perfil básico de Microsoft.',
    icon: 'fa-microsoft'
  },
  'Mail.ReadWrite': {
    name: 'Lectura y Escritura de Correo',
    description: 'Leer, escribir y organizar tus correos de Outlook.',
    icon: 'fa-microsoft'
  },
  'Mail.Send': {
    name: 'Envío de Correo',
    description: 'Enviar correos en tu nombre desde Outlook.',
    icon: 'fa-microsoft'
  },
  'Calendars.ReadWrite': {
    name: 'Lectura y Escritura de Calendario',
    description: 'Ver, crear y editar eventos en tu calendario de Outlook.',
    icon: 'fa-microsoft'
  },
  'offline_access': {
    name: 'Acceso sin Conexión',
    description: 'Mantener tu sesión activa para sincronización en segundo plano.',
    icon: 'fa-sync-alt'
  }
};

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setProfileData(user);
      setLoading(false);
    }
  }, [user]);

  // Escuchar evento global para mostrar toasts desde componentes hijos
  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      setToast(event.detail);
    };
    window.addEventListener('showToast' as any, handleShowToast);
    return () => window.removeEventListener('showToast' as any, handleShowToast);
  }, []);

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className="text-slate-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const { provider, email_connected } = profileData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      


      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <i className="fa-brands fa-google text-2xl text-red-500"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Integraciones de Google</h1>
            <p className="text-slate-600">Conecta tu cuenta personal de Google para sincronizar Calendar y Gmail</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <div className="px-6 pb-6 -mt-12">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <img
                  src={getImageUrl(profileData.avatar_url)}
                  alt={profileData.name_user}
                  className="w-full h-full rounded-full border-4 border-white shadow-lg object-cover"
                />
                {profileData.is_owner && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow">
                    Owner
                  </span>
                )}
              </div>

              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium mb-2">
                  {profileData.rol_user}
                </span>
                <p className="text-xs text-slate-500 mb-1">{profileData.name_tenant || 'Tenant'}</p>
                <h2 className="text-xl font-bold text-slate-800">{profileData.name_user}</h2>
                <p className="text-sm text-slate-600">{profileData.job_title || '—'}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <i className="fas fa-envelope text-slate-400 w-5"></i>
                  <span className="text-slate-700">{profileData.email_user}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Integrations */}
          <PersonalIntegrations 
            key={`${profileData.send_emails}-${profileData.sync_emails}-${profileData.sync_calendar}-${profileData.granted_scopes?.length || 0}`}
            user={profileData} 
          />

          {/* Roles & Permissions Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <i className="fas fa-shield-alt text-blue-500 text-xl"></i>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Rol y Acceso a Módulos</h3>
                <p className="text-sm text-slate-600">Tu nivel de acceso dentro de la plataforma.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Rol: {profileData.rol_user}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">
                  {profileData.is_owner ? 'Eres Propietario (Owner)' : 'No eres Propietario'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">Acceso a CRM</span>
                <i className="fas fa-check text-green-500"></i>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">Acceso a Marketing</span>
                <i className="fas fa-check text-green-500"></i>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">Acceso a Finanzas</span>
                <i className="fas fa-check text-green-500"></i>
              </div>
            </div>
          </div>

          {/* Scopes Card */}
          {profileData.granted_scopes && profileData.granted_scopes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <i className="fas fa-key text-blue-500 text-xl"></i>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Permisos de API Concedidos</h3>
                  <p className="text-sm text-slate-600">
                    Permisos que has otorgado a la aplicación en tu cuenta de {profileData.provider}.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {profileData.granted_scopes.map((scope, index) => {
                  const details = scopeDescriptions[scope] || {
                    name: scope,
                    description: 'Permiso personalizado o no documentado.',
                    icon: 'fa-question-circle'
                  };

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <i className={`fas ${details.icon} text-slate-400 mt-1`}></i>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{details.name}</p>
                        <p className="text-xs text-slate-600">{details.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
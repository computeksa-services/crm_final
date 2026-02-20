/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/sections/PersonalIntegrations.tsx
 * Ruta anterior: /app/integrations
 * Nueva ruta: /app/account-settings?tab=personalIntegrations
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import Toast from '../../components/Toast';
import { PersonalIntegrations } from '../../src/components/users/PersonalIntegrations';

const Integrations: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Escuchar evento global para mostrar toasts desde componentes hijos
  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      setToast(event.detail);
    };
    window.addEventListener('showToast' as any, handleShowToast);
    return () => window.removeEventListener('showToast' as any, handleShowToast);
  }, []);

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
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className="text-slate-600 dark:text-slate-400">Cargando integraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="px-2 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <i className="fa-brands fa-google text-2xl text-red-500"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Integraciones de Google</h1>
            <p className="text-slate-600 dark:text-slate-400">Conecta tu cuenta personal de Google para sincronizar Calendar y Gmail</p>
          </div>
        </div>
      </div>

      <div className="px-2">
        {/* Personal Integrations */}
        <PersonalIntegrations 
          key={`${profileData.send_emails}-${profileData.sync_emails}-${profileData.sync_calendar}-${profileData.granted_scopes?.length || 0}`}
          user={profileData} 
        />

        {/* Info Footer */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-1">
                Integraciones Personales
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Estas integraciones conectan tu cuenta personal de Google con el CRM. 
                Para configurar el email corporativo de tu empresa, ve a{' '}
                <span className="font-semibold">Workspace → Configuración</span> (solo admin/owner).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;

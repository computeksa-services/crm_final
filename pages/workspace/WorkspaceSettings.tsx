/**
 * @deprecated Esta página ha sido reemplazada por AccountSettings
 * @see pages/accountSettings/sections/TenantIntegrations.tsx
 * Ruta anterior: /app/workspace-settings
 * Nueva ruta: /app/account-settings?tab=tenantIntegrations
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TenantEmailSettings } from '../../src/components/users/TenantEmailSettings';
import { Navigate } from 'react-router-dom';
import Toast from '../../components/Toast';

const WorkspaceSettings: React.FC = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Escuchar evento global para mostrar toasts desde componentes hijos
  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      setToast(event.detail);
    };
    window.addEventListener('showToast' as any, handleShowToast);
    return () => window.removeEventListener('showToast' as any, handleShowToast);
  }, []);

  // Solo admin y owner pueden acceder
  if (user?.rol_user !== 'admin' && user?.rol_user !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <i className="fa-solid fa-building text-2xl text-brand-600 dark:text-brand-400"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
              Configuración del Workspace
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Gestiona las integraciones y configuraciones de tu organización
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="border-b border-slate-200 dark:border-slate-700 px-2">
        <nav className="flex gap-6">
          <button className="pb-3 px-1 border-b-2 border-brand-600 text-brand-600 dark:text-brand-400 font-medium text-sm">
            <i className="fa-solid fa-envelope mr-2"></i>
            Email Corporativo
          </button>
          <button className="pb-3 px-1 border-b-2 border-transparent text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-sm transition-colors">
            <i className="fa-solid fa-users mr-2"></i>
            Equipo
            <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded">Próximamente</span>
          </button>
          <button className="pb-3 px-1 border-b-2 border-transparent text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-sm transition-colors">
            <i className="fa-solid fa-shield-halved mr-2"></i>
            Seguridad
            <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded">Próximamente</span>
          </button>
        </nav>
      </div>

      {/* Contenido */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <TenantEmailSettings user={user!} />
      </div>

      {/* Info footer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <i className="fa-solid fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">¿Qué es la configuración del Workspace?</p>
            <p className="text-blue-700 dark:text-blue-300">
              Estas configuraciones afectan a toda tu organización. El email corporativo se usa para enviar 
              cotizaciones, alertas y notificaciones automáticas en nombre de tu empresa. Solo los administradores 
              y propietarios pueden modificar estas configuraciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettings;

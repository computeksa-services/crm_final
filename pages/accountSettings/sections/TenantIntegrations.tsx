import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { TenantEmailSettings } from '../../../src/components/users/TenantEmailSettings';
import { Navigate } from 'react-router-dom';
import Toast from '../../../components/Toast';
import { BrandSpinner } from '../../../components/AppLoaders';

const TenantIntegrations: React.FC = () => {
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

  // Solo owner puede acceder
  if (!user?.is_owner) {
    return <Navigate to="/app/account-settings?tab=profile" replace />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BrandSpinner size="xl" className="mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6 lg:p-8 mb-6">
        <TenantEmailSettings user={user} />
      </div>

      {/* Info footer */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
          <i className="fa-solid fa-info-circle text-slate-400 mt-0.5 w-5 flex-shrink-0"></i>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">¿Qué es la configuración del Workspace?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Estas configuraciones afectan a toda la organización. El correo corporativo se utiliza para enviar 
              cotizaciones, alertas y notificaciones automáticas. Solo los administradores pueden modificar estas configuraciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantIntegrations;

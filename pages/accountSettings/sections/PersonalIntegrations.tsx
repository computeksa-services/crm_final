import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Toast from '../../../components/Toast';
import { PersonalIntegrations as PersonalIntegrationsComponent } from '../../../src/components/users/PersonalIntegrations';

const PersonalIntegrations: React.FC = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Escuchar evento global para mostrar toasts desde componentes hijos
  React.useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      setToast(event.detail);
    };
    window.addEventListener('showToast' as any, handleShowToast);
    return () => window.removeEventListener('showToast' as any, handleShowToast);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6 lg:p-8 mb-6">
        <PersonalIntegrationsComponent 
          key={`${user.send_emails}-${user.sync_emails}-${user.sync_calendar}-${user.granted_scopes?.length || 0}`}
          user={user} 
        />
      </div>

      {/* Info Footer */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
          <i className="fas fa-info-circle text-slate-400 mt-0.5 w-5 flex-shrink-0"></i>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
              ¿Por qué conectar integraciones personales?
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Estas integraciones conectan su cuenta personal con el sistema, permitiendo sincronizar calendario y correo electrónico. 
              Para configurar el correo corporativo, acceda a <span className="font-semibold text-slate-900 dark:text-slate-100">Workspace → Integraciones</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalIntegrations;

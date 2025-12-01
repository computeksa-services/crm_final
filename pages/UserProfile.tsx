
import React, { useEffect, useState } from 'react';
import { MockApi } from '../services/mockApi';
import { User } from '../types';

const UserProfile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'google' | 'outlook' | null>(null);

  useEffect(() => {
    MockApi.getUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleSyncToggle = async (provider: 'google' | 'outlook') => {
    if (!user) return;
    setSyncing(provider);
    
    // Determine new status (toggle)
    const currentStatus = provider === 'google' ? user.googleConnected : user.outlookConnected;
    const newStatus = !currentStatus;

    // Simulate API call
    const updatedUser = await MockApi.updateUserSync(provider, newStatus);
    setUser(updatedUser);
    setSyncing(null);
  };

  if (loading || !user) return <div className="p-8 text-center text-slate-500">Cargando perfil...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Mi Perfil</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
             <div className="w-24 h-24 mx-auto bg-slate-200 rounded-full mb-4 overflow-hidden">
               <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
             </div>
             <h2 className="text-lg font-bold text-slate-800">{user.name_user}</h2>
             <p className="text-sm text-brand-600 font-medium mb-1">{user.job_title}</p> {/* Updated from jobTitle */}
             <p className="text-xs text-slate-400 mb-6">{user.email_user}</p>

             <button className="w-full border border-slate-300 text-slate-600 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
               Editar Información
             </button>
          </div>
        </div>

        {/* Settings & Integrations */}
        <div className="md:col-span-2 space-y-6">
          
          {/* General Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Información de la Cuenta</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
               <div>
                 <p className="text-slate-500 mb-1">Empresa ID</p>
                 <p className="font-medium text-slate-800 uppercase">{user.id_tenant}</p>
               </div>
               <div>
                 <p className="text-slate-500 mb-1">Rol</p>
                 <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{user.rol_user}</span>
               </div>
               <div>
                  <p className="text-slate-500 mb-1">Teléfono</p>
                  <p className="text-slate-800">{user.phone_user}</p>
               </div>
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Sincronización de Correo y Calendario</h3>
            <p className="text-sm text-slate-500 mb-6">Conecta tus cuentas para sincronizar eventos del calendario y correos electrónicos automáticamente con el CRM.</p>
            
            <div className="space-y-4">
              
              {/* Google Integration */}
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center mr-3 shadow-sm">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Google Workspace</p>
                    <p className="text-xs text-slate-500">Calendar & Gmail</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSyncToggle('google')}
                  disabled={syncing === 'google'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    user.googleConnected 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {syncing === 'google' ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : user.googleConnected ? (
                    'Desconectar'
                  ) : (
                    'Conectar Google'
                  )}
                </button>
              </div>

              {/* Outlook Integration */}
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-[#0078D4] rounded-full flex items-center justify-center mr-3 shadow-sm text-white">
                    <i className="fa-brands fa-microsoft text-lg"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Microsoft Outlook</p>
                    <p className="text-xs text-slate-500">Calendar & Exchange</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSyncToggle('outlook')}
                  disabled={syncing === 'outlook'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    user.outlookConnected 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {syncing === 'outlook' ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : user.outlookConnected ? (
                    'Desconectar'
                  ) : (
                    'Conectar Outlook'
                  )}
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserProfile;

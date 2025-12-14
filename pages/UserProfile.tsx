
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

const UserProfile: React.FC = () => {
  const { user, login } = useAuth(); // Obtener el usuario del contexto de autenticación
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'google' | 'outlook' | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null); // Usar un estado local para los datos del perfil

  const fetchUser = async () => {
    if (user?.id_user) {
      // En un entorno real, aquí harías una llamada a tu API para obtener los detalles del usuario
      // Por ahora, usamos los datos del usuario del contexto directamente para el perfil
      setCurrentUserData(user);
      setLoading(false);
    } else {
      // Manejar caso donde no hay usuario (ej. redirigir a login, mostrar error)
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [user]); // Dependencia del user del contexto

  const handleSyncToggle = async (provider: 'google' | 'outlook') => {
    if (!currentUserData) return;
    setSyncing(provider);
    
    const currentStatus = provider === 'google' ? currentUserData.googleConnected : currentUserData.outlookConnected;
    const newStatus = !currentStatus;

    try {
      // Simular llamada a API de actualización
      // En una app real, aquí se haría una llamada al backend para actualizar el estado de sincronización
      const response = await fetch('https://service.computeksa.com/webhook/api/users/update-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_user: currentUserData.id_user,
          provider,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar sincronización.');
      }

      // Actualizar el estado local y el contexto de autenticación
      const updatedUserFromApi = { 
        ...currentUserData, 
        [provider === 'google' ? 'googleConnected' : 'outlookConnected']: newStatus 
      };
      setCurrentUserData(updatedUserFromApi);
      // Opcional: Si el `login` de AuthContext también actualiza el usuario, podrías llamarlo aquí.
      // Por ejemplo: login(updatedUserFromApi);

    } catch (error) {
      console.error("Error updating sync status:", error);
      // Manejar el error, por ejemplo, mostrando un toast
    } finally {
      setSyncing(null);
    }
  };

  if (loading || !currentUserData) return <div className="p-8 text-center text-slate-500">Cargando perfil...</div>;

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

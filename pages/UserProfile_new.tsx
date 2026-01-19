import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { microsoftClientId, oauthRedirectUri } from '../services/oauthConfig';
import { User, Tenant } from '../types';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { getImageUrl } from '../utils/imageUtils';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';

const UserProfile: React.FC = () => {
  const { user } = useAuth(); // Obtener usuario del contexto
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'google' | 'outlook' | null>(null);
  
  // Estado local para datos del perfil (en caso de que queramos editar sin tocar el contexto global inmediatamente)
  const [profileData, setProfileData] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- Tenant email policy (admin only) ---
  const [tenantLoading, setTenantLoading] = useState(false);
  const [corporativeSetup, setCorporativeSetup] = useState(false);
  const [corporativeLoading, setCorporativeLoading] = useState(false);
  const [corporativeDeleting, setCorporativeDeleting] = useState(false);
  const [adminProvider, setAdminProvider] = useState<'google' | 'outlook' | null>(null);
  const [corporativeEmail, setCorporativeEmail] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData(user);
      setLoading(false);
      // Identificar provider del admin
      setAdminProvider(user.googleConnected ? 'google' : user.outlookConnected ? 'outlook' : null);
    }
  }, [user]);

  const loadTenant = useCallback(async () => {
    if (!user?.id_tenant) return;
    setTenantLoading(true);
    try {
      const res = await apiFetch(buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant }));
      if (res.ok) {
        const data = await res.json();
        const t: any = Array.isArray(data) ? data[0] : data;
        setCorporativeEmail(t?.corporate_email_address || '');
        setCorporativeSetup(t?.email_policy === 'CORPORATE' && Boolean(t?.corporate_email_address));
      }
    } catch (e) {
      console.error('Error loading tenant detail', e);
    } finally {
      setTenantLoading(false);
    }
  }, [user?.id_tenant]);

  // Cargar detalle del tenant para admins
  useEffect(() => {
    if (user?.rol_user === 'admin') loadTenant();
  }, [user?.rol_user, loadTenant]);

  const activeProvider: 'google' | 'outlook' | null = profileData?.googleConnected
    ? 'google'
    : profileData?.outlookConnected
    ? 'outlook'
    : null;

  // Simulación de conexión (Aquí iría la lógica real de OAuth)
  const handleSyncToggle = async (provider: 'google' | 'outlook') => {
    if (!profileData) return;
    setSyncing(provider);
    
    // Determinamos el estado actual basado en el proveedor
    const isConnected = provider === 'google' ? profileData.googleConnected : profileData.outlookConnected;
    const action = isConnected ? 'desconectado' : 'conectado';

    try {
      // AQUÍ IRÍA LA LLAMADA AL BACKEND REAL
      // await api.updateSyncStatus(...)
      
      // Simulamos un delay de red
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Actualizamos estado local (Optimistic UI)
      setProfileData(prev => prev ? ({
        ...prev,
        [provider === 'google' ? 'googleConnected' : 'outlookConnected']: !isConnected
      }) : null);

      setToast({ message: `Cuenta de ${provider === 'google' ? 'Google' : 'Outlook'} ${action} correctamente.`, type: 'success' });

    } catch (error) {
      console.error("Error updating sync status:", error);
      setToast({ message: 'Error al actualizar sincronización.', type: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  // Google OAuth para email corporativo
  const googleLoginCorporative = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setCorporativeLoading(true);
      saveCorporativeEmail(codeResponse.code, 'google');
    },
    onError: () => {
      setToast({ message: 'Error al conectar con Google.', type: 'error' });
    },
    flow: 'auth-code',
    scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send"
  });

  // Microsoft OAuth para email corporativo
  const handleMicrosoftCorporative = () => {
    if (!microsoftClientId) {
      setToast({ message: 'Microsoft no está configurado.', type: 'error' });
      return;
    }
    setCorporativeLoading(true);
    const scopes = "openid profile email offline_access User.Read Mail.Send";
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${microsoftClientId}&redirect_uri=${encodeURIComponent(oauthRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    
    const popup = window.open(authUrl, 'microsoftAuth', 'width=500,height=600');
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        setCorporativeLoading(false);
      }
    }, 500);

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'MICROSOFT_AUTH_CODE') {
        clearInterval(checkPopup);
        popup?.close();
        saveCorporativeEmail(event.data.code, 'microsoft');
      }
    }, { once: true });
  };

  const saveCorporativeEmail = async (code: string, provider: 'google' | 'microsoft') => {
    if (!user?.id_tenant || !user?.id_user) return;
    try {
      // ✅ CORRECCIÓN: Enviar JSON en lugar de FormData
      const jsonPayload = {
        id_tenant: user.id_tenant,
        id_user: user.id_user,
        code,
        provider
      };
      const res = await apiFetch(GATEWAY_CONFIG.API.TENANTS.EMAIL_SETTINGS, { 
        method: 'POST', 
        body: JSON.stringify(jsonPayload)  // ✅ JSON, no FormData
      });
      if (!res.ok) throw new Error('No se pudo guardar configuración');
      const data = await res.json();
      setCorporativeEmail(data?.corporate_email_address || '');
      setCorporativeSetup(true);
      setToast({ message: 'Email corporativo configurado correctamente.', type: 'success' });
      // Refrescar datos del tenant para asegurar consistencia
      loadTenant();
    } catch (e) {
      console.error(e);
      setToast({ message: 'Error al guardar la configuración.', type: 'error' });
    } finally {
      setCorporativeLoading(false);
    }
  };

  const deleteCorporativeEmail = async () => {
    if (!user?.id_tenant || !user?.id_user) return;
    setCorporativeDeleting(true);
    try {
      // ✅ CORRECCIÓN: Enviar JSON en lugar de FormData
      const jsonPayload = {
        id_tenant: user.id_tenant,
        id_user: user.id_user
      };
      const res = await apiFetch(GATEWAY_CONFIG.API.TENANTS.EMAIL_DELETE, { 
        method: 'POST', 
        body: JSON.stringify(jsonPayload)  // ✅ JSON, no FormData
      });
      if (!res.ok) throw new Error('No se pudo eliminar configuración');
      setCorporativeEmail('');
      setCorporativeSetup(false);
      setToast({ message: 'Email corporativo eliminado correctamente.', type: 'success' });
      loadTenant();
    } catch (e) {
      console.error(e);
      setToast({ message: 'Error al eliminar la configuración.', type: 'error' });
    } finally {
      setCorporativeDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading || !profileData) {
    return (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-500"></i>
                <p className="text-slate-500 font-medium animate-pulse">Cargando perfil...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteCorporativeEmail}
        title="Eliminar Email Corporativo"
        message="¿Estás seguro de que deseas eliminar la configuración del email corporativo? Los correos seguirán siendo enviados por usuarios individuales."
        isDestructive={true}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Mi Perfil</h1>
        <p className="text-slate-500 text-sm mt-1">Gestiona tu información personal y preferencias de cuenta.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Identity Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
             <div className="h-24 bg-gradient-to-r from-slate-800 to-slate-900"></div>
             <div className="px-6 pb-6 text-center -mt-12">
                <div className="relative inline-block">
                    <img 
                        src={getImageUrl(profileData.avatar_url) || `https://ui-avatars.com/api/?name=${profileData.name_user}&background=random`} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          console.error('❌ Error cargando avatar en perfil:', profileData.avatar_url);
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${profileData.name_user}&background=random`;
                        }}
                    />
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Activo"></div>
                </div>
                
                <h2 className="text-lg font-bold text-slate-800 mt-3">{profileData.name_user}</h2>
                <p className="text-sm text-brand-600 font-medium">{profileData.job_title || 'Sin Cargo Definido'}</p>
                
                <div className="mt-4 flex justify-center gap-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium border border-slate-200 flex items-center">
                        <i className="fa-regular fa-envelope mr-1.5"></i> {profileData.email_user}
                    </span>
                </div>

                {/* Se oculta acción de edición hasta que exista flujo permitido */}
             </div>
          </div>

          {/* Quick Stats (Opcional - Decorativo) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detalles de Cuenta</h3>
              <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                      <span className="text-slate-500">Rol</span>
                      <span className="font-medium text-slate-800 capitalize">{profileData.rol_user}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Estado</span>
                      <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-xs">Activo</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Miembro desde</span>
                      <span className="font-medium text-slate-800">Dic 2024</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-slate-100">
                      <span className="text-slate-500 block mb-1 text-xs">ID de Organización (Tenant)</span>
                      <span className="font-mono text-xs text-slate-400 bg-slate-50 p-1.5 rounded block break-all">{profileData.id_tenant}</span>
                  </div>
              </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tenant Email Policy for Admin */}
          {profileData?.rol_user === 'admin' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                  <i className="fa-solid fa-building"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Correo Corporativo del Tenant</h3>
                  <p className="text-sm text-slate-500">Configura un correo corporativo para notificaciones.</p>
                </div>
              </div>

              {!corporativeSetup && (
                <div className="mt-4 grid gap-4">
                  <p className="text-sm text-slate-600 mb-3">Inicia sesión con tu proveedor ({adminProvider === 'google' ? 'Google' : 'Microsoft'}) para configurar el correo corporativo.</p>
                  {adminProvider === 'google' && (
                    <button
                      onClick={() => googleLoginCorporative()}
                      disabled={corporativeLoading || tenantLoading}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {corporativeLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-brands fa-google"></i>}
                      {corporativeLoading ? 'Conectando…' : 'Configurar con Google Workspace'}
                    </button>
                  )}
                  {adminProvider === 'outlook' && (
                    <button
                      onClick={handleMicrosoftCorporative}
                      disabled={corporativeLoading || tenantLoading}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {corporativeLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-brands fa-microsoft"></i>}
                      {corporativeLoading ? 'Conectando…' : 'Configurar con Microsoft'}
                    </button>
                  )}
                </div>
              )}

              {corporativeSetup && corporativeEmail && (
                <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-check-circle text-emerald-600 text-lg"></i>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">Email corporativo configurado</p>
                        <p className="text-xs text-emerald-600">{corporativeEmail}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      disabled={corporativeDeleting}
                      className="px-3 py-1 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                      title="Eliminar configuración de email corporativo"
                    >
                      {corporativeDeleting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-trash"></i>}
                    </button>
                  </div>
                </div>
              )}

              {tenantLoading && (
                <div className="mt-3 text-xs text-slate-500">Cargando configuración del tenant…</div>
              )}
            </div>
          )}
          
          {/* Integrations Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <i className="fa-solid fa-plug text-lg"></i>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Integraciones</h3>
                    <p className="text-sm text-slate-500">Conecta tu calendario y correo para sincronización automática.</p>
                </div>
            </div>
            
            <div className="space-y-4">
              {(activeProvider === 'google' || activeProvider === null) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-slate-50/50">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500 flex items-center justify-center text-white text-xl">
                        <i className="fa-brands fa-google"></i>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Google Workspace</p>
                      <p className="text-xs text-slate-500 mt-0.5">Sincroniza Calendar y Gmail</p>
                    </div>
                  </div>
                  {profileData.googleConnected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center">
                        <i className="fa-solid fa-check-circle mr-1.5"></i> Conectado
                      </span>
                      <button
                        onClick={() => handleSyncToggle('google')}
                        disabled={syncing === 'google'}
                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors text-sm"
                        title="Desconectar"
                      >
                        {syncing === 'google' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-power-off"></i>}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSyncToggle('google')}
                      disabled={syncing === 'google'}
                      className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center"
                    >
                      {syncing === 'google' ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-brands fa-google mr-2"></i>}
                      Conectar Cuenta
                    </button>
                  )}
                </div>
              )}

              {(activeProvider === 'outlook' || (activeProvider === null && !profileData.googleConnected)) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-slate-50/50">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center text-white text-xl">
                        <i className="fa-brands fa-microsoft"></i>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Microsoft Outlook</p>
                      <p className="text-xs text-slate-500 mt-0.5">Sincroniza Calendario y Contactos</p>
                    </div>
                  </div>
                  {profileData.outlookConnected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center">
                        <i className="fa-solid fa-check-circle mr-1.5"></i> Conectado
                      </span>
                      <button
                        onClick={() => handleSyncToggle('outlook')}
                        disabled={syncing === 'outlook'}
                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors text-sm"
                        title="Desconectar"
                      >
                        {syncing === 'outlook' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-power-off"></i>}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSyncToggle('outlook')}
                      disabled={syncing === 'outlook'}
                      className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center"
                    >
                      {syncing === 'outlook' ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-brands fa-microsoft mr-2"></i>}
                      Conectar Cuenta
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Security (Placeholder) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 opacity-75">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-600">
                    <i className="fa-solid fa-shield-halved text-lg"></i>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Seguridad</h3>
                    <p className="text-sm text-slate-500">Tu acceso está protegido por Google OAuth.</p>
                </div>
            </div>
            <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
                <p className="text-sm text-slate-500">Tu autenticación se realiza a través de tu cuenta de Google.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserProfile;

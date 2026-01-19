import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { enabledProviders, microsoftClientId, oauthRedirectUri } from '../services/oauthConfig';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();
  
  // Si el usuario ya está logueado, redirigir a dashboard
  useEffect(() => {
    console.log('📊 LoginPage useEffect - Estado:', { loading, userExists: !!user });
    if (!loading && user) {
      console.log('✅ Usuario autenticado, redirigiendo a dashboard');
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);
  
  // Estados para UI
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Enviar el authorization code al Gateway para que lo intercambie por tokens
  const sendCodeToGateway = async (code: string, provider: 'google' | 'microsoft') => {
    try {
      setError('');
      
      // Enviar el authorization code al Gateway
      // URL: ${VITE_WEBHOOK_URL}/auth/login (sin /api)
      const loginUrl = `${import.meta.env.VITE_WEBHOOK_URL}/auth/login`;
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,           // Authorization code (para Google)
          provider: provider    // 'google' o 'microsoft'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Acceso denegado por el servidor.');
      }

      const responseData = await response.json();
      console.log('✅ Respuesta del Gateway:', responseData);

      // El Gateway devuelve un array con la estructura:
      // [
      //   {
      //     "token": "appToken",
      //     "user": {
      //       "id_user": "user_id",
      //       "id_tenant": "tenant_id",
      //       "name_user": "User Name",
      //       "email_user": "user@example.com",
      //       "rol_user": "admin",
      //       "avatar_url": "https://...",
      //       "status_user": "Activo",
      //       "googleConnected": true
      //     }
      //   }
      // ]

      // Extraer el primer elemento si es un array, o usar directamente si es objeto
      const data = Array.isArray(responseData) ? responseData[0] : responseData;

      if (!data || !data.token) {
        throw new Error('El Gateway no devolvió un token válido.');
      }

      // ✅ El usuario ya viene en el formato correcto desde el Gateway
      // Gateway devuelve: id_user, id_tenant, name_user, email_user, rol_user, avatar_url, status_user, googleConnected
      // App usa exactamente lo mismo
      const userData = data.user || {};

      // Asegurar que todos los campos necesarios estén presentes
      const completeUserData = {
        id_user: userData.id_user,
        id_tenant: userData.id_tenant,
        name_user: userData.name_user,
        email_user: userData.email_user,
        rol_user: userData.rol_user,
        avatar_url: userData.avatar_url,
        status_user: userData.status_user || 'Activo',
        googleConnected: userData.googleConnected || false,
        outlookConnected: userData.outlookConnected || false,
        phone_user: userData.phone_user || '',
        job_title: userData.job_title || '',
      };

      console.log('👤 Datos del usuario:', {
        id_user: completeUserData.id_user,
        id_tenant: completeUserData.id_tenant,
        name_user: completeUserData.name_user,
        email_user: completeUserData.email_user,
        rol_user: completeUserData.rol_user,
      });

      // Guardar el appToken y el usuario
      // El useEffect del componente detectará el cambio en 'user' y navegará automáticamente
      console.log('🔐 Llamando a login() con completeUserData:', completeUserData);
      login(data.token, completeUserData);
      console.log('✅ login() ejecutado. Esperando que el useEffect detecte el cambio en user...');

    } catch (err: any) {
      console.error('❌ Error al intercambiar token:', err);
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoadingProvider(null);
    }
  };

  // --- CONFIGURACIÓN GOOGLE: Obtener authorization code ---
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse: any) => {
      setLoadingProvider('google');
      console.log('🔐 Google authorization code recibido');
      // tokenResponse.code contiene el authorization code en flujo auth-code
      const code = tokenResponse.code;
      if (!code) {
        setError('No se recibió el código de autorización de Google.');
        setLoadingProvider(null);
        return;
      }
      sendCodeToGateway(code, 'google');
    },
    onError: () => {
      setError('Falló la conexión con Google.');
      setLoadingProvider(null);
    },
    flow: 'auth-code', // Authorization Code Flow para obtener el code (no id_token)
    // Scopes para Calendario, Gmail y acceso offline para refresh_token
    scope: "openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify"
  });

  // --- CONFIGURACIÓN MICROSOFT (POPUP MANUAL) ---
  const handleMicrosoftLogin = () => {
    if (!microsoftClientId) {
        setError('Falta configurar el Cliente de Microsoft.');
        return;
    }

    setError('');
    setLoadingProvider('microsoft');

    // Scopes de Microsoft
    const scopes = "openid profile email offline_access User.Read Mail.Send";
    // Usamos el origen actual como redirect para el popup
    const currentOrigin = window.location.origin; 
    
    // Cambiar a response_type=id_token para obtener el token directamente
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${microsoftClientId}&response_type=id_token&redirect_uri=${encodeURIComponent(currentOrigin)}&response_mode=fragment&scope=${encodeURIComponent(scopes)}&nonce=${Math.random()}`;
    
    // Centrar Popup
    const width = 500; const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
        authUrl, 
        'Microsoft Login', 
        `width=${width},height=${height},top=${top},left=${left}`
    );

    // Vigilar el Popup
    const interval = setInterval(() => {
        try {
            // Si el popup regresó a nuestro dominio
            if (popup?.location.href.indexOf(currentOrigin) === 0) {
                // Obtener el hash (fragment) que contiene el id_token
                const hash = popup.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const idToken = params.get('id_token');
                const err = params.get('error');
                
                popup.close();
                clearInterval(interval);

                if (idToken) {
                    // Enviar el authorization code al Gateway
                    // Nota: Para Microsoft también usamos el id_token como identificador
                    // El backend sabrá cómo procesarlo según el provider
                    sendCodeToGateway(idToken, 'microsoft');
                } else {
                    setError('Microsoft: ' + (err || 'Cancelado por el usuario'));
                    setLoadingProvider(null);
                }
            }
        } catch (e) {
            // Ignoramos errores de cross-origin mientras el usuario está en microsoft.com
        }

        if (popup?.closed) {
            clearInterval(interval);
            if (loadingProvider === 'microsoft') setLoadingProvider(null);
        }
    }, 500);
  };

  // --- RENDERIZADO ---
  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
          </div>
          <p className="text-slate-600">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo.png" alt="COMPUTEKSA 360" className="h-16 w-auto" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Iniciar Sesión
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Accede a tu espacio de trabajo en <span className="font-bold text-brand-600">CRM Computeksa</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200 sm:rounded-xl sm:px-10 border border-slate-100">
          
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4 animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fa-solid fa-circle-exclamation text-red-400"></i>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* GOOGLE BUTTON */}
            <button
              type="button"
              disabled={!enabledProviders.google || !!loadingProvider}
              onClick={() => googleLogin()}
              className={`w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition ${loadingProvider === 'google' ? 'opacity-70 cursor-wait' : ''} ${!enabledProviders.google ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loadingProvider === 'google' ? (
                <i className="fa-solid fa-circle-notch fa-spin text-slate-400"></i>
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              )}
              {loadingProvider === 'google' ? 'Conectando...' : 'Continuar con Google'}
            </button>

            {/* MICROSOFT BUTTON */}
            <button
              type="button"
              disabled={!enabledProviders.microsoft || !!loadingProvider}
              onClick={handleMicrosoftLogin}
              className={`w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition ${loadingProvider === 'microsoft' ? 'opacity-70 cursor-wait' : ''} ${!enabledProviders.microsoft ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loadingProvider === 'microsoft' ? (
                 <i className="fa-solid fa-circle-notch fa-spin text-slate-400"></i>
              ) : (
                 <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="M" className="w-5 h-5" />
              )}
              {loadingProvider === 'microsoft' ? 'Conectando...' : 'Continuar con Microsoft'}
            </button>

            {(!enabledProviders.google && !enabledProviders.microsoft) && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                Configura los Client ID en el archivo .env.local
              </p>
            )}
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Si tienes problemas para ingresar
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
               <button onClick={() => alert('Por favor contacta al administrador de tu Tenant.')} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                 <i className="fa-solid fa-key text-gray-400 mr-2 mt-0.5"></i> Recuperar acceso
               </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-6 w-full text-center">
          <p className="text-xs text-slate-400">© 2026 Computeksa CRM. Todos los derechos reservados.</p>
      </div>
    </div>
  );
};

export default LoginPage;
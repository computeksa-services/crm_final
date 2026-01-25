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
    if (!loading && user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);
  
  // Detectar si la sesión expiró y mostrar mensaje
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
      setError('Tu sesión ha expirado por seguridad. Por favor, ingresa nuevamente.');
      // Limpiar el parámetro de la URL sin recargar
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);
  
  // Estados para UI
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Enviar el authorization code al Gateway para que lo intercambie por tokens
  const sendCodeToGateway = async (code: string, provider: 'google' | 'microsoft') => {
    try {
      setError('');

      
      // Intercambio de Token: POST ${VITE_WEBHOOK_URL}/auth/login
      // El Gateway devuelve: { token: "appToken", user: {...} }
      const loginUrl = `${import.meta.env.VITE_WEBHOOK_URL}/auth/login`;
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,                    // Código OAuth de Google/Microsoft
          provider: provider,            // 'google' o 'microsoft'
          app_id: 'crm',                 // Identificador de la aplicación
          redirect_uri: oauthRedirectUri // URL de callback registrada
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Acceso denegado por el servidor.');
      }

      const responseData = await response.json();


      // El Gateway devuelve: { token: "appToken", user: {...} }
      // El objeto user contiene los datos mapeados a la estructura del CRM
      if (!responseData || !responseData.token) {
        throw new Error('El Gateway no devolvió un token válido.');
      }

      const { token: appToken, user: userData } = responseData;


      // Validar que el usuario tenga los campos esenciales
      if (!userData || !userData.id_user || !userData.id_tenant) {
        throw new Error('Los datos del usuario son incompletos.');
      }

      // Guardar el appToken y el usuario en el contexto
      // El useEffect del componente detectará el cambio en 'user' y navegará automáticamente

      login(appToken, userData);


    } catch (err: any) {
      console.error('❌ Error al intercambiar token:', err);
      // Detectar error específico de usuario no encontrado
      const errorMessage = err.message || 'No se pudo iniciar sesión.';
      if (errorMessage.includes('no_user')) {
        setError('Este usuario no tiene acceso a la aplicación. Por favor, contacta a soporte@computeksa.com para solicitar acceso.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  // --- CONFIGURACIÓN GOOGLE: Obtener authorization code ---
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse: any) => {
      setLoadingProvider('google');

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

    if (!oauthRedirectUri) {
        setError('Falta configurar VITE_REDIRECT_URI en las variables de entorno.');
        return;
    }

    setError('');
    setLoadingProvider('microsoft');

    // Scopes de Microsoft
    const scopes = "openid profile email offline_access User.Read Mail.ReadWrite Calendars.ReadWrite";
    
    // IMPORTANTE: Usar response_type=code para obtener authorization code (no id_token)
    // Y usar oauthRedirectUri de las variables de entorno
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${microsoftClientId}&response_type=code&redirect_uri=${encodeURIComponent(oauthRedirectUri)}&response_mode=query&scope=${encodeURIComponent(scopes)}&prompt=select_account&state=${Math.random()}`;
    
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
            // Verificar si el popup ha sido redirigido a nuestro dominio
            if (popup && popup.location && popup.location.origin === window.location.origin) {
                // Obtener el query string que contiene el code
                const searchParams = new URLSearchParams(popup.location.search);
                const code = searchParams.get('code');
                const err = searchParams.get('error');
                
                popup.close();
                clearInterval(interval);

                if (code) {
                    // Enviar el authorization code al Gateway
                    sendCodeToGateway(code, 'microsoft');
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

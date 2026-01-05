import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { enabledProviders, microsoftClientId, oauthRedirectUri } from '../services/oauthConfig';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Estados para UI
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');

  // --- 1. COMUNICACIÓN CON EL BACKEND (N8N) ---
  const sendCodeToBackend = async (code: string, provider: 'google' | 'microsoft', msRedirectUri?: string) => {
    try {
      setError('');
      // URL de tu Webhook en n8n
      const endpoint = `${import.meta.env.VITE_WEBHOOK_URL}/api/auth/callback`; 
      
      // Determinamos el redirect_uri correcto según el proveedor
      // Google (Popup) requiere la palabra clave 'postmessage'
      // Microsoft (Popup) requiere la URL exacta donde aterrizó el popup
      const finalRedirectUri = provider === 'google' ? 'postmessage' : msRedirectUri;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          provider,
          redirect_uri: finalRedirectUri 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error en el servidor al validar sesión.');
      }

      const data = await response.json();
      const authData = Array.isArray(data) ? data[0] : data;

      console.log("📦 Datos recibidos de n8n:", authData);
      
      // Validamos que la respuesta tenga lo necesario
      if (data.token && data.user) {
        login(data.token, data.user);
        navigate('/dashboard');
      } else if (data.error) {
         throw new Error(data.message || 'Error de autenticación.');
      } else {
        throw new Error('Respuesta inválida del servidor.');
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoadingProvider(null);
    }
  };

  // --- 2. CONFIGURACIÓN GOOGLE ---
  const googleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setLoadingProvider('google');
      console.log("Google Code Recibido");
      sendCodeToBackend(codeResponse.code, 'google');
    },
    onError: () => {
      setError('Falló la conexión con Google.');
      setLoadingProvider(null);
    },
    flow: 'auth-code',
    // Scopes para Calendario y Gmail (además de los básicos)
    scope: "openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify"
  });

  // --- 3. CONFIGURACIÓN MICROSOFT (POPUP MANUAL) ---
  const handleMicrosoftLogin = () => {
    if (!microsoftClientId) {
        setError('Falta configurar el Cliente de Microsoft.');
        return;
    }

    setError('');
    setLoadingProvider('microsoft');

    // Scopes de Microsoft
    const scopes = "openid profile email offline_access User.Read Mail.Send";
    // Usamos el origen actual (localhost:5173) como redirect para el popup
    const currentOrigin = window.location.origin; 
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${microsoftClientId}&response_type=code&redirect_uri=${encodeURIComponent(currentOrigin)}&response_mode=query&scope=${encodeURIComponent(scopes)}`;
    
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
            // Si el popup regresó a nuestro dominio (misma URL que currentOrigin)
            if (popup?.location.href.indexOf(currentOrigin) === 0) {
                const urlParams = new URLSearchParams(popup.location.search);
                const code = urlParams.get('code');
                const err = urlParams.get('error');
                
                popup.close();
                clearInterval(interval);

                if (code) {
                    // Enviamos a n8n el código y la URL exacta usada
                    sendCodeToBackend(code, 'microsoft', currentOrigin);
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
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
             <i className="fa-solid fa-cube text-white text-2xl"></i>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Iniciar Sesión
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Accede a tu espacio de trabajo en <span className="font-bold text-brand-600">Computeksa 360</span>
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
          <p className="text-xs text-slate-400">© 2025 Computeksa CRM. Todos los derechos reservados.</p>
      </div>
    </div>
  );
};

export default LoginPage;
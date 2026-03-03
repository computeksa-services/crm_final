import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../services/authProviders/googleAuth';
import { useMicrosoftAuth } from '../services/authProviders/microsoftAuth';
import { AUTH_PROVIDERS, ProviderType } from '../services/authProviders/providers';
import { LoginProviderButton } from '../components/LoginProviderButton';
import { enabledProviders, oauthRedirectUri } from '../services/oauthConfig';
import { PageLoader } from '../components/AppLoaders';

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

  // Inicializar hooks de autenticación para cada proveedor
  const googleAuthHandler = useGoogleAuth({
    onSuccess: (code) => {
      setLoadingProvider('google');
      sendCodeToGateway(code, 'google');
    },
    onError: () => {
      setError('Falló la conexión con Google.');
      setLoadingProvider(null);
    }
  });

  const microsoftAuthHandler = useMicrosoftAuth({
    scope: 'openid profile email offline_access User.Read',
    onSuccess: (code) => {
      setLoadingProvider('microsoft');
      sendCodeToGateway(code, 'microsoft');
    },
    onError: () => {
      setError('Falló la conexión con Microsoft.');
      setLoadingProvider(null);
    }
  });

  // Mapeo de proveedores a sus handlers
  const authHandlers: Record<ProviderType, () => void> = {
    google: googleAuthHandler,
    microsoft: microsoftAuthHandler,
    // Agregar nuevos proveedores aquí:
    // github: githubAuthHandler,
    // linkedin: linkedinAuthHandler,
  };

  // Disparador genérico para cualquier proveedor
  const handleProviderLogin = (provider: ProviderType) => {
    setError('');
    if (provider in authHandlers) {
      authHandlers[provider]();
    }
  };

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
          code: code,
          provider: provider,
          module: 'auth_only',
          app_id: 'crm',
          redirect_uri: oauthRedirectUri
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Acceso denegado por el servidor.');
      }

      const responseData = await response.json();
      const loginData = Array.isArray(responseData) ? responseData[0] : responseData;

      // El Gateway devuelve: { token: "appToken", user: {...} }
      // El objeto user contiene los datos mapeados a la estructura del CRM
      if (!loginData || !loginData.token) {
        throw new Error('El Gateway no devolvió un token válido.');
      }

      const { token: appToken, user: userData } = loginData;


      // Validar que el usuario tenga los campos esenciales
      if (!userData || !userData.id_user || !userData.id_tenant) {
        throw new Error('Los datos del usuario son incompletos.');
      }

      // Guardar el appToken. El contexto se encargará de solicitar /api/v1/me.
      await login(appToken, userData);


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



  // --- RENDERIZADO ---
  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return <PageLoader message="Cargando sesión..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-600 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo.png" alt="CRM COMPUTEKSA" className="h-16 w-auto" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-slate-100">
          Iniciar Sesión
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Accede a tu espacio de trabajo en <span className="font-bold text-brand-600">CRM COMPUTEKSA</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-500 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-700 sm:rounded-xl sm:px-10 border border-slate-100 dark:border-slate-400">
          
          {error && (
            <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4 animate-fade-in border dark:border-red-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fa-solid fa-circle-exclamation text-red-400"></i>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Renderizar botones dinámicamente para cada proveedor habilitado */}
            {Object.entries(AUTH_PROVIDERS)
              .filter(([provider, config]) => config.enabled && enabledProviders[provider as keyof typeof enabledProviders])
              .map(([provider, config]) => (
                <LoginProviderButton
                  key={provider}
                  provider={provider as ProviderType}
                  isLoading={loadingProvider === provider}
                  onClick={() => handleProviderLogin(provider as ProviderType)}
                  disabled={!!loadingProvider && loadingProvider !== provider}
                />
              ))}

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

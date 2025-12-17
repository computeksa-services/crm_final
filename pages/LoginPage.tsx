import React, { useState } from 'react';
import { googleClientId, oauthRedirectUri } from '../services/oauthConfig';

const LoginPage: React.FC = () => {
  const [error, setError] = useState('');

  const handleMicrosoftLogin = () => {
    setError('Microsoft login aún no está implementado. Por favor usa Google.');
  };

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
            <div className="mb-6 rounded-md bg-red-50 p-4">
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
            {/* GOOGLE BUTTON - LINK DIRECTO */}
            {googleClientId && (
              <a
                href={`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
                  client_id: googleClientId,
                  redirect_uri: oauthRedirectUri || `${window.location.origin}/auth/callback`,
                  response_type: 'code',
                  scope: 'openid profile email',
                  access_type: 'offline',
                  prompt: 'consent',
                }).toString()}`}
                className="w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Continuar con Google
              </a>
            )}

            {!googleClientId && (
              <button
                type="button"
                disabled
                className="w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 opacity-50 cursor-not-allowed"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Continuar con Google
              </button>
            )}

            {/* MICROSOFT BUTTON */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              className={`w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition opacity-50 cursor-not-allowed`}
              disabled
            >
              <i className="fa-brands fa-microsoft text-lg text-slate-700"></i>
              Microsoft (no disponible)
            </button>

            {!googleClientId && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                Configura VITE_GOOGLE_CLIENT_ID en el archivo .env
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
               <button onClick={() => alert('Contacta al administrador.')} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                 <i className="fa-solid fa-key text-gray-400 mr-2 mt-0.5"></i> Recuperar acceso
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
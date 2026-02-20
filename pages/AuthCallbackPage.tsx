import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, AUTH_SUCCESS_MESSAGE } from '../services/authService';

// Guard global para evitar doble procesamiento del callback
let isProcessingGlobal = false;

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      if (isProcessingGlobal) return;
      isProcessingGlobal = true;
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');

        // Si el proveedor ya devolvió el code, enviarlo a la ventana principal
        if (code) {
          setError('');
          setLoading(true);

          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: AUTH_SUCCESS_MESSAGE, provider: 'microsoft', code, state },
              window.location.origin
            );
            // Cerrar el popup una vez que el mensaje se haya enviado
            setTimeout(() => {
              window.close();
            }, 150);
            return;
          }

          // Fallback: si no hay ventana principal, informar y permitir reintentar
          setError('No se detectó la ventana principal para completar el login. Regresa a la aplicación e inténtalo de nuevo.');
          setLoading(false);
        }

        // Si el proveedor devolvió un error explícito, mostrarlo
        if (errorParam) {
          setError('Microsoft: ' + errorParam);
          setLoading(false);
          return;
        }

        // Sin code: decidir en base a sesión existente
        const token = authService.getToken();
        if (token) {
          navigate('/app/dashboard');
        } else {
          navigate('/login');
        }
      } catch (err: any) {
        console.error('❌ Error en callback:', err);
        setError(err.message || 'Error al procesar la autenticación');
        setLoading(false);
      } finally {
        // Liberar el lock después de completar el flujo (salvo el return temprano por code)
        isProcessingGlobal = false;
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {loading && (
          <>
            <div className="animate-spin mb-4 inline-block">
              <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Procesando autenticación...</h2>
            <p className="text-sm text-slate-600 mt-2">No cierres esta ventana mientras completamos el inicio de sesión.</p>
          </>
        )}

        {error && !loading && (
          <div className="animate-fade-in">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <i className="fa-solid fa-circle-exclamation text-red-600 text-3xl block mb-2"></i>
              <p className="text-red-800 font-semibold">Acceso Denegado</p>
              <p className="text-red-700 text-sm mt-2">{error}</p>
              <p className="text-red-600 text-xs mt-3">
                Si crees que esto es un error, contacta al administrador.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  // Forzar logout completo
                  authService.removeToken();
                  localStorage.clear();
                  navigate('/login');
                }}
                className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold transition"
              >
                Volver al login
              </button>
              <button
                onClick={() => {
                  // Limpiar completamente y permitir probar con otra cuenta
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/login';
                }}
                className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition"
              >
                Probar con otra cuenta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;

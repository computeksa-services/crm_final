import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { apiFetch } from '../services/apiClient';
import { GATEWAY_CONFIG, buildUrl } from '../services/gatewayConfig';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Nota: El flujo de login ahora es directo desde LoginPage
        // Este archivo se puede usar para validaciones futuras
        // Por ahora, simplemente redirigir al dashboard si ya hay token
        
        const token = authService.getToken();
        if (token) {
          navigate('/app/dashboard');
        } else {
          // Si no hay token, volver al login
          navigate('/login');
        }

      } catch (err: any) {
        console.error('❌ Error en callback:', err);
        setError(err.message || 'Error al procesar la autenticación');
        setLoading(false);
      }
    };

    handleCallback();
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {loading && (
          <>
            <div className="animate-spin mb-4 inline-block">
              <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Iniciando sesión...</h2>
            <p className="text-sm text-slate-600 mt-2">Estamos validando tus credenciales.</p>
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
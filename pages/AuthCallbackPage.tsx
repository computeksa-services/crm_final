import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          throw new Error(`Error del servidor: ${errorParam}`);
        }

        if (!code) {
          throw new Error('No se recibió el código de autorización');
        }

        console.log('🔐 OAuth callback recibido:', { code, state });

        // Enviar el code al backend
        const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}/api/auth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Error del servidor (${response.status}): ${errorData || 'No autorizado'}`);
        }

        const data = await response.json();
        console.log('✅ Respuesta COMPLETA del backend:', data);

        // Validar que sea un array y tenga datos
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('El backend no devolvió datos válidos');
        }

        // --- CORRECCIÓN AQUÍ ---
        const authData = data[0]; // El objeto que contiene { token, user }
        
        // 1. Extraemos el TOKEN y el USUARIO por separado
        const token = authData.token;
        const userData = authData.user;

        if (!token) throw new Error('El servidor no devolvió el token de sesión');
        if (!userData) throw new Error('El servidor no devolvió los datos del usuario');

        console.log('🔑 Token a guardar:', token);
        console.log('👤 Usuario a guardar:', userData);

        // 2. Llamamos a login con AMBOS argumentos
        // login(token: string, user: User)
        login(token, userData);

        console.log('✅ Login completado. Redirigiendo...');
        
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 100);

      } catch (err: any) {
        console.error('❌ Error en callback:', err);
        setError(err.message || 'Error al procesar la autenticación');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

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
              <p className="text-red-800 font-semibold">Error de autenticación</p>
              <p className="text-red-700 text-sm mt-2">{error}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold transition"
            >
              Volver al login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
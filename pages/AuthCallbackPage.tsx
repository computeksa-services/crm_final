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
        console.log('📤 Enviando código al backend para intercambio...');

        // Enviar el code al backend para obtener token y usuario
        const response = await fetch('https://service.computeksa.com/webhook/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Error del servidor (${response.status}): ${errorData || 'No autorizado'}`);
        }

        const data = await response.json();
        console.log('✅ Respuesta del backend:', data);

        // Validar que tenemos los datos necesarios
        if (!data.user) {
          throw new Error('El servidor no devolvió información del usuario');
        }

        // Guardar usuario en el contexto de autenticación
        login(data.user);

        console.log('✅ Login completado. Redirigiendo al dashboard...');
        
        // Redirigir al dashboard después de 500ms para asegurar que los datos estén guardados
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);

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
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        {loading && (
          <div className="text-center">
            <div className="animate-spin mb-4">
              <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Completando autenticación...</h2>
            <p className="text-sm text-slate-600 mt-2">Por favor espera mientras te conectamos</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center">
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

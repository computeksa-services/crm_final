import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../services/authProviders/googleAuth';
import { useMicrosoftAuth } from '../services/authProviders/microsoftAuth';
import { AUTH_PROVIDERS, ProviderType } from '../services/authProviders/providers';
import { LoginProviderButton } from '../components/LoginProviderButton';
import { enabledProviders, oauthRedirectUri } from '../services/oauthConfig';
import { PageLoader } from '../components/AppLoaders';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .lp-root {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: 'DM Sans', sans-serif;
    background: #ffffff;
  }

  @media (max-width: 1023px) {
    .lp-root { grid-template-columns: 1fr; }
    .lp-left { display: none !important; }
  }

  /* ── LEFT ─────────────────────────────────────────── */
  .lp-left {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 3rem 3.5rem;
    background: #f7f7f8;
    border-right: 1px solid #ebebed;
    overflow: hidden;
  }

  .lp-left::before {
    content: '';
    position: absolute;
    width: 480px;
    height: 480px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%);
    top: -80px;
    right: -120px;
    pointer-events: none;
  }

  .lp-left::after {
    content: '';
    position: absolute;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%);
    bottom: 60px;
    left: -80px;
    pointer-events: none;
  }

  .lp-top { position: relative; z-index: 1; }
  .lp-bottom { position: relative; z-index: 1; }

  .lp-logo { height: 32px; width: auto; }

  .lp-headline {
    margin-top: 3.5rem;
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1.2;
    color: #0f0f11;
    letter-spacing: -0.035em;
  }

  .lp-headline span {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .lp-sub {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #6b7280;
    line-height: 1.7;
    max-width: 320px;
  }

  .lp-features {
    margin-top: 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .lp-feat { display: flex; align-items: center; gap: 0.75rem; }

  .lp-feat-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .fi-indigo { background: #eef2ff; color: #6366f1; }
  .fi-emerald { background: #ecfdf5; color: #10b981; }
  .fi-violet { background: #f5f3ff; color: #7c3aed; }

  .lp-feat-text { font-size: 0.85rem; color: #374151; font-weight: 500; }

  .lp-testimonial {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
  }

  .lp-testimonial p {
    font-size: 0.85rem;
    color: #4b5563;
    line-height: 1.6;
    margin: 0 0 0.875rem;
  }

  .lp-testimonial p::before { content: '\u201c'; }
  .lp-testimonial p::after { content: '\u201d'; }

  .lp-author { display: flex; align-items: center; gap: 0.6rem; }

  .lp-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  .lp-author-info { display: flex; flex-direction: column; }
  .lp-author-name { font-size: 0.78rem; font-weight: 600; color: #111827; }
  .lp-author-role { font-size: 0.72rem; color: #9ca3af; }

  .lp-footer-text {
    font-size: 0.72rem;
    color: #9ca3af;
    font-family: 'DM Mono', monospace;
  }

  /* ── RIGHT ────────────────────────────────────────── */
  .lp-right {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 2rem;
    background: #ffffff;
  }

  .lp-card-wrap { width: 100%; max-width: 380px; }

  .lp-mobile-logo {
    display: none;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2rem;
  }

  @media (max-width: 1023px) { .lp-mobile-logo { display: flex; } }
  .lp-mobile-logo img { height: 34px; width: auto; }

  .lp-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    padding: 2.25rem 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.05);
  }

  .lp-card-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #6366f1;
    font-family: 'DM Mono', monospace;
    margin-bottom: 1rem;
  }

  .lp-label-pill {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6366f1;
  }

  .lp-card h2 {
    font-size: 1.6rem;
    font-weight: 700;
    color: #0f0f11;
    letter-spacing: -0.03em;
    margin: 0 0 0.4rem;
  }

  .lp-card-sub {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1.75rem;
  }

  .lp-card-sub strong { color: #374151; font-weight: 600; }

  .lp-error {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    margin-bottom: 1.25rem;
    animation: lp-slide-in 0.18s ease;
  }

  @keyframes lp-slide-in {
    from { opacity: 0; transform: translateY(-5px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .lp-error i { color: #ef4444; font-size: 0.85rem; margin-top: 1px; flex-shrink: 0; }
  .lp-error span { font-size: 0.8rem; color: #b91c1c; line-height: 1.5; }

  .lp-providers { display: flex; flex-direction: column; gap: 0.625rem; }

  .lp-config-warn {
    font-size: 0.75rem;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 0.75rem;
    text-align: center;
  }

  .lp-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1.5rem 0 1.25rem;
  }

  .lp-divider-line { flex: 1; height: 1px; background: #f0f0f2; }
  .lp-divider-text { font-size: 0.73rem; color: #9ca3af; white-space: nowrap; }

  .lp-support {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.7rem 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 500;
    color: #6b7280;
    text-decoration: none;
    transition: all 0.15s;
  }

  .lp-support:hover { background: #f3f4f6; border-color: #d1d5db; color: #374151; }

  .lp-secure-note {
    margin-top: 1rem;
    text-align: center;
    font-size: 0.7rem;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
  }

  .lp-copyright {
    margin-top: 1.75rem;
    text-align: center;
    font-size: 0.7rem;
    color: #c4c4cc;
    font-family: 'DM Mono', monospace;
  }
`;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate('/app/dashboard', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
      setError('Tu sesión ha expirado por seguridad. Por favor, ingresa nuevamente.');
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState('');

  const googleAuthHandler = useGoogleAuth({
    onSuccess: (code) => { setLoadingProvider('google'); sendCodeToGateway(code, 'google'); },
    onError: () => { setError('Falló la conexión con Google.'); setLoadingProvider(null); }
  });

  const microsoftAuthHandler = useMicrosoftAuth({
    scope: 'openid profile email offline_access User.Read',
    onSuccess: (code) => { setLoadingProvider('microsoft'); sendCodeToGateway(code, 'microsoft'); },
    onError: () => { setError('Falló la conexión con Microsoft.'); setLoadingProvider(null); }
  });

  const authHandlers: Record<ProviderType, () => void> = {
    google: googleAuthHandler,
    microsoft: microsoftAuthHandler,
  };

  const handleProviderLogin = (provider: ProviderType) => {
    setError('');
    if (provider in authHandlers) authHandlers[provider]();
  };

  const sendCodeToGateway = async (code: string, provider: 'google' | 'microsoft') => {
    try {
      setError('');
      const loginUrl = `${import.meta.env.VITE_WEBHOOK_URL}/auth/login`;
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, provider, module: 'auth_only', app_id: 'crm', redirect_uri: oauthRedirectUri }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Acceso denegado por el servidor.');
      }

      const responseData = await response.json();
      const loginData = Array.isArray(responseData) ? responseData[0] : responseData;

      if (!loginData || !loginData.token) throw new Error('El Gateway no devolvió un token válido.');

      const { token: appToken, user: userData } = loginData;

      if (!userData || !userData.id_user || !userData.id_tenant) throw new Error('Los datos del usuario son incompletos.');

      await login(appToken, userData);

    } catch (err: any) {
      console.error('❌ Error al intercambiar token:', err);
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

  if (loading) return <PageLoader message="Cargando sesión..." />;

  return (
    <>
      <style>{styles}</style>

      <Helmet>
        <title>Iniciar Sesión | CRM COMPUTEKSA</title>
        <meta name="description" content="Accede a tu espacio de trabajo de CRM COMPUTEKSA de forma segura." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://crm.computeksa.com/login" />
      </Helmet>

      <div className="lp-root">

        {/* ── LEFT ── */}
        <div className="lp-left">
          <div className="lp-top">
            <img src="/logo_large.png" alt="CRM COMPUTEKSA" className="lp-logo" loading="eager" decoding="async" />

            <h1 className="lp-headline">
              Tu operación<br />
              comercial, <span>unificada.</span>
            </h1>
            <p className="lp-sub">
              Gestiona ventas, marketing y cartera con acceso seguro y centralizado para todo tu equipo.
            </p>

            <div className="lp-features">
              <div className="lp-feat">
                <div className="lp-feat-icon fi-indigo"><i className="fa-solid fa-shield-halved"></i></div>
                <span className="lp-feat-text">Autenticación segura de nivel empresarial</span>
              </div>
              <div className="lp-feat">
                <div className="lp-feat-icon fi-emerald"><i className="fa-solid fa-users"></i></div>
                <span className="lp-feat-text">Acceso rápido para equipos comerciales</span>
              </div>
              <div className="lp-feat">
                <div className="lp-feat-icon fi-violet"><i className="fa-solid fa-chart-line"></i></div>
                <span className="lp-feat-text">Plataforma diseñada para crecer contigo</span>
              </div>
            </div>

            {/* Testimonial - oculto temporalmente
            <div className="lp-testimonial" style={{ marginTop: '2.5rem' }}>
              <p>Desde que usamos el CRM, nuestro equipo comercial cierra un 40% más de negocios con la mitad del esfuerzo.</p>
              <div className="lp-author">
                <div className="lp-avatar">JM</div>
                <div className="lp-author-info">
                  <span className="lp-author-name">Juan Martínez</span>
                  <span className="lp-author-role">Director Comercial · Computeksa</span>
                </div>
              </div>
            </div>
            */}
          </div>

          <div className="lp-bottom">
            <p className="lp-footer-text">crm.computeksa.com · v2026</p>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="lp-right">
          <div className="lp-card-wrap">

            <div className="lp-mobile-logo">
              <img src="/logo.png" alt="CRM COMPUTEKSA" loading="eager" decoding="async" />
            </div>

            <div className="lp-card">
              <div className="lp-card-label">
                <span className="lp-label-pill"></span>
                Portal de acceso
              </div>

              <h2>Iniciar Sesión</h2>
              <p className="lp-card-sub">
                Accede a tu espacio en <strong>CRM COMPUTEKSA</strong>
              </p>

              {error && (
                <div className="lp-error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="lp-providers">
                {Object.entries(AUTH_PROVIDERS)
                  .filter(([provider, config]) =>
                    config.enabled && enabledProviders[provider as keyof typeof enabledProviders]
                  )
                  .map(([provider]) => (
                    <LoginProviderButton
                      key={provider}
                      provider={provider as ProviderType}
                      isLoading={loadingProvider === provider}
                      onClick={() => handleProviderLogin(provider as ProviderType)}
                      disabled={!!loadingProvider && loadingProvider !== provider}
                    />
                  ))}

                {(!enabledProviders.google && !enabledProviders.microsoft) && (
                  <p className="lp-config-warn">Configura los Client ID en el archivo .env.local</p>
                )}
              </div>

              <div className="lp-divider">
                <div className="lp-divider-line"></div>
                <span className="lp-divider-text">¿Tienes problemas para ingresar?</span>
                <div className="lp-divider-line"></div>
              </div>

              <a
                href="mailto:soporte@crm.computeksa.com?subject=Solicitud%20de%20acceso%20CRM"
                className="lp-support"
              >
                <i className="fa-solid fa-key"></i>
                Solicitar acceso
              </a>

              <p className="lp-secure-note">
                <i className="fa-solid fa-lock" style={{ fontSize: '0.65rem' }}></i>
                Acceso seguro para tu organización
              </p>
            </div>

            <p className="lp-copyright">© 2026 Computeksa CRM · Todos los derechos reservados</p>
          </div>
        </div>

      </div>
    </>
  );
};

export default LoginPage;
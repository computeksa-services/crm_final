import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { BrandSpinner } from '../components/AppLoaders';

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: Array<Record<string, unknown>>;
};

const DESKTOP_IMAGES = [
  { src: '/DESKTOP/DASHBOARD1.png', alt: 'Dashboard General', title: 'Visión Global' },
  { src: '/DESKTOP/TRATOS.png', alt: 'Gestión de Tratos', title: 'Pipeline de Ventas' },
  { src: '/DESKTOP/SEGUIMIENTO.png', alt: 'Seguimiento', title: 'Seguimiento Inteligente' },
  { src: '/DESKTOP/LISTA_CONTACTOS.png', alt: 'Contactos', title: 'Base de Datos' },
  { src: '/DESKTOP/CAMPAÑAS.png', alt: 'Campañas', title: 'Marketing Integrado' },
    { src: '/DESKTOP/CALENDARIO.png', alt: 'Calendario', title: 'Calendario Integrado' },

];

const MOBILE_IMAGES = [
  '/MOBILE/MOBILE_DASHBOARD.png',
  '/MOBILE/MOBILE_PIPELINE.png',
  '/MOBILE/MOBILE_SEGUIMIENTO.png',
  '/MOBILE/MOBILE_CAMPAÑAS.png',
  '/MOBILE/MOBILE_CARTERA.png',
  '/MOBILE/MOBILE_REGISTRAR_GESTION.png',
];

const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeDesktopImage, setActiveDesktopImage] = useState(0);

  const trackLandingCTA = (action: string, label: string) => {
    if (typeof window === 'undefined') return;

    const analyticsWindow = window as AnalyticsWindow;
    const ga4EventByAction: Record<string, string> = {
      click_demo: 'generate_lead',
      click_sales_email: 'contact',
      click_login: 'login',
    };
    const ga4EventName = ga4EventByAction[action];
    const eventParams = {
      event_category: 'landing_cta',
      event_label: label,
      value: 1,
      cta_action: action,
      cta_label: label,
    };

    if (typeof analyticsWindow.gtag === 'function') {
      analyticsWindow.gtag('event', action, eventParams);
      if (ga4EventName) {
        analyticsWindow.gtag('event', ga4EventName, eventParams);
      }
    }

    if (Array.isArray(analyticsWindow.dataLayer)) {
      analyticsWindow.dataLayer.push({
        event: 'landing_cta_click',
        cta_action: action,
        cta_label: label,
      });
      if (ga4EventName) {
        analyticsWindow.dataLayer.push({
          event: ga4EventName,
          cta_action: action,
          cta_label: label,
        });
      }
    }
  };

  // Si el usuario ya está logueado, redirigir a dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <BrandSpinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>CRM Empresarial para Ventas, Marketing y Cartera | Agenda Demo - COMPUTEKSA</title>
        <meta name="title" content="CRM Empresarial para Ventas, Marketing y Cartera | COMPUTEKSA" />
        <meta name="description" content="CRM empresarial con cotizaciones profesionales (versiones y adjuntos), seguimiento completo de leads, control de acceso por roles e integración con Google y Microsoft. Agenda tu demo." />
        <meta name="keywords" content="CRM empresarial, software CRM Ecuador, seguimiento de leads, cotizaciones con adjuntos, control de acceso por roles, CRM marketing ventas cartera, Google Calendar CRM, Outlook Calendar CRM, agenda demo CRM" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crm.computeksa.com/" />
        <meta property="og:title" content="CRM Empresarial para Ventas, Marketing y Cartera - COMPUTEKSA" />
        <meta property="og:description" content="Cotizaciones profesionales, seguimiento de leads, roles por módulo y calendario sincronizado. Agenda una demo de CRM COMPUTEKSA." />
        <meta property="og:image" content="https://crm.computeksa.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://crm.computeksa.com/" />
        <meta property="twitter:title" content="CRM Empresarial para Ventas, Marketing y Cartera - COMPUTEKSA" />
        <meta property="twitter:description" content="Cotizaciones profesionales, seguimiento de leads y acceso por roles. Agenda una demo." />
        <meta property="twitter:image" content="https://crm.computeksa.com/og-image.png" />
        
        {/* Additional SEO */}
        <link rel="canonical" href="https://crm.computeksa.com/" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="Spanish" />
        <meta name="author" content="COMPUTEKSA" />
        
        {/* Schema.org - SoftwareApplication */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "CRM COMPUTEKSA",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD",
              "description": "14 días de prueba gratuita"
            },
            "operatingSystem": "Web, iOS, Android",
            "description": "CRM empresarial para ventas, marketing y cartera con seguimiento de leads, cotizaciones profesionales e integraciones con Google y Microsoft.",
            "featureList": [
              "Marketing Automation Integrado",
              "Login con Google o Microsoft",
              "Automatización de Cobranza",
              "Cotizaciones Profesionales con Versiones y Adjuntos",
              "Kanban Drag & Drop",
              "Control de Acceso por Roles",
              "Sincronización de Calendario",
              "Seguimiento Completo de Leads",
              "Correos Funcionales y Corporativos"
            ]
          })}
        </script>
        
        {/* Schema.org - Organization */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "COMPUTEKSA",
            "url": "https://crm.computeksa.com",
            "logo": "https://crm.computeksa.com/logo_large.png",
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "ventas@crm.computeksa.com",
              "contactType": "Sales"
            }
          })}
        </script>

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "CRM COMPUTEKSA",
            "url": "https://crm.computeksa.com/",
            "inLanguage": "es",
            "description": "CRM empresarial para ventas, marketing y cartera. Agenda una demo en línea."
          })}
        </script>
      </Helmet>

    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center">
            <img src="/logo_large.png" alt="Logo de CRM COMPUTEKSA" className="h-12 w-auto" decoding="async" fetchPriority="high" />
          </div>
          <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
            <a href="#diferenciadores" className="hover:text-brand-600 transition-colors">Diferenciadores</a>
            <a href="#integraciones" className="hover:text-brand-600 transition-colors">Integraciones</a>
            <a href="#faq" className="hover:text-brand-600 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" onClick={() => trackLandingCTA('click_login', 'nav_login')} className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              Iniciar Sesión
            </Link>
            <a href="#contacto" onClick={() => trackLandingCTA('click_demo', 'nav_demo')} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-brand-200">
              Agendar Demo
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="text-center lg:text-left">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
                <span className="px-3 py-1 bg-brand-600/20 border border-brand-500/30 text-brand-300 rounded-full text-xs font-semibold">
                  Marketing Automation Incluido
                </span>
                <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-full text-xs font-semibold">
                  Correos Corporativos
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 lg:mb-6 leading-tight">
                CRM Empresarial para<br />Ventas, Marketing y Cartera
              </h1>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-brand-300 mb-6 lg:mb-8">
                Cotizaciones, Seguimiento de Leads y Calendario Integrado
              </h2>
              <p className="text-lg sm:text-xl text-slate-300 mb-8 lg:mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Automatiza ventas y postventa con un CRM empresarial completo: cotizaciones profesionales,
                control por roles, sincronización con Google/Microsoft y trazabilidad total de cada lead.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8 lg:mb-12">
                <a
                  href="#contacto"
                  onClick={() => trackLandingCTA('click_demo', 'hero_primary_demo')}
                  className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-base sm:text-lg transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 touch-manipulation"
                >
                  Agendar Demo <i className="fa-solid fa-arrow-right"></i>
                </a>
                <Link
                  to="/login"
                  onClick={() => trackLandingCTA('click_login', 'hero_secondary_login')}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 rounded-xl font-bold text-base sm:text-lg transition-all touch-manipulation"
                >
                  Iniciar Sesión
                </Link>
              </div>

              <p className="text-sm text-slate-400 mb-8 lg:mb-0">
                ✓ 14 días gratis &nbsp;•&nbsp; ✓ Sin tarjeta de crédito &nbsp;•&nbsp; ✓ Setup en 5 minutos
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 lg:gap-6 mt-12 lg:mt-16 pt-8 lg:pt-12 border-t border-slate-700">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold text-brand-400">10+</div>
                  <div className="text-xs lg:text-sm text-slate-400">Módulos<br className="hidden sm:inline" /> Integrados</div>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-bold text-brand-400">∞</div>
                  <div className="text-xs lg:text-sm text-slate-400">Usuarios<br className="hidden sm:inline" /> Ilimitados</div>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-bold text-brand-400">24/7</div>
                  <div className="text-xs lg:text-sm text-slate-400">Disponibilidad</div>
                </div>
              </div>
            </div>

            {/* Desktop & Mobile Preview */}
            <div className="relative">
              {/* Desktop Preview - Hidden on mobile, visible on lg+ */}
              <div className="hidden lg:block relative perspective-1000">
                <div className="relative z-10 bg-slate-800 p-2 rounded-xl shadow-2xl border border-slate-700 transform transition-transform duration-700 hover:scale-[1.02]">
                  <div className="absolute top-0 left-0 right-0 h-6 bg-slate-700 rounded-t-lg flex items-center px-3 gap-1.5 border-b border-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                  <div className="pt-6 bg-slate-900 rounded-lg overflow-hidden">
                    <img 
                      src="/DESKTOP/DASHBOARD1.png" 
                      alt="Dashboard del CRM mostrando métricas de ventas, pipeline de tratos y KPIs en tiempo real" 
                      className="w-full h-auto rounded shadow-inner"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      width="1200"
                      height="675"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile Preview - Visible on mobile only */}
              <div className="lg:hidden flex justify-center">
                <div className="w-64 shadow-2xl">
                  <img 
                    src="/MOBILE/MOBILE_DASHBOARD.png" 
                    alt="Dashboard móvil de CRM COMPUTEKSA para seguimiento comercial" 
                    className="w-full h-auto"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    width="400"
                    height="800"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-purple-600 opacity-10 blur-3xl rounded-full"></div>
      </header>

      {/* Visual Showcase Section */}
      <section className="py-24 bg-slate-900 overflow-hidden relative border-t border-slate-800">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-white font-bold tracking-wider uppercase text-sm">Interfaz Moderna</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-4 mb-6">Diseñado para la Velocidad</h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Una interfaz limpia, rápida e intuitiva que tu equipo realmente querrá usar.
              Disponible en escritorio y móvil.
            </p>
          </div>

          {/* Desktop Tabs & Preview */}
          <div className="mb-24">
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {DESKTOP_IMAGES.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveDesktopImage(idx)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    activeDesktopImage === idx 
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {img.title}
                </button>
              ))}
            </div>
            
            <div className="relative mx-auto max-w-6xl group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
                <div className="h-8 bg-slate-900 flex items-center px-4 space-x-2 border-b border-slate-700">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="bg-slate-900 relative">
                   <img 
                     key={activeDesktopImage}
                     src={DESKTOP_IMAGES[activeDesktopImage].src} 
                     alt={DESKTOP_IMAGES[activeDesktopImage].alt} 
                     className="w-full h-auto object-contain animate-in fade-in duration-500"
                     loading="lazy"
                     decoding="async"
                     fetchPriority="low"
                   />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Marquee */}
          <div className="relative">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-white">Lleva tu negocio en el bolsillo</h3>
              <p className="text-slate-300 mt-2">App móvil totalmente responsiva para gestionar desde cualquier lugar.</p>
            </div>
            
            {/* Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-slate-900 to-transparent"></div>
            <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-slate-900 to-transparent"></div>
            
            <div className="flex overflow-x-hidden space-x-8 py-8 group hover:pause-scroll">
              <div className="flex space-x-8 animate-marquee">
                {[...MOBILE_IMAGES, ...MOBILE_IMAGES].map((src, i) => (
                  <div key={i} className="flex-none w-64 transition-transform hover:scale-105 duration-300">
                     {/* Eliminado el borde negro y redondeado extra ya que la imagen ya lo trae */}
                    <div className="shadow-xl overflow-hidden h-auto">
                      <img src={src} alt="Vista móvil del CRM COMPUTEKSA" className="w-full h-auto object-contain" loading="lazy" decoding="async" fetchPriority="low" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <style>{`
          .animate-marquee {
            animation: marquee 40s linear infinite;
          }
          .hover\\:pause-scroll:hover .animate-marquee {
            animation-play-state: paused;
          }
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </section>

      {/* 10 Diferenciadores Clave */}
      <section id="diferenciadores" className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-white via-brand-50/30 to-purple-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs sm:text-sm font-bold text-brand-600 uppercase tracking-wider mb-3 sm:mb-4 px-4 py-2 bg-brand-100 rounded-full">
              Lo Que Nos Hace Únicos
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 px-4">
              11 Características Que Nos Diferencian
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto px-4">
              CRM empresarial con funcionalidades clave para crecer: seguimiento de leads, cotizaciones avanzadas,
              acceso por roles e integraciones reales para operación diaria.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* 1. Marketing Automation */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-brand-200 hover:border-brand-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-600 to-brand-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-paper-plane text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Marketing Automation Integrado</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Suite completa de marketing sin pagar Mailchimp. Campañas ilimitadas, segmentación avanzada y analytics.</p>
              <span className="text-xs sm:text-sm font-semibold text-brand-600">Todo incluido</span>
            </div>

            {/* 2. Login con Google o Microsoft */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-purple-200 hover:border-purple-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-right-to-bracket text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Login con Google o Microsoft</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Ingresa con tu cuenta Google o Microsoft. Sin contraseñas que recordar, autenticación segura OAuth.</p>
              <span className="text-xs sm:text-sm font-semibold text-purple-600">Acceso simple y seguro</span>
            </div>

            {/* 3. Automatización de Cobranza */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-green-200 hover:border-green-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-dollar-sign text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Automatización de Cobranza</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Recordatorios automáticos multi-destinatario. Configura días y reduce morosidad hasta 40%.</p>
              <span className="text-xs sm:text-sm font-semibold text-green-600">Típico de ERPs, no CRMs</span>
            </div>

            {/* 4. Permisos Granulares */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-user-shield text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Control de Acceso por Roles</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Acceso a módulos (CRM, Marketing, Cartera) por rol. Permisos por registro: VIEW/EDIT individual.</p>
              <span className="text-xs sm:text-sm font-semibold text-blue-600">Control empresarial</span>
            </div>

            {/* 5. Kanban Drag & Drop */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-orange-200 hover:border-orange-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-table-columns text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Kanban Visual Drag & Drop</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Pipeline interactivo profesional. Arrastra deals entre estados con animaciones fluidas.</p>
              <span className="text-xs sm:text-sm font-semibold text-orange-600">Como Trello + CRM</span>
            </div>

            {/* 6. Generación PDF */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-red-200 hover:border-red-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-file-invoice-dollar text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Cotizaciones Profesionales</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Múltiples versiones, adjunta archivos adicionales. PDFs automáticos + envío con tracking desde tu email.</p>
              <span className="text-xs sm:text-sm font-semibold text-red-600">Control total</span>
            </div>

            {/* 7. Correos Funcionales */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-envelope-open-text text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Correos Funcionales/Corporativos</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Configura emails corporativos para enviar desde direcciones funcionales. Branding consistente en todas las comunicaciones.</p>
              <span className="text-xs sm:text-sm font-semibold text-indigo-600">Control total de imagen</span>
            </div>

            {/* 8. Interfaz Rápida y Fluida */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-bolt text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Navegación Rápida y Fluida</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Cambias entre módulos al instante. Búsquedas ultrarrápidas. Tu equipo trabaja sin esperas.</p>
              <span className="text-xs sm:text-sm font-semibold text-teal-600">Productividad real</span>
            </div>

            {/* 9. Seguimiento Unificado */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-pink-200 hover:border-pink-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-route text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Seguimiento Completo de Leads</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Estados personalizados, timeline de interacciones, próximas acciones. Visualiza todo el ciclo del lead.</p>
              <span className="text-xs sm:text-sm font-semibold text-pink-600">Nunca pierdas un lead</span>
            </div>

            {/* 10. Sincronización de Calendario */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-cyan-200 hover:border-cyan-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-calendar-check text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Sincronización de Calendario</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Conecta Google Calendar o Outlook Calendar. Reuniones, eventos y tareas sincronizados en tiempo real.</p>
              <span className="text-xs sm:text-sm font-semibold text-cyan-600">Organiza tu día</span>
            </div>

            {/* 11. Customización Total */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border-2 border-amber-200 hover:border-amber-400 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-sliders text-white text-xl sm:text-2xl"></i>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">100% Personalizable</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-3 sm:mb-4">Estados, intereses, canales y etiquetas: todo personalizable sin código para tu empresa.</p>
              <span className="text-xs sm:text-sm font-semibold text-amber-600">Adapta a tu negocio</span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-lg sm:text-xl text-slate-700 mb-6 sm:mb-8 font-medium px-4">
              Todo lo que necesitas en una sola plataforma profesional
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
              <a
                href="#contacto"
                onClick={() => trackLandingCTA('click_demo', 'features_cta_demo')}
                className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-base sm:text-lg transition-all shadow-lg hover:shadow-xl touch-manipulation"
              >
                Agendar Demo
              </a>
              <a 
                href="mailto:ventas@crm.computeksa.com"
                onClick={() => trackLandingCTA('click_sales_email', 'features_cta_sales_email')}
                className="px-8 py-4 bg-white hover:bg-slate-50 text-brand-600 border-2 border-brand-600 rounded-xl font-bold text-base sm:text-lg transition-all touch-manipulation"
              >
                Hablar con Ventas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Integraciones con Google y Microsoft */}
      <section id="integraciones" className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Integraciones Completas con Google y Microsoft</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Conéctate con Google o Microsoft para acceder a todas las funcionalidades del CRM: 
              envío de emails, sincronización de calendario y almacenamiento de archivos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Google Services */}
            <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <i className="fa-brands fa-google text-2xl text-blue-600"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Google Workspace</h3>
                  <p className="text-slate-500 text-sm">Gmail, Calendar & Drive</p>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Envía emails desde Gmail directamente en el CRM</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Sincroniza reuniones y eventos con Google Calendar</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Almacena PDFs y documentos en Google Drive</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Login seguro con tu cuenta Google</span>
                </li>
              </ul>
            </div>

            {/* Microsoft 365 */}
            <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <i className="fa-brands fa-microsoft text-2xl text-blue-600"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Microsoft 365</h3>
                  <p className="text-slate-500 text-sm">Outlook & Exchange</p>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Envía emails desde Outlook dentro del CRM</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Sincroniza con Outlook Calendar automáticamente</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Integración con Exchange Online</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Login seguro con tu cuenta Microsoft</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Correos Funcionales/Corporativos */}
          <div className="mt-12 bg-gradient-to-r from-brand-600 to-purple-600 rounded-2xl p-8 sm:p-10 text-white">
            <div className="text-center mb-8">
              <i className="fa-solid fa-envelope-circle-check text-5xl mb-4 opacity-90"></i>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">Correos Funcionales y Corporativos</h3>
              <p className="text-lg text-brand-100 max-w-2xl mx-auto">
                Además de usar tu cuenta personal, configura emails corporativos funcionales para mantener 
                consistencia en todas las comunicaciones de tu empresa.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-xl p-6">
                <h4 className="font-bold text-lg mb-3">✉️ Emails Individuales</h4>
                <p className="text-brand-100 text-sm">
                  Cada usuario envía desde su cuenta personal (Gmail o Outlook) conectada al CRM.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-6">
                <h4 className="font-bold text-lg mb-3">🏢 Emails Corporativos</h4>
                <p className="text-brand-100 text-sm">
                  Configura cuentas funcionales (ventas@empresa.com, soporte@empresa.com) para branding consistente.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 bg-white rounded-2xl p-8 border border-slate-200 text-center">
            <h4 className="text-xl font-bold text-slate-900 mb-3">Beneficios de las Integraciones</h4>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <i className="fa-solid fa-clock text-3xl text-brand-600 mb-3"></i>
                <p className="text-slate-600">Sincronización automática en tiempo real</p>
              </div>
              <div>
                <i className="fa-solid fa-shield text-3xl text-brand-600 mb-3"></i>
                <p className="text-slate-600">Seguridad de datos empresarial</p>
              </div>
              <div>
                <i className="fa-solid fa-link text-3xl text-brand-600 mb-3"></i>
                <p className="text-slate-600">Sin duplicación de información</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6">
              Preguntas Frecuentes sobre CRM Empresarial
            </h2>
            <p className="text-lg sm:text-xl text-slate-600">
              Todo lo que necesitas saber antes de empezar
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* FAQ 1 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Qué incluye este CRM empresarial?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Incluye gestión comercial y operativa desde el inicio: marketing automation, cotizaciones con versiones y adjuntos, seguimiento completo de leads, acceso por roles y sincronización con Google/Microsoft.
              </p>
            </details>

            {/* FAQ 2 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Necesito tarjeta de crédito para probar?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                No. Ofrecemos 14 días de prueba completamente gratis sin solicitar tarjeta de crédito. Accede a todas las funcionalidades sin restricciones. Si decides continuar, recién ahí configuras el método de pago.
              </p>
            </details>

            {/* FAQ 3 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Puedo migrar mis datos desde otro CRM?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Sí. Ofrecemos importación desde Excel/CSV con plantillas validadas. Si vienes de Salesforce, HubSpot, Pipedrive u otro CRM, podemos asistirte con la migración. Nuestro equipo de soporte te guía en el proceso sin costo adicional.
              </p>
            </details>

            {/* FAQ 4 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Cuántos usuarios puedo tener?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Usuarios ilimitados. Ideal para equipos en crecimiento. Agrega vendedores, marketers, administradores según las necesidades de tu empresa sin restricciones artificiales.
              </p>
            </details>

            {/* FAQ 5 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Cómo funcionan las integraciones con Google y Microsoft?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Conectas tu cuenta de Google o Microsoft una vez y el CRM obtiene permisos para enviar emails desde Gmail/Outlook, 
                sincronizar tu calendario y guardar archivos en Drive. Todo incluido sin cargos adicionales. 
                Además puedes configurar correos corporativos funcionales para mantener branding consistente.
              </p>
            </details>

            {/* FAQ 6 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Funciona en dispositivos móviles?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                100% responsive. Funciona perfectamente en iOS y Android via navegador. Todos los módulos están optimizados para móvil: crea cotizaciones, actualiza tratos, registra llamadas, envía campañas - todo desde tu smartphone o tablet.
              </p>
            </details>

            {/* FAQ 7 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Puedo personalizar estados, campos y procesos?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Totalmente. Personaliza estados de deals, intereses, canales, etiquetas y categorías de productos sin código. Cada empresa configura el CRM según sus procesos reales.
              </p>
            </details>

            {/* FAQ 8 */}
            <details className="group bg-slate-50 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:bg-slate-100 transition-colors">
              <summary className="cursor-pointer list-none flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-4">
                  ¿Qué soporte técnico incluye?
                </h3>
                <i className="fa-solid fa-chevron-down text-brand-600 group-open:rotate-180 transition-transform flex-shrink-0"></i>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Soporte por email incluido. Respuesta en menos de 24 horas hábiles. También contamos con documentación completa, guías de uso y recursos de capacitación para que tu equipo aproveche al máximo el CRM.
              </p>
            </details>
          </div>

          {/* CTA after FAQ */}
          <div className="mt-12 sm:mt-16 text-center px-4">
            <p className="text-base sm:text-lg text-slate-600 mb-6">
              ¿Tienes más preguntas? Estamos aquí para ayudarte.
            </p>
            <a 
              href="#contacto"
              onClick={() => trackLandingCTA('click_demo', 'faq_cta_demo')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-base sm:text-lg transition-all shadow-lg hover:shadow-xl touch-manipulation"
            >
              <i className="fa-solid fa-calendar-check"></i>
              Agendar Demo
            </a>
          </div>
        </div>

        {/* Schema.org FAQPage */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "¿Qué incluye este CRM empresarial?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Incluye marketing automation, cotizaciones con versiones y adjuntos, seguimiento completo de leads, acceso por roles y sincronización con Google/Microsoft."
                }
              },
              {
                "@type": "Question",
                "name": "¿Necesito tarjeta de crédito para probar?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "No. Ofrecemos 14 días de prueba completamente gratis sin solicitar tarjeta de crédito."
                }
              },
              {
                "@type": "Question",
                "name": "¿Puedo migrar mis datos desde otro CRM?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Sí. Ofrecemos importación desde Excel/CSV con plantillas validadas. Nuestro equipo de soporte te guía en el proceso sin costo adicional."
                }
              },
              {
                "@type": "Question",
                "name": "¿Cómo funcionan las integraciones con Google y Microsoft?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Conectas tu cuenta de Google o Microsoft una vez y el CRM obtiene permisos para enviar emails desde Gmail/Outlook, sincronizar tu calendario y guardar archivos en Drive. Todo incluido sin cargos adicionales."
                }
              },
              {
                "@type": "Question",
                "name": "¿Funciona en dispositivos móviles?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "100% responsive. Funciona perfectamente en iOS y Android via navegador."
                }
              }
            ]
          })}
        </script>
      </section>

      {/* Contactar con Ventas / Agendar Demo */}
      <section id="contacto" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">¿Interesado en CRM COMPUTEKSA?</h2>
            <p className="text-xl text-slate-600 mb-4">Contáctanos y agenda una demo para tu equipo.</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 sm:p-10 text-center">
            <p className="text-slate-600 mb-6">Elige cómo prefieres continuar:</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href="https://calendar.google.com/calendar/appointments/schedules/AcZssZ3lPjQaOsUZyzaDeDFfrxMciicxVxt7ztEK9I46f4cDr7vOK6q99ffeaZCeCXo-BxBprKFc6eUi?gv=true"
                target="_blank"
                rel="noreferrer"
                onClick={() => trackLandingCTA('click_demo', 'contact_calendar_demo')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all"
              >
                <i className="fa-solid fa-calendar-check text-lg"></i>
                Agendar Demo
              </a>
              <a href="mailto:ventas@crm.computeksa.com" onClick={() => trackLandingCTA('click_sales_email', 'contact_sales_email')} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-brand-600 border-2 border-brand-600 rounded-lg font-bold hover:bg-slate-50 transition-all">
                <i className="fa-solid fa-envelope text-lg"></i>
                ventas@crm.computeksa.com
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-slate-400 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo.png" alt="Logo de CRM COMPUTEKSA" className="h-8 w-auto" loading="lazy" decoding="async" fetchPriority="low" />
                <span className="font-bold text-white">CRM COMPUTEKSA</span>
              </div>
              <p className="text-sm">Tu ecosistema completo de gestión empresarial.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#diferenciadores" className="hover:text-brand-400">Diferenciadores</a></li>
                <li><a href="#integraciones" className="hover:text-brand-400">Integraciones</a></li>
                <li><a href="mailto:ventas@crm.computeksa.com" className="hover:text-brand-400">Ventas</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://computeksa.com" target="_blank" rel="noreferrer" className="hover:text-brand-400">Sitio Web</a></li>
                <li><a href="mailto:ventas@crm.computeksa.com" className="hover:text-brand-400">Contacto</a></li>
                <li><a href="#" className="hover:text-brand-400">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="hover:text-brand-400">Términos de Servicio</Link></li>
                <li><Link to="/privacy" className="hover:text-brand-400">Política de Privacidad</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-900 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Computeksa. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default LandingPage;

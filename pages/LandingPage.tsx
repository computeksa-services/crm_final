import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandSpinner } from '../components/AppLoaders';

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
        <div className="text-center">
          <BrandSpinner size="xl" className="mb-4" />
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center">
            <img src="/logo_large.png" alt="CRM COMPUTEKSA" className="h-12 w-auto" />
          </div>
          <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
            <a href="#plataforma" className="hover:text-brand-600 transition-colors">Plataforma</a>
            <a href="#caracteristicas" className="hover:text-brand-600 transition-colors">Características</a>
            <a href="#casos-uso" className="hover:text-brand-600 transition-colors">Casos de Uso</a>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              Iniciar Sesión
            </Link>
            <a href="#contratar" className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-brand-200">
              Contratar
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-48 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
                CRM by COMPUTEKSA
              </h1>
              <h2 className="text-2xl lg:text-3xl font-bold text-brand-300 mb-8">
                CRM Potente con Integraciones a Calendarios Google y Microsoft
              </h2>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-xl">
                Gestiona clientes, cotizaciones, tratos, cartera y más desde una sola plataforma. 
                Con conexión integrada a calendarios de Google y Microsoft para sincronizar reuniones y eventos automáticamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/login" className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl flex items-center justify-center">
                  Acceder al CRM <i className="fa-solid fa-arrow-right ml-2"></i>
                </Link>
                <a href="#contacto" className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl font-bold text-lg transition-all">
                  Contactar Ventas
                </a>
              </div>

              {/* Mobile Preview (Visible only on small screens) */}
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 mt-16 pt-12 border-t border-slate-700">
                <div>
                  <div className="text-3xl font-bold text-brand-400">10+</div>
                  <div className="text-sm text-slate-400">Módulos Integrados</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand-400">∞</div>
                  <div className="text-sm text-slate-400">Usuarios Ilimitados</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand-400">24/7</div>
                  <div className="text-sm text-slate-400">Disponibilidad</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block relative perspective-1000">
              <div className="relative z-10 bg-slate-800 p-2 rounded-xl shadow-2xl border border-slate-700 transform transition-transform duration-700 hover:scale-[1.02]">
                <div className="absolute top-0 left-0 right-0 h-6 bg-slate-700 rounded-t-lg flex items-center px-3 gap-1.5 border-b border-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                </div>
                <div className="pt-6 bg-slate-900 rounded-lg overflow-hidden">
                   {/* Imagen de fondo (Desktop) */}
                   <img src="/DESKTOP/CALENDARIO.png" alt="CRM Calendar" className="w-full h-auto rounded shadow-inner" />
                </div>
              </div>
              
              {/* Floating Mobile Phone - Image only (already has frame) */}
              <div className="absolute -bottom-16 -right-16 z-20 w-72 transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500 drop-shadow-2xl">
                 <img src="/MOBILE/MOBILE_SEGUIMIENTO.png" alt="CRM Mobile" className="w-full h-auto object-contain hover:scale-105 transition-transform" />
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000"></div>
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
                      <img src={src} alt="Mobile Screen" className="w-full h-auto object-contain" />
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

      {/* CRM COMPUTEKSA - Qué es? */}
      <section id="plataforma" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-bold text-brand-600 uppercase tracking-wider mb-4">Sobre CRM COMPUTEKSA</span>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Tu CRM Completo con Integraciones de Calendarios</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              CRM COMPUTEKSA es una plataforma integral diseñada para digitalizar y automatizar 
              todos los procesos clave de tu empresa. Incluye integraciones nativas con Google Calendar y Microsoft 365 para sincronizar automáticamente reuniones y eventos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mt-16">
            <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-users text-brand-600 text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">CRM COMPUTEKSA</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Gestión centralizada de clientes, cotizaciones, tratos y cartera. Todo en un solo lugar para que 
                tu equipo trabaje de forma coordinada y eficiente.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <i className="fa-solid fa-check text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Gestión multi-tenant para múltiples empresas</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Dashboard personalizable en tiempo real</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Automatización de cotizaciones y cartera</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-brand-50 to-purple-50 rounded-2xl p-10 border border-brand-200">
              <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-rocket text-white text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">CRM COMPUTEKSA: Tu Solución Integral</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Expandimos constantemente nuestro ecosistema con nuevas soluciones empresariales integradas para 
                automatizar todos tus procesos.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <i className="fa-solid fa-rocket text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Módulos adicionales en desarrollo</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-rocket text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Integraciones con herramientas populares</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-rocket text-brand-600 mt-1 mr-3 flex-shrink-0"></i>
                  <span className="text-slate-600">Roadmap público con funciones solicitadas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Características del CRM */}
      <section id="caracteristicas" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Características Principales del CRM</h2>
            <p className="text-xl text-slate-600">Todas las herramientas que necesitas para gestionar tu negocio de forma profesional.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: 'fa-file-invoice-dollar', title: 'Cotizaciones PDF Automáticas', desc: 'Genera cotizaciones profesionales en segundos con plantillas personalizables.' },
              { icon: 'fa-handshake', title: 'Gestión de Tratos', desc: 'Pipeline visual para seguimiento de oportunidades desde prospect a cliente.' },
              { icon: 'fa-users-gear', title: 'Multi-Tenant', desc: 'Una sola plataforma para múltiples empresas con datos completamente aislados.' },
              { icon: 'fa-calendar-check', title: 'Calendario Integrado', desc: 'Sincronización con eventos, reuniones y tareas del equipo en tiempo real.' },
              { icon: 'fa-chart-line', title: 'Reportes en Tiempo Real', desc: 'Métricas clave sobre ventas, rendimiento y actividad del equipo.' },
              { icon: 'fa-robot', title: 'Automatización', desc: 'Conecta correos, calendarios y otros sistemas en flujos de trabajo automáticos.' },
            ].map((feature, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-xl hover:bg-brand-50 transition-colors border border-slate-200">
                <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                  <i className={`fa-solid ${feature.icon}`}></i>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integraciones de Calendarios */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Integraciones Nativas de Calendarios</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">CRM COMPUTEKSA se conecta directamente con Google Calendar y Microsoft 365 para sincronizar automáticamente tus reuniones, eventos y tareas.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Google Calendar */}
            <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <i className="fa-brands fa-google text-2xl text-blue-600"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Google Calendar</h3>
                  <p className="text-slate-500 text-sm">Sincronización en tiempo real</p>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Importa automáticamente reuniones y eventos</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Crea eventos directamente desde el CRM</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Visualiza disponibilidad de tu equipo</span>
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
                  <span className="text-slate-600">Sincroniza con Outlook Calendar</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Integración con Exchange Online</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-green-600 mt-1 flex-shrink-0"></i>
                  <span className="text-slate-600">Acceso a disponibilidad de recursos</span>
                </li>
              </ul>
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
      <section id="casos-uso" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">¿Para Quién es CRM COMPUTEKSA?</h2>
            <p className="text-xl text-slate-400">Soluciones diseñadas para empresas B2B de todos los tamaños.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: 'fa-building',
                title: 'Empresas Medianas',
                desc: 'Equipo de ventas de 5-50 personas que necesita organizar su pipeline y mejorar conversiones.'
              },
              {
                icon: 'fa-store',
                title: 'Distribuidores B2B',
                desc: 'Gestiona múltiples clientes corporativos, cotizaciones y cartera de forma centralizada.'
              },
              {
                icon: 'fa-layer-group',
                title: 'Agencias & Consultoras',
                desc: 'Administra proyectos, cotizaciones y cartera de clientes con roles y permisos granulares.'
              },
            ].map((caso, i) => (
              <div key={i} className="bg-slate-800/50 p-8 rounded-xl border border-slate-700 hover:border-brand-600 transition-all">
                <div className="w-14 h-14 bg-brand-600/20 rounded-xl flex items-center justify-center text-brand-400 text-2xl mb-6">
                  <i className={`fa-solid ${caso.icon}`}></i>
                </div>
                <h3 className="text-xl font-bold mb-3">{caso.title}</h3>
                <p className="text-slate-400">{caso.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Centro de Marketing */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Centro de Marketing Integrado</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">Gestiona tu estrategia de marketing desde un mismo lugar. Crea campañas, gestiona listas de contactos y automatiza el envío de correos.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                icon: 'fa-envelope-circle-check',
                title: 'Campañas Email',
                desc: 'Crea y envía campañas de correo profesionales con plantillas personalizables.'
              },
              {
                icon: 'fa-users-viewfinder',
                title: 'Gestión de Leads',
                desc: 'Captura, segmenta y organiza tus prospectos en listas inteligentes.'
              },
              {
                icon: 'fa-newspaper',
                title: 'Boletines',
                desc: 'Envía boletines informativos automatizados a tus suscriptores.'
              },
              {
                icon: 'fa-list-check',
                title: 'Listas de Difusión',
                desc: 'Crea listas dinámicas y estáticas para segmentar tu audiencia.'
              },
            ].map((feature, i) => (
              <div key={i} className="bg-gradient-to-br from-brand-50 to-slate-50 p-6 rounded-xl border border-brand-200 hover:border-brand-400 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white text-xl mb-4">
                  <i className={`fa-solid ${feature.icon}`}></i>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-12 text-white text-center">
            <h3 className="text-3xl font-bold mb-4">Automatiza tu Marketing y Aumenta tu ROI</h3>
            <p className="text-xl text-brand-100 mb-8 max-w-2xl mx-auto">
              Todas las herramientas de marketing que necesitas integradas en tu CRM. Sin aplicaciones externas, sin datos duplicados.
            </p>
            <a href="/app/marketing" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-600 rounded-lg font-bold hover:bg-brand-50 transition-all shadow-xl">
              <i className="fa-solid fa-rocket"></i>
              Conocer Centro de Marketing
            </a>
          </div>
        </div>
      </section>

      {/* Contactar con Ventas / Agendar Demo */}
      <section id="contacto" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-6">¿Interesado en CRM COMPUTEKSA?</h2>
            <p className="text-xl text-slate-600 mb-4">Contáctanos para conocer un plan personalizado que se ajuste a las necesidades de tu negocio.</p>
            <p className="text-lg text-slate-500">O agendar una demo directamente:</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            {/* Google Calendar Appointment Scheduling begin */}
            <iframe src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ3lPjQaOsUZyzaDeDFfrxMciicxVxt7ztEK9I46f4cDr7vOK6q99ffeaZCeCXo-BxBprKFc6eUi?gv=true" style={{border: 0}} width="100%" height="600" frameBorder="0"></iframe>
            {/* end Google Calendar Appointment Scheduling */}
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-600">O contáctanos directamente:</p>
            <a href="mailto:ventas@crm.computeksa.com" className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all">
              <i className="fa-solid fa-envelope text-lg"></i>
              ventas@crm.computeksa.com
            </a>
          </div>
        </div>
      </section>

      {/* CTA - Contratar */}
      <section id="contratar" className="py-20 bg-gradient-to-r from-brand-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">¿Listo para transformar tu negocio?</h2>
          <p className="text-xl text-brand-100 mb-12 max-w-2xl mx-auto">
            Únete a empresas que ya están optimizando sus ventas y mejorando su rentabilidad con CRM COMPUTEKSA.
            Prueba gratis durante 14 días.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/login" 
              className="px-10 py-4 bg-white text-brand-600 hover:bg-slate-100 rounded-xl font-bold text-lg transition-all shadow-xl"
            >
              Acceder al CRM
            </Link>
            <a 
              href="mailto:ventas@computeksa.com?subject=Quiero%20contratar%20CRM%20COMPUTEKSA" 
              className="px-10 py-4 bg-transparent border-2 border-white hover:bg-white/10 rounded-xl font-bold text-lg transition-all"
            >
              Agendar Demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-slate-400 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo.png" alt="CRM COMPUTEKSA" className="h-8 w-auto" />
                <span className="font-bold text-white">CRM COMPUTEKSA</span>
              </div>
              <p className="text-sm">Tu ecosistema completo de gestión empresarial.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#caracteristicas" className="hover:text-brand-400">Características</a></li>
                <li><a href="#precios" className="hover:text-brand-400">Precios</a></li>
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
  );
};

export default LandingPage;

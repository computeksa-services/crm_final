import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
          <div className="animate-spin mb-4 inline-block">
            <i className="fa-solid fa-circle-notch text-brand-600 text-4xl"></i>
          </div>
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
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="COMPUTEKSA 360" className="h-10 w-auto" />
            <div>
              <div className="text-sm font-bold text-slate-900">COMPUTEKSA 360</div>
              <div className="text-xs text-slate-500">CRM & Soluciones Empresariales</div>
            </div>
          </div>
          <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
            <a href="#plataforma" className="hover:text-brand-600 transition-colors">Plataforma</a>
            <a href="#caracteristicas" className="hover:text-brand-600 transition-colors">Características</a>
            <a href="#casos-uso" className="hover:text-brand-600 transition-colors">Casos de Uso</a>
            <a href="#precios" className="hover:text-brand-600 transition-colors">Precios</a>
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
              <span className="inline-block py-2 px-4 rounded-full bg-brand-500/20 text-brand-300 text-xs font-bold uppercase tracking-wider mb-6 border border-brand-500/30">
                🚀 Solución Empresarial 2026
              </span>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
                COMPUTEKSA 360
              </h1>
              <h2 className="text-2xl lg:text-3xl font-bold text-brand-300 mb-8">
                Tu Ecosistema Completo de Gestión Empresarial
              </h2>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-xl">
                Gestiona clientes, cotizaciones, tratos, facturación y más desde una sola plataforma. 
                Diseñado para empresas B2B que desean escalar sin complicaciones.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/login" className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl flex items-center justify-center">
                  Acceder al CRM <i className="fa-solid fa-arrow-right ml-2"></i>
                </Link>
                <a href="#contratar" className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl font-bold text-lg transition-all">
                  Ver Planes
                </a>
              </div>

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

            <div className="hidden lg:block relative">
              <div className="bg-gradient-to-br from-brand-600/20 to-purple-600/20 rounded-2xl p-8 border border-brand-500/30 backdrop-blur">
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-slate-300 font-medium mb-2">Dashboard en Tiempo Real</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-3 bg-brand-500/40 rounded"></div>
                      <div className="h-3 bg-purple-500/40 rounded"></div>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-slate-300 font-medium mb-2">Gestión de Tratos</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-3 bg-brand-500/40 rounded"></div>
                      <div className="h-3 bg-purple-500/40 rounded"></div>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-slate-300 font-medium mb-2">Cotizaciones Automáticas</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-3 bg-brand-500/40 rounded"></div>
                      <div className="h-3 bg-purple-500/40 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-purple-600 opacity-10 blur-3xl rounded-full"></div>
      </header>

      {/* COMPUTEKSA 360 - Qué es? */}
      <section id="plataforma" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-bold text-brand-600 uppercase tracking-wider mb-4">Sobre COMPUTEKSA 360</span>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Un Ecosistema Integral para tu Negocio</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              COMPUTEKSA 360 es una plataforma de soluciones empresariales diseñada para digitalizar y automatizar 
              todos los procesos clave de tu empresa. El CRM es solo el principio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mt-16">
            <div className="bg-white rounded-2xl p-10 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-users text-brand-600 text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">CRM COMPUTEKSA</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Gestión centralizada de clientes, cotizaciones, tratos y facturación. Todo en un solo lugar para que 
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
                  <span className="text-slate-600">Automatización de cotizaciones y facturación</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-brand-50 to-purple-50 rounded-2xl p-10 border border-brand-200">
              <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-6">
                <i className="fa-solid fa-rocket text-white text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Próximo: COMPUTEKSA 360 Suite</h3>
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

      {/* Casos de Uso */}
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
                desc: 'Gestiona múltiples clientes corporativos, cotizaciones y facturación de forma centralizada.'
              },
              {
                icon: 'fa-layer-group',
                title: 'Agencias & Consultoras',
                desc: 'Administra proyectos, cotizaciones y facturación de clientes con roles y permisos granulares.'
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

      {/* Pricing */}
      <section id="precios" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Planes de Suscripción</h2>
            <p className="text-xl text-slate-600">Transparente, sin sorpresas. Elige el plan que mejor se ajuste a tu negocio.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                nombre: 'Startup',
                precio: '$99',
                periodo: 'mes',
                desc: 'Perfecto para iniciar',
                features: [
                  'Hasta 5 usuarios',
                  '1 empresa (tenant)',
                  'Gestión de clientes',
                  'Cotizaciones básicas',
                  'Dashboard simple',
                  'Soporte por email'
                ],
                cta: 'Comenzar Ahora',
                highlight: false
              },
              {
                nombre: 'Profesional',
                precio: '$299',
                periodo: 'mes',
                desc: 'Lo más popular',
                features: [
                  'Hasta 20 usuarios',
                  'Múltiples empresas',
                  'Gestión completa de tratos',
                  'Cotizaciones avanzadas',
                  'Reportes detallados',
                  'Automatización n8n',
                  'Soporte prioritario'
                ],
                cta: 'Contratar Ahora',
                highlight: true
              },
              {
                nombre: 'Empresarial',
                precio: 'Personalizado',
                periodo: '',
                desc: 'Para grandes operaciones',
                features: [
                  'Usuarios ilimitados',
                  'Empresas ilimitadas',
                  'API personalizada',
                  'Integraciones custom',
                  'Dedicado support 24/7',
                  'SLA garantizado',
                  'Consultoría incluida'
                ],
                cta: 'Contactar Ventas',
                highlight: false
              }
            ].map((plan, i) => (
              <div key={i} className={`rounded-2xl p-8 border transition-all ${
                plan.highlight 
                  ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white border-brand-600 shadow-2xl scale-105' 
                  : 'bg-white border-slate-200 text-slate-900 hover:shadow-lg'
              }`}>
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlight ? 'text-white' : ''}`}>{plan.nombre}</h3>
                <p className={`mb-6 ${plan.highlight ? 'text-brand-100' : 'text-slate-600'}`}>{plan.desc}</p>
                <div className="mb-8">
                  <span className={`text-5xl font-extrabold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                    {plan.precio}
                  </span>
                  {plan.periodo && <span className={plan.highlight ? 'text-brand-100' : 'text-slate-600'}> / {plan.periodo}</span>}
                </div>
                <button className={`w-full py-3 rounded-lg font-bold mb-8 transition-all ${
                  plan.highlight
                    ? 'bg-white text-brand-600 hover:bg-slate-100'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}>
                  {plan.cta}
                </button>
                <ul className="space-y-4">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start">
                      <i className={`fa-solid fa-check mt-1 mr-3 flex-shrink-0 ${plan.highlight ? 'text-brand-200' : 'text-brand-600'}`}></i>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
                <img src="/logo.png" alt="COMPUTEKSA 360" className="h-8 w-auto" />
                <span className="font-bold text-white">COMPUTEKSA 360</span>
              </div>
              <p className="text-sm">Tu ecosistema completo de gestión empresarial.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#caracteristicas" className="hover:text-brand-400">Características</a></li>
                <li><a href="#precios" className="hover:text-brand-400">Precios</a></li>
                <li><a href="mailto:contacto@computeksa.com" className="hover:text-brand-400">Soporte</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://computeksa.com" target="_blank" rel="noreferrer" className="hover:text-brand-400">Sitio Web</a></li>
                <li><a href="mailto:contacto@computeksa.com" className="hover:text-brand-400">Contacto</a></li>
                <li><a href="#" className="hover:text-brand-400">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-brand-400">Términos de Servicio</a></li>
                <li><a href="#" className="hover:text-brand-400">Política de Privacidad</a></li>
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

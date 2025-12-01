
import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <i className="fa-solid fa-cube text-brand-600 text-2xl"></i>
          <span className="text-xl font-bold tracking-tight text-slate-900">COMPUTEKSA 360</span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-brand-600">Características</a>
          <a href="#benefits" className="hover:text-brand-600">Beneficios</a>
          <a href="#pricing" className="hover:text-brand-600">Precios</a>
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600">
            Iniciar Sesión
          </Link>
          <a href="mailto:ventas@computeksa.com" className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-brand-200">
            Solicitar Demo
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden pt-16 pb-32 lg:pt-32 lg:pb-40">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-100">
            Nuevo CRM Multi-Tenant v2.0
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-tight">
            Gestión Inteligente para <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600">Empresas B2B</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-500 mb-10">
            Unifica cotizaciones, seguimiento de clientes y facturación en una sola plataforma. 
            Diseñado para escalar con tu negocio.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/login" className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl flex items-center">
              Empezar Ahora <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
            <a href="#features" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all">
              Ver Características
            </a>
          </div>
        </div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-full z-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </header>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Todo lo que necesitas para cerrar tratos</h2>
            <p className="text-slate-500 mt-4">Herramientas potentes simplificadas para tu flujo de trabajo diario.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: 'fa-file-invoice-dollar', title: 'Cotizaciones PDF', desc: 'Genera cotizaciones profesionales en segundos y envíalas directamente a tus clientes.' },
              { icon: 'fa-users-gear', title: 'Multi-Tenant', desc: 'Gestiona múltiples empresas u organizaciones desde una sola instalación centralizada.' },
              { icon: 'fa-robot', title: 'Automatización n8n', desc: 'Flujos de trabajo conectados a tu backend para sincronizar correos y calendarios.' },
              { icon: 'fa-chart-pie', title: 'Dashboard en Tiempo Real', desc: 'Métricas clave sobre tus ventas, tratos ganados y rendimiento del equipo.' },
              { icon: 'fa-shield-halved', title: 'Seguridad Empresarial', desc: 'Roles de usuario, permisos granulares y copias de seguridad automáticas.' },
              { icon: 'fa-mobile-screen', title: 'Diseño Responsivo', desc: 'Accede a tu CRM desde cualquier dispositivo, en cualquier lugar.' },
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 text-xl mb-6">
                  <i className={`fa-solid ${f.icon}`}></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 bg-slate-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">¿Listo para transformar tu negocio?</h2>
          <p className="text-slate-400 mb-10 text-lg">Únete a las empresas que ya gestionan sus ventas con Computeksa 360.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             <Link to="/login" className="px-8 py-4 bg-brand-600 hover:bg-brand-500 rounded-xl font-bold text-lg transition-colors">
               Acceder a la Plataforma
             </Link>
             <a href="mailto:contacto@computeksa.com" className="px-8 py-4 bg-transparent border border-slate-600 hover:bg-slate-800 rounded-xl font-bold text-lg transition-colors">
               Contactar Ventas
             </a>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-8 text-center text-slate-600 text-sm border-t border-slate-900">
        <p>&copy; {new Date().getFullYear()} Computeksa. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;

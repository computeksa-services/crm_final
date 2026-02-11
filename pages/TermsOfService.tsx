import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TermsOfService: React.FC = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center space-x-3">
            <img src="/logo.png" alt="CRM COMPUTEKSA" className="h-10 w-auto" />
            <div>
              <div className="text-sm font-bold text-slate-900">CRM COMPUTEKSA</div>
              <div className="text-xs text-slate-500">Gestión Integral de Negocios B2B</div>
            </div>
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
              Volver al Inicio
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Términos de Servicio</h1>
          <p className="text-xl text-slate-300">Última actualización: Enero 2026</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="prose prose-lg max-w-none">
          {/* Table of Contents */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">Índice de Contenidos</h2>
            <ul className="space-y-2 text-slate-700">
              <li><a href="#1" className="text-brand-600 hover:text-brand-700">1. Aceptación de Términos</a></li>
              <li><a href="#2" className="text-brand-600 hover:text-brand-700">2. Descripción del Servicio</a></li>
              <li><a href="#3" className="text-brand-600 hover:text-brand-700">3. Elegibilidad y Registro</a></li>
              <li><a href="#4" className="text-brand-600 hover:text-brand-700">4. Derechos de Propiedad Intelectual</a></li>
              <li><a href="#5" className="text-brand-600 hover:text-brand-700">5. Limitaciones de Responsabilidad</a></li>
              <li><a href="#6" className="text-brand-600 hover:text-brand-700">6. Modificación de Términos</a></li>
              <li><a href="#7" className="text-brand-600 hover:text-brand-700">7. Terminación de Servicios</a></li>
              <li><a href="#8" className="text-brand-600 hover:text-brand-700">8. Leyes Aplicables</a></li>
            </ul>
          </div>

          {/* Section 1 */}
          <section id="1" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">1. Aceptación de Términos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Al acceder y utilizar CRM COMPUTEKSA ("el Servicio"), usted acepta estar vinculado por estos Términos de Servicio ("Términos"). 
              Si no está de acuerdo con estos Términos en su totalidad, no debe usar el Servicio.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Computeksa se reserva el derecho de cambiar, modificar o ampliar estos Términos en cualquier momento. El uso continuado del Servicio 
              después de dichos cambios constituye su aceptación de los nuevos Términos.
            </p>
          </section>

          {/* Section 2 */}
          <section id="2" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">2. Descripción del Servicio</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              CRM COMPUTEKSA es una plataforma de gestión de relaciones con clientes basada en la nube que incluye funcionalidades para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Gestión de contactos y empresas</li>
              <li>Administración de oportunidades de venta</li>
              <li>Generación automática de cotizaciones y facturas</li>
              <li>Gestión de campañas de marketing</li>
              <li>Integración con calendarios de Google y Microsoft</li>
              <li>Reportes y análisis de datos</li>
              <li>Automatización de procesos empresariales</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              El Servicio está diseñado específicamente para empresas B2B y requiere suscripción activa para acceso continuo.
            </p>
          </section>

          {/* Section 3 */}
          <section id="3" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">3. Elegibilidad y Registro</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Para utilizar CRM COMPUTEKSA, usted debe:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Ser una persona natural mayor de 18 años o una entidad legal válida</li>
              <li>Tener autoridad para aceptar estos Términos en nombre de su empresa</li>
              <li>Proporcionar información de registro exacta, completa y actualizada</li>
              <li>Mantener confidencialidad de sus credenciales de acceso</li>
              <li>Ser responsable de todas las actividades bajo su cuenta</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              Usted es responsable de mantener la confidencialidad de sus credenciales de acceso. No puede compartir su cuenta con terceros 
              ni permitir acceso no autorizado. Debe notificar inmediatamente a Computeksa de cualquier acceso no autorizado.
            </p>
          </section>

          {/* Section 4 */}
          <section id="4" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">4. Derechos de Propiedad Intelectual</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Computeksa retiene todos los derechos de propiedad intelectual del Servicio, incluyendo pero no limitado a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Código fuente y arquitectura de software</li>
              <li>Interfaz de usuario y diseño gráfico</li>
              <li>Documentación y materiales de marketing</li>
              <li>Logotipos y marcas registradas</li>
              <li>Datos de análisis y reportes agregados</li>
            </ul>
            <p className="text-slate-700 mb-4 leading-relaxed">
              El usuario recibe una licencia limitada, no exclusiva, revocable para usar el Servicio únicamente para fines comerciales legítimos 
              de acuerdo a estos Términos.
            </p>
            <p className="text-slate-700 leading-relaxed">
              No puede reproducir, distribuir, modificar o crear trabajos derivados del Servicio sin consentimiento expreso de Computeksa.
            </p>
          </section>

          {/* Section 5 */}
          <section id="5" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">5. Limitaciones de Responsabilidad</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Renuncia de Garantías:</strong> El Servicio se proporciona "tal cual" sin garantías de ningún tipo, expresas o implícitas, 
              incluyendo garantías de comerciabilidad, idoneidad para un propósito particular, o no infracción.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Limitación de Responsabilidad:</strong> En ningún caso Computeksa será responsable por daños indirectos, incidentales, especiales, 
              consecuentes o punitivos, incluyendo pérdida de ganancias, datos, o uso, aún si ha sido informado de la posibilidad de tales daños.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Responsabilidad Total:</strong> La responsabilidad total de Computeksa bajo estos Términos no excederá la cantidad pagada por 
              el usuario en los últimos 12 meses, o $100 USD, la que sea mayor.
            </p>
            <p className="text-slate-700 leading-relaxed">
              El usuario es responsable por hacer copias de seguridad de sus datos. Computeksa no es responsable por pérdida de datos resultante de 
              cualquier causa, incluyendo errores de usuario.
            </p>
          </section>

          {/* Section 6 */}
          <section id="6" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">6. Modificación de Términos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Computeksa se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios serán efectivos inmediatamente 
              al ser publicados en el Servicio.
            </p>
            <p className="text-slate-700 leading-relaxed">
              El uso continuado del Servicio después de la publicación de cambios constituye aceptación de los Términos modificados. 
              Si no está de acuerdo con los cambios, debe dejar de usar el Servicio.
            </p>
          </section>

          {/* Section 7 */}
          <section id="7" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">7. Terminación de Servicios</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Terminación por Parte del Usuario:</strong> Puede cancelar su suscripción en cualquier momento siguiendo las instrucciones 
              en su panel de cuenta. La cancelación es efectiva al final del período de facturación actual.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Terminación por Computeksa:</strong> Podemos suspender o cancelar su acceso al Servicio sin previo aviso si:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Viola estos Términos de Servicio o la Política de Privacidad</li>
              <li>Utiliza el Servicio para actividades ilegales o no autorizadas</li>
              <li>No paga los cargos de suscripción después de 30 días de aviso</li>
              <li>Su actividad pone en riesgo la seguridad o integridad del Servicio</li>
              <li>Causa daño a otros usuarios o a Computeksa</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              Al terminar el Servicio, se eliminará su acceso a la cuenta dentro de 30 días. Puede descargar sus datos antes de que se eliminen.
            </p>
          </section>

          {/* Section 8 */}
          <section id="8" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">8. Leyes Aplicables</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Estos Términos se rigen por las leyes del país donde Computeksa está constituida, sin considerar sus conflictos de disposiciones legales.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Cualquier disputa será resuelta en los tribunales competentes, y usted acepta someterse a la jurisdicción exclusiva de dichos tribunales.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Si alguna disposición de estos Términos es inválida o inaplicable, las disposiciones restantes continuarán en vigor.
            </p>
          </section>

          {/* Contact Section */}
          <section className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-2xl font-bold mb-4 text-slate-900">¿Preguntas sobre estos Términos?</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Si tiene preguntas o inquietudes sobre estos Términos de Servicio, por favor contactenos:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <p className="text-slate-700 mb-2"><strong>Email:</strong> <a href="mailto:legal@crm.computeksa.com" className="text-brand-600 hover:text-brand-700">legal@crm.computeksa.com</a></p>
              <p className="text-slate-700"><strong>Sitio Web:</strong> <a href="https://computeksa.com" target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">www.computeksa.com</a></p>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:text-brand-400">Inicio</Link></li>
                <li><a href="/#caracteristicas" className="hover:text-brand-400">Características</a></li>
                <li><a href="/#casos-uso" className="hover:text-brand-400">Casos de Uso</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="hover:text-brand-400">Términos de Servicio</a></li>
                <li><a href="/privacy" className="hover:text-brand-400">Política de Privacidad</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://computeksa.com" target="_blank" rel="noreferrer" className="hover:text-brand-400">Sitio Web</a></li>
                <li><a href="mailto:contacto@crm.computeksa.com" className="hover:text-brand-400">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:soporte@crm.computeksa.com" className="hover:text-brand-400">Soporte</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Computeksa. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Política de Privacidad</h1>
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
              <li><a href="#1" className="text-brand-600 hover:text-brand-700">1. Introducción</a></li>
              <li><a href="#2" className="text-brand-600 hover:text-brand-700">2. Información que Recopilamos</a></li>
              <li><a href="#3" className="text-brand-600 hover:text-brand-700">3. Cómo Utilizamos su Información</a></li>
              <li><a href="#4" className="text-brand-600 hover:text-brand-700">4. Compartir Información</a></li>
              <li><a href="#5" className="text-brand-600 hover:text-brand-700">5. Seguridad de Datos</a></li>
              <li><a href="#6" className="text-brand-600 hover:text-brand-700">6. Derechos del Usuario</a></li>
              <li><a href="#7" className="text-brand-600 hover:text-brand-700">7. Cookies y Tecnologías Similares</a></li>
              <li><a href="#8" className="text-brand-600 hover:text-brand-700">8. Transferencias Internacionales</a></li>
              <li><a href="#9" className="text-brand-600 hover:text-brand-700">9. Retención de Datos</a></li>
              <li><a href="#10" className="text-brand-600 hover:text-brand-700">10. Contacto y Derechos</a></li>
            </ul>
          </div>

          {/* Section 1 */}
          <section id="1" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">1. Introducción</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Computeksa ("Nosotros", "Nuestro") opera la plataforma CRM COMPUTEKSA. Esta página le informa de nuestras políticas respecto a la recopilación, 
              uso y divulgación de datos personales cuando utiliza nuestro Servicio y las opciones que tiene asociadas a estos datos.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Utilizamos sus datos para proporcionar y mejorar el Servicio. Al usar CRM COMPUTEKSA, usted acepta la recopilación y uso de información 
              de acuerdo con esta política.
            </p>
          </section>

          {/* Section 2 */}
          <section id="2" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">2. Información que Recopilamos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Información de Registro:</strong> Cuando se registra en CRM COMPUTEKSA, recopilamos información como:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Nombre completo y nombre de empresa</li>
              <li>Dirección de correo electrónico</li>
              <li>Número de teléfono</li>
              <li>Dirección y ubicación</li>
              <li>Información de pago y facturación</li>
              <li>Preferencias de comunicación</li>
            </ul>

            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Datos de Uso:</strong> Automáticamente recopilamos información sobre cómo interactúa con el Servicio:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Dirección IP y tipo de navegador</li>
              <li>Páginas visitadas y tiempo en el sitio</li>
              <li>Enlaces en los que hace clic</li>
              <li>Búsquedas realizadas</li>
              <li>Información del dispositivo y sistema operativo</li>
              <li>Logs de acceso y actividad de usuario</li>
            </ul>

            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Datos de Negocio:</strong> Información que carga en su cuenta, incluyendo:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700">
              <li>Información de contactos y clientes</li>
              <li>Datos de transacciones y cotizaciones</li>
              <li>Archivos y documentos adjuntos</li>
              <li>Notas y comentarios internos</li>
              <li>Calendarios e integraciones sincronizadas</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="3" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">3. Cómo Utilizamos su Información</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Utilizamos la información recopilada para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Proporcionar, mantener y mejorar el Servicio</li>
              <li>Procesar pagos y enviar avisos relacionados con la facturación</li>
              <li>Enviar actualizaciones técnicas, confirmaciones y avisos de seguridad</li>
              <li>Responder a sus consultas y solicitudes de soporte</li>
              <li>Analizar patrones de uso para mejorar la experiencia del usuario</li>
              <li>Personalizar y optimizar el Servicio según sus preferencias</li>
              <li>Cumplir con obligaciones legales y regulatorias</li>
              <li>Detectar y prevenir fraude y actividades no autorizadas</li>
              <li>Enviar comunicaciones de marketing (con su consentimiento)</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="4" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">4. Compartir Información</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Proveedores de Servicios:</strong> Compartimos información con terceros que nos ayudan a operar el Servicio:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Proveedores de alojamiento en la nube (Amazon AWS, Google Cloud)</li>
              <li>Procesadores de pagos (Stripe, PayPal)</li>
              <li>Proveedores de correo electrónico y SMS</li>
              <li>Integraciones de calendarios (Google, Microsoft)</li>
              <li>Proveedores de análisis (Google Analytics)</li>
            </ul>

            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Requisitos Legales:</strong> Podemos divulgar información si es requerido por ley, regulación, orden judicial o solicitud gubernamental.
            </p>

            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Protección de Derechos:</strong> Podemos divulgar información cuando creemos de buena fe que es necesario para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Proteger nuestros derechos, privacidad y seguridad</li>
              <li>Proteger derechos, privacidad y seguridad de otros usuarios</li>
              <li>Detectar, prevenir o abordar fraude, seguridad u otros problemas técnicos</li>
            </ul>

            <p className="text-slate-700 leading-relaxed">
              <strong>No Venderemos Información:</strong> Nunca vendemos, comerciamos ni transferimos sus datos personales a terceros sin su consentimiento explícito.
            </p>
          </section>

          {/* Section 5 */}
          <section id="5" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">5. Seguridad de Datos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales contra acceso no autorizado, alteración, 
              divulgación o destrucción:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>Encriptación SSL/TLS para transmisión de datos</li>
              <li>Encriptación de datos en reposo en servidores seguros</li>
              <li>Autenticación de múltiples factores</li>
              <li>Firewalls y sistemas de detección de intrusiones</li>
              <li>Auditorías de seguridad regulares</li>
              <li>Controles de acceso basados en roles</li>
              <li>Monitoreo 24/7 de actividad sospechosa</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              Sin embargo, no podemos garantizar seguridad absoluta. Usted es responsable de mantener confidencial su contraseña y reportar 
              cualquier acceso no autorizado inmediatamente.
            </p>
          </section>

          {/* Section 6 */}
          <section id="6" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">6. Derechos del Usuario</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Dependiendo de su ubicación, puede tener los siguientes derechos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li><strong>Derecho de Acceso:</strong> Solicitar copia de los datos personales que tenemos sobre usted</li>
              <li><strong>Derecho de Rectificación:</strong> Solicitar corrección de información inexacta</li>
              <li><strong>Derecho de Eliminación:</strong> Solicitar eliminación de sus datos ("Derecho al Olvido")</li>
              <li><strong>Derecho a Restringir Procesamiento:</strong> Solicitar que limitemos cómo usamos sus datos</li>
              <li><strong>Derecho a Portabilidad de Datos:</strong> Solicitar sus datos en formato estructurado</li>
              <li><strong>Derecho a Oponerme:</strong> Oponerse al procesamiento de sus datos para ciertos fines</li>
              <li><strong>Derecho a No Ser Perfilado:</strong> Oponerme a la toma de decisiones automatizadas</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              Para ejercer estos derechos, contacte a nuestro Oficial de Privacidad en privacy@computeksa.com.
            </p>
          </section>

          {/* Section 7 */}
          <section id="7" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">7. Cookies y Tecnologías Similares</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Utilizamos cookies y tecnologías similares para mejorar su experiencia:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li><strong>Cookies Esenciales:</strong> Necesarias para funcionamiento del Servicio</li>
              <li><strong>Cookies de Preferencia:</strong> Recuerdan sus preferencias y configuración</li>
              <li><strong>Cookies de Análisis:</strong> Ayudan a entender cómo usa el Servicio</li>
              <li><strong>Cookies de Marketing:</strong> Personalizan anuncios y contenido</li>
            </ul>
            <p className="text-slate-700 leading-relaxed">
              Puede controlar cookies a través de la configuración de su navegador. Algunas cookies esenciales no pueden ser deshabilitadas 
              sin afectar la funcionalidad del Servicio.
            </p>
          </section>

          {/* Section 8 */}
          <section id="8" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">8. Transferencias Internacionales</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Su información puede ser transferida a, almacenada en, y procesada en países distintos a su país de residencia. Estos países 
              pueden tener leyes de protección de datos diferentes a las suyas.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Al usar CRM COMPUTEKSA, usted consiente estas transferencias. Implementamos salvaguardas apropiadas, incluyendo Cláusulas 
              Contractuales Estándar, para proteger sus datos durante transferencias internacionales.
            </p>
          </section>

          {/* Section 9 */}
          <section id="9" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">9. Retención de Datos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Retenemos sus datos personales mientras su cuenta esté activa. Puede solicitar eliminación en cualquier momento.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Datos de Negocio:</strong> Retenemos datos de transacciones durante 7 años para cumplir con obligaciones contables y fiscales.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Datos de Uso:</strong> Retenemos logs de acceso por 90 días para fines de seguridad y auditoría.
            </p>
            <p className="text-slate-700 leading-relaxed">
              <strong>Información de Marketing:</strong> Si se suscribió a comunicaciones de marketing, retenemos su información hasta que se 
              desuscribe o cancela su cuenta.
            </p>
          </section>

          {/* Section 10 */}
          <section id="10" className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-slate-900">10. Contacto y Derechos</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Si tiene preguntas, inquietudes o desea ejercer sus derechos de privacidad, contactenos:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
              <p className="text-slate-700 mb-2"><strong>Oficial de Privacidad:</strong></p>
              <p className="text-slate-700 mb-4"><a href="mailto:privacy@computeksa.com" className="text-brand-600 hover:text-brand-700">privacy@computeksa.com</a></p>
              
              <p className="text-slate-700 mb-2"><strong>Soporte General:</strong></p>
              <p className="text-slate-700 mb-4"><a href="mailto:soporte@computeksa.com" className="text-brand-600 hover:text-brand-700">soporte@computeksa.com</a></p>
              
              <p className="text-slate-700 mb-2"><strong>Sitio Web:</strong></p>
              <p className="text-slate-700"><a href="https://computeksa.com" target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700">www.computeksa.com</a></p>
            </div>

            <p className="text-slate-700 mb-4 leading-relaxed">
              <strong>Cambios en esta Política:</strong> Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos de cambios 
              significativos enviando un aviso por correo electrónico o publicando una noticia prominente en el Servicio.
            </p>
            <p className="text-slate-700 leading-relaxed">
              El uso continuado del Servicio después de cambios constituye aceptación de la Política actualizada.
            </p>
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
                <li><a href="mailto:contacto@computeksa.com" className="hover:text-brand-400">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:soporte@computeksa.com" className="hover:text-brand-400">Soporte</a></li>
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

export default PrivacyPolicy;

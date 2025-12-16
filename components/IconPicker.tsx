import React from 'react';

interface IconPickerProps {
  onSelect: (icon: string) => void;
  onClose: () => void;
  socialOnly?: boolean;
}

const icons = [
    // Leads y Prospección
    'fa-solid fa-user-plus',           // Nuevo lead
    'fa-solid fa-users',               // Múltiples leads
    'fa-solid fa-user-check',          // Lead calificado
    'fa-solid fa-user-clock',          // Lead en seguimiento
    'fa-solid fa-bullseye',            // Lead objetivo/target
    'fa-solid fa-filter',              // Filtrar leads
    
    // Ventas y Negociación
    'fa-solid fa-chart-line',          // Crecimiento/ventas
    'fa-solid fa-dollar-sign',         // Precio/dinero
    'fa-solid fa-money-bill-wave',     // Pago/transacción
    'fa-solid fa-coins',               // Presupuesto
    'fa-solid fa-percent',             // Descuento/comisión
    'fa-solid fa-calculator',          // Cálculos/cotización
    
    // Cotizaciones y Documentos
    'fa-solid fa-file-invoice',        // Cotización/factura
    'fa-solid fa-file-invoice-dollar', // Cotización con precio
    'fa-solid fa-receipt',             // Recibo/cotización
    'fa-solid fa-file-contract',       // Contrato
    'fa-solid fa-file-lines',          // Documento
    'fa-solid fa-clipboard-list',      // Lista de items
    
    // Proceso de Ventas
    'fa-solid fa-list-check',          // Checklist/proceso
    'fa-solid fa-arrow-trend-up',      // Progreso positivo
    'fa-solid fa-rocket',              // Lanzamiento/inicio
    'fa-solid fa-fire',                // Lead caliente/urgente
    'fa-solid fa-snowflake',           // Lead frío
    'fa-solid fa-temperature-half',    // Lead tibio
    
    // Estados y Seguimiento
    'fa-solid fa-hourglass-half',      // En proceso
    'fa-solid fa-spinner',             // Procesando
    'fa-solid fa-circle-check',        // Completado
    'fa-solid fa-circle-xmark',        // Rechazado/perdido
    'fa-solid fa-rotate',              // Reciclar/reintentar
    'fa-solid fa-bell',                // Notificación/recordatorio
    
    // Comunicación
    'fa-solid fa-envelope',            // Email
    'fa-solid fa-phone-volume',        // Llamada
    'fa-solid fa-video',               // Videollamada
    'fa-solid fa-message',             // Mensaje/chat
    'fa-solid fa-calendar-days',       // Agendar reunión
    'fa-solid fa-calendar-check',      // Reunión confirmada
    
    // Análisis y Reportes
    'fa-solid fa-chart-pie',           // Estadísticas
    'fa-solid fa-chart-bar',           // Reportes
    'fa-solid fa-ranking-star',        // Ranking/prioridad
    'fa-solid fa-star',                // Favorito/importante
    'fa-solid fa-flag',                // Marcar/señalar
    'fa-solid fa-tags',                // Etiquetas/categorías
  ];

  const socialIcons = [
    // Mensajería Instantánea (Apps de Chat)
    'fa-brands fa-whatsapp',           // WhatsApp
    'fa-brands fa-telegram',           // Telegram
    'fa-brands fa-facebook-messenger', // Facebook Messenger
    'fa-brands fa-viber',              // Viber
    'fa-brands fa-weixin',             // WeChat
    'fa-brands fa-line',               // Line

    // Redes Sociales Principales
    'fa-brands fa-facebook',           // Facebook
    'fa-brands fa-instagram',          // Instagram
    'fa-brands fa-linkedin',           // LinkedIn (Profesional)s
    'fa-brands fa-tiktok',             // TikTok
    'fa-brands fa-youtube',            // YouTube
    'fa-brands fa-pinterest',          // Pinterest
    'fa-brands fa-snapchat',           // Snapchat

    // Telefonía y Contacto Directo (Iconos Sólidos)
    'fa-solid fa-mobile-screen-button', // Celular / Móvil
    'fa-solid fa-phone',               // Teléfono fijo básico
    'fa-solid fa-headset',             // Soporte / Call Center
    'fa-solid fa-comment-sms',         // SMS / Mensaje de texto
    'fa-solid fa-address-book',        // Agenda / Contactos
    'fa-solid fa-globe',               // Sitio Web / WWW
    'fa-solid fa-at',                  // Arroba / Mención

    // Herramientas de Reunión y Trabajo
    'fa-brands fa-skype',              // Skype
    'fa-brands fa-slack',              // Slack
    'fa-brands fa-discord',            // Discord
    'fa-brands fa-google',             // Google Meet (genérico)
    'fa-brands fa-microsoft',          // Microsoft Teams (genérico)
    'fa-solid fa-video',               // Videollamada genérica
];

const IconPicker: React.FC<IconPickerProps> = ({ onSelect, onClose, socialOnly }) => {
  const handleIconClick = (icon: string) => {
    onSelect(icon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">Seleccionar Icono</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {!socialOnly && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Negocio</p>
              <div className="grid grid-cols-6 gap-3">
                {icons.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => handleIconClick(icon)}
                    className="flex items-center justify-center w-12 h-12 text-2xl text-slate-600 bg-slate-100 rounded-lg hover:bg-brand-500 hover:text-white transition-colors"
                    title={icon}
                  >
                    <i className={icon}></i>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Social / Canales</p>
            <div className="grid grid-cols-6 gap-3">
              {socialIcons.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => handleIconClick(icon)}
                  className="flex items-center justify-center w-12 h-12 text-2xl text-slate-600 bg-slate-100 rounded-lg hover:bg-brand-500 hover:text-white transition-colors"
                  title={icon}
                >
                  <i className={icon}></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconPicker;
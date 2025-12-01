import React from 'react';

interface IconPickerProps {
  onSelect: (icon: string) => void;
  onClose: () => void;
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

const IconPicker: React.FC<IconPickerProps> = ({ onSelect, onClose }) => {
  const handleIconClick = (icon: string) => {
    onSelect(icon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b bg-slate-50">
          <h3 className="font-bold text-slate-700">Seleccionar Icono</h3>
        </div>
        <div className="p-6 grid grid-cols-6 gap-4">
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
    </div>
  );
};

export default IconPicker;
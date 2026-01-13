import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

// Mapeo de rutas a nombres legibles
const ROUTE_LABELS: { [key: string]: string } = {
  'app': 'Inicio',
  'dashboard': 'Dashboard',
  'calendar': 'Calendario',
  'quotes': 'Cotizaciones',
  'deals': 'Tratos',
  'financials': 'Cartera',
  'client-companies': 'Empresas',
  'client-contacts': 'Contactos',
  'client-company-detail': 'Detalle',
  'client-contact-detail': 'Detalle',
  'deal-create': 'Nuevo',
  'deal-detail': 'Detalle',
  'quote-create': 'Nueva',
  'quote-detail': 'Detalle',
  'financial-create': 'Nuevo',
  'financial-detail': 'Detalle',
  'products': 'Productos',
  'users': 'Usuarios',
  'settings': 'Ajustes',
  'profile': 'Mi Perfil',
  'marketing': 'Marketing',
  'campaigns': 'Campañas',
  'lists': 'Listas',
  'audiences': 'Audiencias',
};

// Regex para detectar si es un ID (uuid, slug, etc.)
const ID_PATTERN = /^[a-z0-9_-]{10,}$/i;

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Partir pathname en segmentos
  const segments = location.pathname
    .split('/')
    .filter((s) => s && s !== 'app');

  // Acumular breadcrumbs con rutas navegables
  const breadcrumbs = segments.reduce<{ label: string; path: string; isActive: boolean; isId: boolean }[]>(
    (acc, segment, index) => {
      const isId = ID_PATTERN.test(segment);
      const isLast = index === segments.length - 1;
      
      // Acumular ruta desde /app
      const path = '/app/' + segments.slice(0, index + 1).join('/');
      
      // Obtener label del diccionario o usar el segmento como fallback
      let label = ROUTE_LABELS[segment] || segment;
      
      // Si es ID y es el último segmento, intentar usar breadcrumb del state
      if (isId && isLast && location.state?.breadcrumb) {
        label = location.state.breadcrumb;
      } else if (isId) {
        label = 'Detalle';
      }

      acc.push({
        label,
        path,
        isActive: isLast,
        isId,
      });

      return acc;
    },
    []
  );

  // Si no hay segmentos, no renderizar
  if (breadcrumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 mb-4 rounded-lg shadow-sm">
      {/* Botón Atrás */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        title="Atrás"
      >
        <i className="fa-solid fa-chevron-left text-sm"></i>
      </button>

      {/* Breadcrumb Items */}
      <nav className="flex items-center gap-2 flex-1 overflow-x-auto">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && (
              <span className="text-slate-300 text-xs">/</span>
            )}
            {crumb.isActive ? (
              <span className="text-slate-700 font-semibold text-sm truncate">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-slate-500 hover:text-brand-600 text-sm font-medium truncate transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
};

export default Breadcrumb;

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

  // Detectar contexto de acción (nuevo, editar, detalle)
  const queryParams = new URLSearchParams(location.search);
  const isQuoteNew = location.pathname.startsWith('/app/quotes/new');
  // Forzar modo edición si hay id en query, aunque el pathname no cambie
  const quoteEditId = queryParams.get('id');
  const isQuoteEdit = isQuoteNew && !!quoteEditId;
  const isDealNew = location.pathname.startsWith('/app/deals/new');
  const isDealEdit = isDealNew && queryParams.has('id');

  // Construir breadcrumbs jerárquicos
  let breadcrumbs: { label: string; path: string; isActive: boolean }[] = [];
  if (segments[0] === 'quotes') {
    // Cotizaciones
    breadcrumbs.push({ label: 'Cotizaciones', path: '/app/quotes', isActive: false });
    if (isQuoteNew) {
      // Si hay id en query, es edición
      breadcrumbs.push({
        label: isQuoteEdit ? 'Editar Cotización' : 'Nueva Cotización',
        path: location.pathname + location.search,
        isActive: true,
      });
    } else if (segments[1] && (segments[1] === 'new')) {
      breadcrumbs.push({
        label: 'Nueva Cotización',
        path: location.pathname + location.search,
        isActive: true,
      });
    } else if (segments[1] && ID_PATTERN.test(segments[1])) {
      breadcrumbs.push({
        label: location.state?.breadcrumb || 'Detalle Cotización',
        path: location.pathname,
        isActive: true,
      });
    }
  } else if (segments[0] === 'deals') {
    // Tratos
    breadcrumbs.push({ label: 'Tratos', path: '/app/deals', isActive: false });
    if (isDealNew) {
      breadcrumbs.push({
        label: isDealEdit ? 'Editar Trato' : 'Nuevo Trato',
        path: location.pathname + location.search,
        isActive: true,
      });
    } else if (ID_PATTERN.test(segments[1])) {
      // Detalle de trato
      breadcrumbs.push({
        label: location.state?.breadcrumb || 'Detalle Trato',
        path: location.pathname,
        isActive: true,
      });
    }
  } else if (segments[0] === 'financials') {
    // Cartera Financiera
    breadcrumbs.push({ label: 'Cartera Financiera', path: '/app/financials', isActive: false });
    
    if (segments[1] === 'form' && segments[2]) {
      // Ruta de formulario: /app/financials/form/:id
      if (segments[2] === 'new') {
        // Crear nuevo
        breadcrumbs.push({
          label: 'Nueva Transacción',
          path: location.pathname,
          isActive: true,
        });
      } else if (ID_PATTERN.test(segments[2])) {
        // Editar existente - mostrar: Cartera Financiera > [Factura] > Editar
        breadcrumbs.push({
          label: location.state?.breadcrumb || 'Transacción',
          path: `/app/financials/${segments[2]}`,
          isActive: false,
        });
        breadcrumbs.push({
          label: 'Editar',
          path: location.pathname,
          isActive: true,
        });
      }
    } else if (ID_PATTERN.test(segments[1])) {
      // Detalle de transacción: /app/financials/:id
      breadcrumbs.push({
        label: location.state?.breadcrumb || 'Detalle Transacción',
        path: location.pathname,
        isActive: true,
      });
    }
  } else {
    // Otros módulos
    let path = '/app';
    segments.forEach((segment, idx) => {
      path += '/' + segment;
      const isLast = idx === segments.length - 1;
      let label = ROUTE_LABELS[segment] || segment;
      // Si es ID y hay breadcrumb en state
      if (ID_PATTERN.test(segment) && location.state?.breadcrumb) {
        label = location.state.breadcrumb;
      }
      breadcrumbs.push({ label, path, isActive: isLast });
    });
  }

  // Si no hay segmentos, no renderizar

  if (breadcrumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-6 py-5 bg-white border-b border-slate-200 mb-4 rounded-lg shadow-sm">
      {/* Botón Atrás */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
        title="Atrás"
      >
        <i className="fa-solid fa-chevron-left text-lg"></i>
      </button>

      {/* Breadcrumb Items */}
      <nav className="flex items-center gap-2 flex-1 overflow-x-auto">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && (
              <span className="text-slate-300 text-base flex-shrink-0">/</span>
            )}
            {crumb.isActive ? (
              <span className="text-slate-800 font-bold text-lg truncate">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-slate-600 hover:text-brand-600 text-lg font-semibold truncate transition-colors"
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

/**
 * Configuración centralizada de rutas del proyecto
 * Este archivo es la única fuente de verdad para nombres, iconos y rutas
 */

// ============================================
// ESTRUCTURA DE NAVEGACIÓN (para el menú sidebar)
// ============================================
export const NAV_GROUPS = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: 'fa-chart-pie', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Calendario', path: '/app/calendar', icon: 'fa-calendar-days', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Seguimiento', path: '/app/followups', icon: 'fa-rocket', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Cotizaciones', path: '/app/quotes', icon: 'fa-file-invoice-dollar', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Tratos', path: '/app/deals', icon: 'fa-handshake', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Marketing Center', path: '/app/marketing', icon: 'fa-bullseye', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Directorio',
    items: [
      { label: 'Empresas', path: '/app/client-companies', icon: 'fa-building', roles: ['superadmin', 'admin', 'usuario'] },
      { label: 'Contactos', path: '/app/client-contacts', icon: 'fa-address-book', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  },
  {
    title: 'Inventario',
    items: [
      { label: 'Productos', path: '/app/products', icon: 'fa-box-archive', roles: ['superadmin', 'admin', 'usuario'] },
    ]
  }
];

// ============================================
// MAPEO DE RUTAS A NOMBRES LEGIBLES
// Usado en: Layout.tsx (header), Breadcrumb.tsx
// ============================================
export const ROUTE_LABELS: { [key: string]: string } = {
  // General
  'app': 'Inicio',
  'dashboard': 'Dashboard',
  'calendar': 'Calendario',
  
  // Ventas
  'quotes': 'Cotizaciones',
  'deals': 'Tratos',
  'financials': 'Cartera Financiera',
  
  // Marketing
  'marketing': 'Marketing Center',
  'campaigns': 'Campañas',
  'lists': 'Listas',
  'audiences': 'Audiencias',
  
  // Directorio
  'client-companies': 'Empresas Clientes',
  'client-contacts': 'Contactos Clientes',
  'companies': 'Tenants',
  
  // Inventario
  'products': 'Productos',
  'inventory': 'Dashboard Inventario',
  
  // Admin
  'users': 'Usuarios',
  'settings': 'Ajustes',
  'profile': 'Mi Perfil',
};

// ============================================
// MAPEO DE PÁGINAS (usado en header/title)
// Alias de ROUTE_LABELS para compatibilidad
// ============================================
export const PAGE_NAMES = ROUTE_LABELS;

// ============================================
// RUTAS DE APLICACIÓN
// Usado en: App.tsx (React Router)
// ============================================
export const APP_ROUTES = {
  // Public
  PUBLIC: {
    HOME: '/',
    LOGIN: '/login',
    AUTH_CALLBACK: '/auth/callback',
  },
  
  // Protected - General
  APP: '/app',
  DASHBOARD: '/app/dashboard',
  CALENDAR: '/app/calendar',
  PROFILE: '/app/profile',
  
  // Protected - Ventas > Cotizaciones
  QUOTES: {
    LIST: '/app/quotes',
    NEW: '/app/quotes/new',
    DETAIL: (id: string) => `/app/quotes/${id}`,
  },
  
  // Protected - Ventas > Tratos
  DEALS: {
    LIST: '/app/deals',
    NEW: '/app/deals/new',
    DETAIL: (id: string) => `/app/deals/${id}`,
  },
  
  // Protected - Ventas > Cartera Financiera
  FINANCIALS: {
    LIST: '/app/financials',
    NEW: '/app/financials/new',
    EDIT: (id: string) => `/app/financials/edit?id=${id}`,
    DETAIL: (id: string) => `/app/financials/${id}`,
  },
  
  // Protected - Marketing
  MARKETING: {
    CENTER: '/app/marketing',
    DASHBOARD: '/app/marketing/dashboard',
    CAMPAIGNS: '/app/marketing/campaigns',
    CAMPAIGNS_NEW: '/app/marketing/campaigns/new',
    CAMPAIGNS_EDIT: (id: string) => `/app/marketing/campaigns/edit/${id}`,
    CAMPAIGNS_DETAIL: (id: string) => `/app/marketing/campaigns/${id}`,
    LISTS: '/app/marketing/lists',
    LISTS_DETAIL: (id: string) => `/app/marketing/lists/${id}`,
    INTEGRATIONS: '/app/marketing/integrations',
  },
  
  // Protected - Directorio
  CLIENT_COMPANIES: {
    LIST: '/app/client-companies',
    DETAIL: (id: string) => `/app/client-companies/${id}`,
  },
  CLIENT_CONTACTS: {
    LIST: '/app/client-contacts',
    DETAIL: (id: string) => `/app/client-contacts/${id}`,
  },
  
  // Protected - Inventario
  PRODUCTS: {
    LIST: '/app/products',
  },
  
  // Protected - Admin
  USERS: {
    LIST: '/app/users',
  },
  SETTINGS: '/app/settings',
  COMPANIES: {
    LIST: '/app/companies',
  },
};

/**
 * Función helper para obtener el nombre de una ruta
 * @param path - La ruta (ej: '/app/financials')
 * @returns El nombre legible de la ruta
 */
export const getRouteName = (path: string): string => {
  if (!path) return '';
  
  // Extraer el primer segment después de /app/
  const segments = path.split('/').filter(s => s && s !== 'app');
  const firstSegment = segments[0];
  
  return ROUTE_LABELS[firstSegment] || firstSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

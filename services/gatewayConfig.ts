/**
 * Configuración centralizada de URLs del Gateway
 * 
 * Todas las APIs de la aplicación ahora pasan por el Gateway
 * que conecta con la base de datos Postgres
 * 
 * Estructura:
 * - Base: ${VITE_WEBHOOK_URL} (ej: https://gateway.computeksa.com)
 * - Auth: /auth/login
 * - APIs: /api/...
 * 
 * Las URLs se construyen dinámicamente basadas en VITE_WEBHOOK_URL
 */

// URL base desde variables de entorno - REQUERIDO, no usar fallback
if (!import.meta.env.VITE_WEBHOOK_URL) {
  throw new Error('❌ VITE_WEBHOOK_URL no está configurada en las variables de entorno. Por favor, configúrala antes de ejecutar la aplicación.');
}

const BASE_URL = import.meta.env.VITE_WEBHOOK_URL;

/**
 * Helper para construir URLs completas
 */
function buildFullUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export const GATEWAY_CONFIG = {
  // URL base del Gateway
  BASE_URL: BASE_URL,
  
  // Endpoints de autenticación (SIN /api)
  AUTH: {
    LOGIN: buildFullUrl('/auth/login'),
  },
  
  // Endpoints de APIs (CON /api)
  API: {
    // Tenants (Suscripciones SaaS)
    TENANTS: {
      LIST: buildFullUrl('/api/tenants'),
      DETAIL: buildFullUrl('/api/tenants/detail'),
      CREATE: buildFullUrl('/api/tenants'),
      UPDATE: buildFullUrl('/api/tenants/update'),
      DELETE: buildFullUrl('/api/tenants/delete'),
      EMAIL_SETTINGS: buildFullUrl('/api/tenants/email/corporative'),        // Activar con OAuth
      UPDATE_EMAIL_SETTINGS: buildFullUrl('/api/tenants/email/settings'),    // Desactivar toggles
      EMAIL_DELETE: buildFullUrl('/api/tenants/email/corporative/delete'),
    },
    
    // Deals/Tratos
    DEALS: {
      LIST: buildFullUrl('/api/deals'),
      DETAIL: buildFullUrl('/api/deals/detail'),
      CREATE: buildFullUrl('/api/deals'),
      UPDATE: buildFullUrl('/api/v1/deals/update'),
      DELETE: buildFullUrl('/api/deals/delete'),
      ARCHIVED: buildFullUrl('/api/v1/deals/archived'),
      BY_COMPANY: buildFullUrl('/api/deals/by_company'),
      HISTORY: buildFullUrl('/api/deals/history'),
    },
    
    // Quotes/Cotizaciones
    QUOTES: {
      LIST: buildFullUrl('/api/quotes'),
      DETAIL: buildFullUrl('/api/quotes/detail'),
      CREATE: buildFullUrl('/api/quotes'),
      UPDATE: buildFullUrl('/api/quotes/update'),
      DELETE: buildFullUrl('/api/quotes/delete'),
      GENERATE_PDF: buildFullUrl('/api/quotes/generate-pdf'),
      SEND: buildFullUrl('/api/quotes/send'),
      DECISION: buildFullUrl('/api/quotes/decision'),
      UPLOAD_MANUAL: buildFullUrl('/api/quotes/upload-manual'),
      MANUAL_DELETE: buildFullUrl('/api/quotes/manual/delete'),
      ATTACHMENTS_ADD: buildFullUrl('/api/quotes/attachments/add'),
      ATTACHMENTS_REMOVE: buildFullUrl('/api/quotes/attachments/remove'),
    },
    
    // Financials/Transacciones
    FINANCIALS: {
      LIST: buildFullUrl('/api/financials'),
      DETAIL: buildFullUrl('/api/financial/detail'),
      CREATE: buildFullUrl('/api/financials'),
      UPDATE: buildFullUrl('/api/financials/update'),
      DELETE: buildFullUrl('/api/financial/delete'),
      NOTIFY_OVERDUE: buildFullUrl('/api/financials/notify-overdue'),
    },
    
    // Clientes/Companies
    CLIENTS: {
      COMPANIES_LIST: buildFullUrl('/api/clients/companies'),
      COMPANIES_DETAIL: buildFullUrl('/api/clients/companies/detail'),
      COMPANIES_SIZES: buildFullUrl('/api/clients/companies/size'),
      CONTACTS_LIST: buildFullUrl('/api/clients/contacts'),
      CONTACTS_DETAIL: buildFullUrl('/api/clients/contacts/detail'),
      COMPANIES_CONTACTS_DETAIL: buildFullUrl('/api/clients/companies_contacts/detail'),
      CONTACTS_HISTORY: buildFullUrl('/api/clients/contacts/history'),
    },
    
    // Productos
    PRODUCTS: {
      LIST: buildFullUrl('/api/products'),
      TYPES: buildFullUrl('/api/products_type'),
      CREATE: buildFullUrl('/api/products'),
    },
    
    // Estatuses
    STATUSES: {
      DEALS: buildFullUrl('/api/status/deals'),
      QUOTES: buildFullUrl('/api/status/quotes'),
    },
    
    // Usuarios
    USERS: {
      LIST: buildFullUrl('/api/users'),
      ME: buildFullUrl('/api/v1/me'),
      UPDATE_SETTINGS: buildFullUrl('/api/v1/users/me/settings'),
    },
    
    // Eventos
    EVENTS: {
      LIST: buildFullUrl('/api/events'),
      DETAIL: buildFullUrl('/api/events/detail'),
      CREATE: buildFullUrl('/api/events'),
      UPDATE: buildFullUrl('/api/events/update'),
      DELETE: buildFullUrl('/api/events/delete'),
      SYNC: buildFullUrl('/api/calendar/sync'),
    },
    
    // Otros
    PRODUCTS_SELECTED: buildFullUrl('/api/products-selected'),
    QUOTE_ITEMS_UPDATE: buildFullUrl('/api/quote-items/update'),
    QUOTE_ITEMS_DELETE: buildFullUrl('/api/quote-items/delete'),
    INTERACTIONS_CREATE: buildFullUrl('/api/crm/interactions/create'),
    INTERACTIONS_HISTORY: buildFullUrl('/api/crm/interactions/history'),
    LABELS_TENANT: buildFullUrl('/api/clients/companies/labels'),
    CONTACTS_IMPORT: buildFullUrl('/api/crm/contacts/import'),
  }
};

/**
 * Helper para construir URLs con parámetros
 * Ejemplo: buildUrl(GATEWAY_CONFIG.API.DEALS.DETAIL, { id_trato: '123', id_tenant: 'abc' })
 */
export function buildUrl(baseUrl: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }
  
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  
  const queryString = query.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// --- DEALS API WRAPPERS ---
import { apiGet, apiPost } from './apiClient';

export async function getDeals() {
  return apiGet(GATEWAY_CONFIG.API.DEALS.LIST);
}

export async function archiveDeal(id_trato: string) {
  return apiPost(GATEWAY_CONFIG.API.DEALS.ARCHIVED, { id_trato, archivado: true });
}

export async function deleteDeal(id_trato: string, id_tenant: string, id_user: string) {
  return apiPost(GATEWAY_CONFIG.API.DEALS.DELETE, { id_trato, id_tenant, id_user });
}

export async function updateDeal(payload: any) {
  return apiPost(GATEWAY_CONFIG.API.DEALS.UPDATE, payload);
}

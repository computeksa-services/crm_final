/**
 * MARKETING HELPERS - Funciones auxiliares para usar endpoints
 * File: services/marketingHelpers.ts
 */

import { apiFetch } from './apiClient';

const API_BASE = import.meta.env.VITE_WEBHOOK_URL;

// ============================================================
// EMPRESAS (Client Companies)
// ============================================================

export const companiesApi = {
  /**
   * Obtener todas las empresas
   */
  async getAll(idTenant: string): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/clients/companies`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Obtener empresa por ID
   */
  async getById(idClientCompany: string): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/companies/${idClientCompany}`);
    return await response.json();
  },

  /**
   * Crear nueva empresa
   */
  async create(idTenant: string, payload: {
    name_company: string;
    type_client?: string;
    category?: string;
    industry?: string;
    tags?: string[];
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  },

  /**
   * Actualizar empresa
   */
  async update(idClientCompany: string, payload: any): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/companies/${idClientCompany}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  },

  /**
   * Eliminar empresa
   */
  async delete(idClientCompany: string): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/companies/${idClientCompany}`, {
      method: 'DELETE'
    });
    return await response.json();
  }
};

// ============================================================
// CONTACTOS (Client Contacts)
// ============================================================

export const contactsApi = {
  /**
   * Obtener todos los contactos
   */
  async getAll(): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Obtener contacto por ID
   */
  async getById(idContact: string): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts/${idContact}`);
    return await response.json();
  },

  /**
   * Obtener contactos por empresa
   */
  async getByCompany(idClientCompany: string): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts?id_client_company=${idClientCompany}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Crear nuevo contacto
   */
  async create(idTenant: string, payload: {
    id_client_company: string;
    first_name: string;
    last_name: string;
    email: string;
    position?: string;
    city?: string;
    country?: string;
    phone?: string;
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  },

  /**
   * Actualizar contacto
   */
  async update(idContact: string, payload: any): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts/${idContact}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  },

  /**
   * Eliminar contacto
   */
  async delete(idContact: string): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/clients/contacts/${idContact}`, {
      method: 'DELETE'
    });
    return await response.json();
  }
};

// ============================================================
// ETIQUETAS (Tags)
// ============================================================

export const tagsApi = {
  /**
   * Obtener todas las etiquetas
   */
  async getAll(idTenant: string, type?: string): Promise<any[]> {
    let url = `${API_BASE}/api/crm/tags?id_tenant=${idTenant}`;
    if (type) url += `&type=${type}`;
    
    const response = await apiFetch(url);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Obtener etiquetas por tipo
   */
  async getByType(idTenant: string, type: 'company' | 'contact'): Promise<any[]> {
    return this.getAll(idTenant, type);
  },

  /**
   * Crear nueva etiqueta
   */
  async create(idTenant: string, payload: {
    name: string;
    color?: string;
    description?: string;
    type?: 'company' | 'contact';
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/crm/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  },

  /**
   * Actualizar etiqueta
   */
  async update(idTag: string, payload: any): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/crm/tags/${idTag}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  },

  /**
   * Eliminar etiqueta
   */
  async delete(idTag: string): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/crm/tags/${idTag}`, {
      method: 'DELETE'
    });
    return await response.json();
  }
};

// ============================================================
// CATEGORÍAS
// ============================================================

export const categoriesApi = {
  /**
   * Obtener todas las categorías
   */
  async getAll(idTenant: string, type?: string): Promise<any[]> {
    let url = `${API_BASE}/api/crm/categories?id_tenant=${idTenant}`;
    if (type) url += `&type=${type}`;
    
    const response = await apiFetch(url);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Obtener categorías por tipo
   */
  async getByType(idTenant: string, type: string): Promise<any[]> {
    return this.getAll(idTenant, type);
  },

  /**
   * Crear nueva categoría
   */
  async create(idTenant: string, payload: {
    name: string;
    type: string;
    color?: string;
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/crm/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  }
};

// ============================================================
// TIPOS DE CLIENTE
// ============================================================

export const clientTypesApi = {
  /**
   * Obtener todos los tipos de cliente
   */
  async getAll(idTenant: string): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/crm/client-types?id_tenant=${idTenant}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Crear nuevo tipo de cliente
   */
  async create(idTenant: string, payload: {
    name: string;
    description?: string;
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/crm/client-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  }
};

// ============================================================
// MARKETING - HERRAMIENTAS
// ============================================================

export const marketingToolsApi = {
  /**
   * Obtener empresas disponibles para Marketing
   */
  async getCompanies(idTenant: string): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/marketing/tools/companies?id_tenant=${idTenant}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Obtener opciones de filtros (categorías, etiquetas, países, ciudades, industrias)
   */
  async getFilterOptions(idTenant: string): Promise<{
    categories: Array<{value: string; label: string}>;
    tags: Array<{value: string; label: string}>;
    countries: Array<{value: string; label: string}>;
    cities: Array<{value: string; label: string}>;
    industries: Array<{value: string; label: string}>;
  }> {
    const response = await apiFetch(`${API_BASE}/api/marketing/tools/filter-options?id_tenant=${idTenant}`);
    const data = await response.json();
    return {
      categories: data.categories || [],
      tags: data.tags || [],
      countries: data.countries || [],
      cities: data.cities || [],
      industries: data.industries || []
    };
  },

  /**
   * Crear opción de filtro
   */
  async createFilterOption(idTenant: string, payload: {
    type: 'category' | 'tag' | 'country' | 'city' | 'industry';
    value: string;
    label: string;
  }): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/marketing/tools/filter-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        ...payload
      })
    });
    return await response.json();
  }
};

// ============================================================
// MARKETING - BÚSQUEDA DE CONTACTOS (AVANZADA)
// ============================================================

export const marketingContactsApi = {
  /**
   * Búsqueda avanzada de contactos
   */
  async search(
    idTenant: string,
    idUser: string,
    filters: {
      search?: string;
      company_id?: string;
      company_category?: string;
      company_tags?: string[];
      position?: string;
      city?: string;
      country?: string;
      industry?: string;
    }
  ): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/marketing/contacts/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tenant: idTenant,
        id_user: idUser,
        ...filters
      })
    });
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Búsqueda simple (compatibilidad backwards)
   */
  async searchBasic(
    idTenant: string,
    idUser: string,
    search?: string,
    companyId?: string,
    position?: string,
    location?: string
  ): Promise<any[]> {
    return this.search(idTenant, idUser, {
      search,
      company_id: companyId,
      position,
      city: location
    });
  }
};

// ============================================================
// MARKETING - LISTAS
// ============================================================

export const marketingListsApi = {
  /**
   * Obtener miembros de una lista
   */
  async getMembers(idList: string, idUser: string): Promise<any[]> {
    const response = await apiFetch(`${API_BASE}/api/marketing/lists/${idList}/members?id_user=${idUser}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Agregar contactos a lista
   */
  async addMembers(idList: string, idUser: string, contactIds: string[]): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/marketing/lists/${idList}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_user: idUser,
        action: 'add',
        contact_ids: contactIds
      })
    });
    return await response.json();
  },

  /**
   * Remover contactos de lista
   */
  async removeMembers(idList: string, idUser: string, contactIds: string[]): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/marketing/lists/${idList}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_user: idUser,
        action: 'remove',
        contact_ids: contactIds
      })
    });
    return await response.json();
  },

  /**
   * Desuscribir contactos
   */
  async unsubscribeMembers(idList: string, idUser: string, contactIds: string[]): Promise<any> {
    const response = await apiFetch(`${API_BASE}/api/marketing/lists/${idList}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_user: idUser,
        action: 'unsubscribe',
        contact_ids: contactIds
      })
    });
    return await response.json();
  }
};

// ============================================================
// EJEMPLO DE USO
// ============================================================

/*
// En un componente React:

import { 
  companiesApi, 
  tagsApi, 
  clientTypesApi, 
  marketingToolsApi,
  marketingContactsApi 
} from '@/services/marketingHelpers';

async function loadMarketingData() {
  try {
    // Cargar empresas
    const companies = await companiesApi.getAll(tenantId);
    
    // Cargar etiquetas
    const tags = await tagsApi.getAll(tenantId, 'company');
    
    // Cargar tipos de cliente
    const clientTypes = await clientTypesApi.getAll(tenantId);
    
    // Cargar opciones de filtros
    const filterOptions = await marketingToolsApi.getFilterOptions(tenantId);
    
    // Buscar contactos con filtros avanzados
    const contacts = await marketingContactsApi.search(
      tenantId,
      userId,
      {
        search: 'juan',
        company_id: 'cc_001',
        company_category: 'B2B',
        company_tags: ['VIP'],
        city: 'quito',
        country: 'EC'
      }
    );
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}
*/

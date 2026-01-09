import { MarketingList, ListMember, MarketingCampaign } from '../types';

// URL base de tus Webhooks de n8n
const API_BASE = import.meta.env.VITE_WEBHOOK_URL || 'http://localhost:3000';

/**
 * Función de ayuda para normalizar respuestas de n8n
 * A veces n8n devuelve { "sqlPayload": [...] } y a veces el array directo.
 */
const parseResponse = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }
  const text = await response.text();
  if (!text) return null;
  
  const json = JSON.parse(text);
  // Si n8n devuelve una estructura envuelta, tratamos de sacar la data
  if (json.sqlPayload) return json.sqlPayload;
  return json;
};

// ==========================================
// MARKETING API SERVICE
// ==========================================

export const marketingApi = {

  // ------------------------------------------------------------------
  // MÓDULO: AUDIENCIAS (Listas de Difusión)
  // Tabla DB: marketing_lists
  // ------------------------------------------------------------------

  /**
   * Obtener todas las listas visibles para el usuario
   */
  async getLists(id_tenant: string, id_user: string): Promise<MarketingList[]> {
    try {
      // Query Params coinciden con BD: id_tenant, id_user
      const response = await fetch(`${API_BASE}/api/marketing/lists?id_tenant=${id_tenant}&id_user=${id_user}`);
      const data = await parseResponse(response);
      if (!Array.isArray(data)) return [];
      // Normalizamos id_list/list_id para que el frontend siempre tenga ambos
      return data.map((item: any) => ({
        ...item,
        list_id: item.list_id ?? item.id_list,
        id_list: item.id_list ?? item.list_id,
        tenant_id: item.tenant_id ?? item.id_tenant,
      }));
    } catch (error) {
      console.error('❌ Error getLists:', error);
      throw error;
    }
  },

  /**
   * Crear una nueva lista
   */
  async createList(
    id_tenant: string,
    id_user: string,
    payload: { 
      name: string; 
      description?: string; 
      visibility: 'PRIVATE' | 'PUBLIC_TENANT'; 
      type?: 'STATIC' | 'DYNAMIC' 
    }
  ): Promise<MarketingList> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tenant,   // Coincide con columna DB
          id_user,     // Se usará para 'created_by' en SQL
          name: payload.name,
          description: payload.description,
          visibility: payload.visibility,
          type: payload.type || 'STATIC'
        }),
      });
      const data = await parseResponse(response);
      // n8n debe devolver el objeto creado (o un array con 1 objeto)
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error createList:', error);
      throw error;
    }
  },

  /**
   * Actualizar una lista existente
   */
  async updateList(
    id_tenant: string,
    id_user: string, // Para verificar permisos si es necesario
    id_list: string,
    payload: { name?: string; description?: string; visibility?: string; type?: string }
  ): Promise<MarketingList> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/lists`, {
        method: 'PUT', // Asegúrate de configurar PUT en n8n
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tenant,
          id_user,
          id_list,
          ...payload,
        }),
      });
      const data = await parseResponse(response);
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error updateList:', error);
      throw error;
    }
  },

  /**
   * Eliminar una lista
   */
  async deleteList(id_list: string, id_user: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/marketing/lists`, {
        method: 'DELETE', // Asegúrate de configurar DELETE en n8n
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_list, id_user }),
      });
    } catch (error) {
      console.error('❌ Error deleteList:', error);
      throw error;
    }
  },

  /**
   * Obtener detalle de una lista (cabecera)
   */
  async getListDetail(id_list: string, id_user: string, id_tenant: string): Promise<MarketingList> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/lists/detail?id_list=${id_list}&id_user=${id_user}&id_tenant=${id_tenant}`);
      const data = await parseResponse(response);
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error getListDetail:', error);
      throw error;
    }
  },

  // ------------------------------------------------------------------
  // MÓDULO: MIEMBROS (Tabla: marketing_list_members)
  // ------------------------------------------------------------------

  /**
   * Obtener los contactos dentro de una lista
   */
  async getListMembers(id_list: string, id_user: string): Promise<ListMember[]> {
    try {
      // Enviamos id_user para aplicar filtros de seguridad (company_permissions / contact_permissions)
      const response = await fetch(`${API_BASE}/api/marketing/lists/members?id_list=${id_list}&id_user=${id_user}`);
      const data = await parseResponse(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Error getListMembers:', error);
      throw error;
    }
  },

  /**
   * Agregar o Quitar miembros
   */
  async manageListMembers(
    id_list: string,
    contact_ids: string[], // Array de UUIDs de la tabla client_contacts
    action: 'add' | 'remove'
  ): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/marketing/lists/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id_list, 
          contact_ids, // En n8n: jsonb_array_elements_text(p->'contact_ids')
          action 
        }),
      });
    } catch (error) {
      console.error('❌ Error manageListMembers:', error);
      throw error;
    }
  },

  /**
   * Buscar contactos en el CRM para agregar a listas
   * Tabla: client_contacts
   */
  async searchCrmContacts(
    id_tenant: string, 
    id_user: string, 
    filters: { search?: string; company_id?: string; position?: string; location?: string }
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        id_tenant,
        id_user,
        search: filters.search || '',
        company_id: filters.company_id || '',
        position: filters.position || '',
        location: filters.location || ''
      });

      const response = await fetch(`${API_BASE}/api/marketing/contacts/search?${params.toString()}`);
      const data = await parseResponse(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Error searchCrmContacts:', error);
      return [];
    }
  },

  // ------------------------------------------------------------------
  // MÓDULO: CAMPAÑAS (Tabla: marketing_campaigns)
  // ------------------------------------------------------------------

  /**
   * Listar historial de campañas
   */
  async getCampaigns(id_tenant: string): Promise<MarketingCampaign[]> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/campaigns?id_tenant=${id_tenant}`);
      const data = await parseResponse(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Error getCampaigns:', error);
      throw error;
    }
  },

  /**
   * Obtener detalle completo para edición (incluye HTML pesado)
   */
  async getCampaignDetail(id_campaign: string): Promise<MarketingCampaign> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/campaigns/detail?id_campaign=${id_campaign}`);
      const data = await parseResponse(response);
      // Retornar el objeto directo
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error getCampaignDetail:', error);
      throw error;
    }
  },

  /**
   * Guardar o Actualizar Campaña (Upsert)
   */
  async saveCampaign(
    id_tenant: string,
    id_user: string,
    payload: {
      id_campaign?: string | null; // Si es null, crea nueva
      name: string;
      subject: string;
      html_content: string;
      target_lists: string[]; // Array de id_list
      sender_type: 'USER' | 'TENANT'; // Coincide con BD check constraint
      attachments?: any[]; 
    }
  ): Promise<MarketingCampaign> {
    try {
      const response = await fetch(`${API_BASE}/api/marketing/campaigns/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_tenant,
          id_user, // Se usa para 'created_by'
          ...payload
        }),
      });
      const data = await parseResponse(response);
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error saveCampaign:', error);
      throw error;
    }
  },

  /**
   * Eliminar campaña (solo si está en DRAFT)
   */
  async deleteCampaign(id_campaign: string, id_user: string): Promise<void> {
    try {
      // Usamos POST para delete si así lo configuraste, o DELETE
      await fetch(`${API_BASE}/api/marketing/campaigns/delete`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_campaign, id_user }),
      });
    } catch (error) {
      console.error('❌ Error deleteCampaign:', error);
      throw error;
    }
  },

  /**
   * Lanzar campaña (Activar envío)
   */
  async launchCampaign(id_campaign: string, id_user: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/marketing/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_campaign, id_user }),
      });
    } catch (error) {
      console.error('❌ Error launchCampaign:', error);
      throw error;
    }
  },
};
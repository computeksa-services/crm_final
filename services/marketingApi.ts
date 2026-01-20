import { MarketingList, ListMember, MarketingCampaign } from '../types';
import { apiFetch } from './apiClient';

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
      const response = await apiFetch(`${API_BASE}/api/marketing/lists?id_tenant=${id_tenant}&id_user=${id_user}`);
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
      const response = await apiFetch(`${API_BASE}/api/marketing/lists`, {
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
      const response = await apiFetch(`${API_BASE}/api/marketing/lists`, {
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
   * Eliminar una lista (nuevo endpoint)
   */
  async deleteList(id_list: string, id_tenant: string, id_user: string): Promise<void> {
    try {
      await apiFetch(`${API_BASE}/api/marketing/lists/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_list, id_tenant, id_user }),
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
      const response = await apiFetch(`${API_BASE}/api/marketing/lists/detail?id_list=${id_list}&id_user=${id_user}&id_tenant=${id_tenant}`);
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
      const response = await apiFetch(`${API_BASE}/api/marketing/lists/members?id_list=${id_list}&id_user=${id_user}`);
      const data = await parseResponse(response);
      if (!Array.isArray(data)) return [];

      // Algunos flujos devuelven [{ success: true }] cuando la lista está vacía.
      const normalized = data.filter((item: any) => {
        if (item && item.success === true && Object.keys(item).length === 1) return false;
        // Mantener solo registros con algún identificador o email
        return Boolean(item?.id_member || item?.email || item?.full_name || item?.first_name || item?.last_name);
      });

      return normalized;
    } catch (error) {
      console.error('❌ Error getListMembers:', error);
      throw error;
    }
  },

  /**
   * Gestionar miembros de la lista
   * Acciones:
   * - 'add': Agrega nuevos O reactiva (resuscribe) a los que se dieron de baja.
   * - 'remove': Elimina la fila de la base de datos (borrón y cuenta nueva).
   * - 'unsubscribe': Marca como desuscrito (mantiene historial, bloquea envíos).
   */
  async manageListMembers(
    id_list: string,
    contact_ids: string[], 
    action: 'add' | 'remove' | 'unsubscribe'
  ): Promise<void> {
    try {
      if (!id_list) throw new Error('id_list is required');
      if (!contact_ids || contact_ids.length === 0) {
        console.warn('⚠️ No contact_ids provided to manageListMembers');
        return;
      }

      const payload = { 
        id_list,
        contact_ids,
        action 
      };

      console.log('📤 Enviando payload a manageListMembers:', payload);

      const response = await apiFetch(`${API_BASE}/api/marketing/lists/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Error managing members (${action}):`, error);
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

      const response = await apiFetch(`${API_BASE}/api/marketing/contacts/search?${params.toString()}`);
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
  async getCampaigns(id_tenant: string, id_user: string): Promise<MarketingCampaign[]> {
    try {
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns?id_tenant=${encodeURIComponent(id_tenant)}&id_user=${encodeURIComponent(id_user)}`);
      const data = await parseResponse(response);
      if (!Array.isArray(data)) return [];
      // Filtrar respuestas vacías: {success: true} sin campos de campaña
      return data.filter(item => item.id_campaign || item.name || item.id);
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
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns/detail?id_campaign=${id_campaign}`);
      const data = await parseResponse(response);
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error getCampaignDetail:', error);
      throw error;
    }
  },

  /**
   * Gestionar campañas (crear, actualizar, eliminar)
   */
  async manageCampaign(
    action: 'create' | 'update' | 'delete' | 'duplicate' ,
    payload: {
      id_tenant: string;
      id_user: string;
      id_campaign?: string;
      name?: string;
      subject?: string;
      preview_text?: string;
      html_content?: string;
      sender_type?: 'USER' | 'TENANT';
      sender_name?: string;
      sender_email?: string;
      target_lists?: string[];
      attachments?: any[];
      schedule_at?: string;
      schedule_timezone?: string;
    }
  ): Promise<MarketingCampaign | void> {
    try {
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await parseResponse(response);
      if (action === 'delete') return;
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error(`❌ Error manageCampaign (${action}):`, error);
      throw error;
    }
  },

  /**
   * Duplicar campaña: backend requiere { id_campaign, id_tenant, id_user, action: 'duplicate' }
   */
  async duplicateCampaign(
    id_campaign: string,
    id_tenant: string,
    id_user: string
  ): Promise<MarketingCampaign> {
    try {
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id_campaign, id_tenant, id_user }),
      });
      const data = await parseResponse(response);
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('❌ Error duplicateCampaign:', error);
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
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns/save`, {
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
      await apiFetch(`${API_BASE}/api/marketing/campaigns/delete`, {
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
      await apiFetch(`${API_BASE}/api/marketing/campaigns/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_campaign, id_user }),
      });
    } catch (error) {
      console.error('❌ Error launchCampaign:', error);
      throw error;
    }
  },

  /**
   * Control de campaña en curso: enviar, pausar, reanudar
   * El backend debe recibir { id_campaign, id_tenant, id_user, action }
   */
  async campaignAction(payload: {
    id_campaign: string;
    id_tenant: string;
    id_user: string;
    action: 'send' | 'pause' | 'resume';
  }): Promise<void> {
    const { id_campaign, id_tenant, id_user, action } = payload;
    try {
      const response = await apiFetch(`${API_BASE}/api/marketing/campaigns/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_campaign, id_tenant, id_user, action }),
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt}`);
      }
    } catch (error) {
      console.error('❌ Error campaignAction:', error);
      throw error;
    }
  },
};
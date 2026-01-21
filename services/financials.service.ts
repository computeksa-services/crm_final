import { apiFetch } from './apiClient';

const API_URL = import.meta.env.VITE_WEBHOOK_URL;

export const financialService = {
  // Método GET con query params (Gateway extrae id_tenant/id_user del token)
  getAll: async (tenantId: string, params: { start?: string; end?: string; include_open?: boolean }) => {
    const query = new URLSearchParams({
      start_date: params.start || '',
      end_date: params.end || '',
      include_open: String(params.include_open || false) 
    }).toString();
    
    const res = await apiFetch(`${API_URL}/api/financials?${query}`);
    if (!res.ok) throw new Error('Error al cargar transacciones');
    return res.json();
 },

  getById: async (transactionId: string, tenantId: string) => {
    const res = await apiFetch(`${API_URL}/api/financial/detail?id_transaction=${transactionId}&id_tenant=${tenantId}`);
    if (!res.ok) throw new Error('Error al cargar detalle');
    return res.json();
  },

  create: async (payload: any) => {
    const res = await apiFetch(`${API_URL}/api/financials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al crear transacción');
    return res.json();
  },

  update: async (payload: any) => {
    const res = await apiFetch(`${API_URL}/api/financials/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al actualizar transacción');
    return res.json();
  },

  delete: async (transactionId: string, tenantId: string, userId: string) => {
    const res = await apiFetch(`${API_URL}/api/financial/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_transaction: transactionId, id_tenant: tenantId, id_user: userId })
    });
    if (!res.ok) throw new Error('Error al eliminar');
    return res.json();
  },

  

  notifyOverdue: async (payload: any) => {
    const res = await apiFetch(`${API_URL}/api/financials/notify-overdue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al enviar notificación');
    return res.json();
  }
};

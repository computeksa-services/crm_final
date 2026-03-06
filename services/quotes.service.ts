import { apiFetch } from './apiClient';
import { WinningQuoteSelection } from '../types';

const API_URL = import.meta.env.VITE_WEBHOOK_URL;

export const quotesService = {
  /**
   * Marca una cotización como ganadora y rechaza las demás del mismo trato
   * @param selection - Datos de la cotización ganadora y las rechazadas
   */
  markWinningQuote: async (selection: WinningQuoteSelection) => {
    // Simplificar payload: el backend puede buscar las otras cotizaciones
    const payload = {
      id_trato: selection.id_trato,
      id_cotizacion_ganadora: selection.id_cotizacion_ganadora,
      crear_en_cartera: selection.crear_en_cartera || false,
    };
    
    console.log('📤 POST /api/quotes/mark-winner with payload:', payload);
    
    const res = await apiFetch(`${API_URL}/api/quotes/mark-winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Backend error response:', errorText);
      throw new Error(`Error al marcar cotización ganadora: ${res.status} ${res.statusText}`);
    }
    
    const result = await res.json();
    console.log('✅ Cotización marcada ganadora:', result);
    return result;
  },
};

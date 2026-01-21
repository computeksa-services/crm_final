import { authService } from './authService';
import { GATEWAY_CONFIG } from './gatewayConfig';

/**
 * Cliente HTTP con interceptor para agregar el token de autorización
 * automáticamente a todas las peticiones
 * 
 * Todas las peticiones al Gateway deben incluir:
 * Authorization: Bearer [appToken]
 * 
 * El appToken se obtiene en el login intercambiando el OAuth Token
 * por un JWT emitido por el Gateway
 */

interface FetchOptions extends RequestInit {
  headers?: HeadersInit;
}

/**
 * Wrapper de fetch que automáticamente agrega el token de autorización
 * a todas las peticiones
 */
export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const token = authService.getToken();
  
  // Debug: Verificar si el token está disponible


  
  // Preparar headers
  const headers = new Headers(options.headers || {});
  
  // Agregar token de autorización si existe
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);

  } else {
  }
  
  // ⚠️ IMPORTANTE: Solo establecer Content-Type si:
  // 1. Hay un body (NO es undefined, null, o empty string)
  // 2. No hay Content-Type previamente establecido
  // 3. El body NO es FormData (FormData debe usar multipart/form-data automáticamente)
  if (options.body && !headers.has('Content-Type')) {
    // Si el body es FormData, NO establecer Content-Type
    // (el navegador lo hará automáticamente como multipart/form-data)
    // Si el body es string JSON (no vacío), establecer application/json
    if (!(options.body instanceof FormData) && options.body !== '') {
      headers.set('Content-Type', 'application/json');
    }
  }
  
  // Realizar la petición
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Si recibimos 401 (No autorizado), limpiar el token y redirigir al login
  if (response.status === 401) {
    authService.removeToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  
  return response;
}

/**
 * Helper para peticiones GET con el token
 */
export async function apiGet(url: string): Promise<Response> {
  return apiFetch(url, { method: 'GET' });
}

/**
 * Helper para peticiones POST con el token
 */
export async function apiPost(url: string, body: any): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Helper para peticiones PUT con el token
 */
export async function apiPut(url: string, body: any): Promise<Response> {
  return apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Helper para peticiones DELETE con el token
 */
export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' });
}

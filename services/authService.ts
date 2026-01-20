import { GATEWAY_CONFIG } from './gatewayConfig';

// Exportar URL base para compatibilidad - Requiere VITE_WEBHOOK_URL en variables de entorno
if (!import.meta.env.VITE_WEBHOOK_URL) {
  throw new Error('❌ VITE_WEBHOOK_URL no está configurada en las variables de entorno. Por favor, configúrala antes de ejecutar la aplicación.');
}

export const GATEWAY_URL = import.meta.env.VITE_WEBHOOK_URL;

interface LoginResponse {
  token: string;
  user?: any;
}

/**
 * Servicio para gestionar la autenticación con el Gateway
 * 
 * El Gateway es responsable de:
 * 1. Validar el token OAuth de Google/Microsoft
 * 2. Emitir un appToken (JWT) para nuestra aplicación
 * 3. DEVOLVER LOS DATOS DEL USUARIO (sin necesidad de peticiones adicionales)
 * 
 * ⚠️ NOTA: El Gateway devuelve el usuario con una estructura DIFERENTE
 * que debe ser MAPEADA a la estructura interna de la App:
 * 
 * Estructura del Gateway (entrada):
 * {
 *   "token": "JWT_STRING",
 *   "user": {
 *     "id": "user_id",           ← Gateway usa "id"
 *     "tenantId": "tenant_id",   ← Gateway usa "tenantId"
 *     "name": "Full Name",       ← Gateway usa "name"
 *     "email": "user@example.com", ← Gateway usa "email"
 *     "role": "admin",           ← Gateway usa "role"
 *     "avatar": "https://..."    ← Gateway usa "avatar"
 *   }
 * }
 * 
 * Mapeo a estructura interna (salida):
 * {
 *   "id_user": "...",      ← Mapeado desde "id"
 *   "id_tenant": "...",    ← Mapeado desde "tenantId"
 *   "name_user": "...",    ← Mapeado desde "name"
 *   "email_user": "...",   ← Mapeado desde "email"
 *   "rol_user": "...",     ← Mapeado desde "role"
 *   "avatar_url": "...",   ← Mapeado desde "avatar"
 *   ... campos adicionales con valores por defecto
 * }
 */
export const authService = {
  /**
   * Intercambia el token de OAuth (Google/Microsoft) por un appToken del Gateway
   * 
   * POST ${VITE_WEBHOOK_URL}/auth/login
   * Body: { "token": "[OAuth Token]", "provider": "google" | "microsoft" }
   * 
   * Response (del Gateway):
   * {
   *   "token": "[appToken]",
   *   "user": {
   *     "id": "user_id",
   *     "tenantId": "tenant_id",
   *     "name": "Full Name",
   *     "email": "user@example.com",
   *     "role": "admin",
   *     "avatar": "https://..."
   *   }
   * }
   * 
   * ✅ LoginPage se encarga de MAPEAR esta estructura a la estructura interna
   * ✅ Ya NO necesita peticiones adicionales para cargar datos del usuario
   */
  async exchangeToken(oauthToken: string, provider: 'google' | 'microsoft'): Promise<string> {
    try {
      // URL: ${VITE_WEBHOOK_URL}/auth/login (sin /api)
      const loginUrl = `${GATEWAY_URL}/auth/login`;
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: oauthToken,
          provider: provider, // Exactamente 'google' o 'microsoft'
        }),
      });

      // 🔐 VERIFICACIÓN CRÍTICA: Manejar errores del Gateway
      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        
        // Errores específicos que indican que el usuario no está autorizado
        if (statusCode === 403) {
          throw new Error('Tu cuenta no está autorizada para acceder a esta aplicación');
        }
        if (statusCode === 401) {
          throw new Error('Las credenciales proporcionadas no son válidas');
        }
        
        // Error genérico para otros casos
        throw new Error(`Error del Gateway (${statusCode}): ${errorText || 'No autorizado'}`);
      }

      const data: LoginResponse = await response.json();
      
      if (!data.token) {
        throw new Error('El Gateway no devolvió un token válido');
      }

      return data.token;
    } catch (error: any) {
      console.error('❌ Error al intercambiar token con Gateway:', error);
      throw error;
    }
  },

  /**
   * Guarda el appToken en localStorage
   */
  saveToken(token: string): void {
    localStorage.setItem('appToken', token);
  },

  /**
   * Obtiene el appToken de localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('appToken');
  },

  /**
   * Elimina el appToken de localStorage
   */
  removeToken(): void {
    localStorage.removeItem('appToken');
  },
};

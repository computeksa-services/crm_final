/**
 * Helper reutilizable para manejar respuestas del API
 * Extrae el mensaje exacto del backend (éxito o error)
 */

interface ApiResponse {
  message?: string;
  description?: string;
  error?: {
    description?: string;
    message?: string;
    [key: string]: any;
  };
  data?: any;
  [key: string]: any;
}

/**
 * Busca recursivamente un mensaje en una estructura anidada
 */
const findMessageRecursive = (obj: any, depth: number = 0): string | null => {
  if (!obj || depth > 10) return null; // Límite de profundidad
  
  // Si es array, buscar en cada elemento
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findMessageRecursive(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  
  // Si no es objeto, retornar null
  if (typeof obj !== 'object') return null;
  
  // Buscar en el nivel actual
  if (obj.error?.description) return obj.error.description;
  if (obj.error?.message) return obj.error.message;
  if (obj.description) return obj.description;
  if (obj.message) return obj.message;
  
  // Buscar recursivamente en todas las propiedades
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const found = findMessageRecursive(obj[key], depth + 1);
      if (found) return found;
    }
  }
  
  return null;
};

export const handleApiResponse = async (
  response: Response,
  defaultSuccessMessage: string,
  defaultErrorMessage: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    // Leer texto bruto para log y luego parsear JSON
    const rawText = await response.clone().text().catch(() => '');
    let rawData: any = {};

    try {
      rawData = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      rawData = {};
    }
    
    // 🔍 LOG COMPLETO PARA DEBUG
    console.group('🔍 API Response Debug');
    console.log('Status:', response.status);
    console.log('OK:', response.ok);
    console.log('Raw Text:', rawText);
    console.log('Raw Data (parsed):', JSON.stringify(rawData, null, 2));
    
    // Buscar mensaje recursivamente en toda la estructura
    const extractedMessage = findMessageRecursive(rawData);
    
    console.log('💬 Mensaje extraído:', extractedMessage);
    console.log('✅ Mensaje final a mostrar:', extractedMessage || (response.ok ? defaultSuccessMessage : defaultErrorMessage));
    console.groupEnd();
    
    if (response.ok) {
      // Éxito: usar mensaje del backend o el default
      return {
        success: true,
        message: extractedMessage || defaultSuccessMessage,
        data: rawData?.data || rawData
      };
    } else {
      // Error: usar mensaje del backend o el default
      return {
        success: false,
        message: extractedMessage || defaultErrorMessage,
        data: null
      };
    }
  } catch (error) {
    console.error('❌ Error parseando respuesta:', error);
    // Error al parsear JSON
    return {
      success: false,
      message: response.ok ? defaultSuccessMessage : defaultErrorMessage,
      data: null
    };
  }
};

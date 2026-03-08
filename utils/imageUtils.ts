/**
 * Utilidades para manejo de imágenes en el CRM
 */

const failedAvatarUrls = new Map<string, number>();
const avatarPreloadCache = new Map<string, Promise<boolean>>();
const FAILED_AVATAR_TTL_MS = 10 * 60 * 1000;

/**
 * Convierte URLs de Google Drive al formato directo para mostrar imágenes
 * @param url - URL de la imagen (Google Drive, Google Avatar, o cualquier URL)
 * @returns URL en formato correcto para usar en <img> src, o null si no hay URL
 */
export const getImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  
  // Si es URL de avatar de Google (lh3.googleusercontent.com), devolverla tal cual
  if (url.includes('lh3.googleusercontent.com') || url.includes('googleusercontent.com')) {
    return url;
  }
  
  // Si es URL de Google Drive, convertirla al formato thumbnail
  if (url.includes('drive.google.com')) {
    // Extraer FILE_ID de diferentes formatos de URL de Google Drive
    let fileId = null;
    
    // Formato: https://drive.google.com/uc?export=view&id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    } else {
      // Formato: https://drive.google.com/file/d/FILE_ID/view
      const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      } else {
        // Cualquier otro formato, intentar extraer ID de 33-44 caracteres
        const generalMatch = url.match(/[-\w]{25,}/);
        if (generalMatch) {
          fileId = generalMatch[0];
        }
      }
    }
    
    if (fileId) {
      // Usar el thumbnail service de Google Drive con tamaño grande
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
  }
  
  // Si es cualquier otra URL, devolverla tal cual
  return url;
};

/**
 * Devuelve iniciales limpias para usar en avatares locales.
 */
export const getInitialsFromName = (name: string | undefined | null): string => {
  const safeName = (name || 'Usuario').trim();
  if (!safeName) return 'U';
  const parts = safeName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

/**
 * Genera un avatar SVG local (data URI) para evitar dependencias externas.
 */
export const getLocalAvatarDataUrl = (name: string | undefined | null): string => {
  const initials = getInitialsFromName(name);
  const bg = '#6366f1';
  const color = '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${color}" font-family="Arial, sans-serif" font-size="52" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Marca un avatar remoto como fallido para no reintentarlo en bucle.
 */
export const markAvatarUrlAsFailed = (url: string | undefined | null): void => {
  if (!url) return;
  failedAvatarUrls.set(url, Date.now() + FAILED_AVATAR_TTL_MS);
};

/**
 * Indica si una URL ya falló en esta sesión.
 */
export const isAvatarUrlKnownFailed = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const expiresAt = failedAvatarUrls.get(url);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    failedAvatarUrls.delete(url);
    return false;
  }
  return true;
};

/**
 * Limpia la marca de fallo de un avatar para permitir reintentos inmediatos.
 */
export const clearFailedAvatarUrl = (url: string | undefined | null): void => {
  if (!url) return;
  failedAvatarUrls.delete(url);
};

/**
 * Precarga un avatar remoto una vez por sesión para suavizar la primera renderización.
 */
export const preloadAvatarUrl = async (url: string | undefined | null): Promise<boolean> => {
  const normalized = getImageUrl(url);
  if (!normalized) return false;
  if (isAvatarUrlKnownFailed(normalized)) return false;
  if (avatarPreloadCache.has(normalized)) {
    return avatarPreloadCache.get(normalized)!;
  }

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(true);
    img.onerror = () => {
      markAvatarUrlAsFailed(normalized);
      resolve(false);
    };
    img.src = normalized;
  });

  avatarPreloadCache.set(normalized, promise);
  return promise;
};

/**
 * Valida si un archivo es una imagen válida
 * @param file - Archivo a validar
 * @returns true si es una imagen válida
 */
export const isValidImageFile = (file: File): boolean => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  return validTypes.includes(file.type);
};

/**
 * Valida el tamaño de un archivo
 * @param file - Archivo a validar
 * @param maxSizeMB - Tamaño máximo en MB (default: 5MB)
 * @returns true si el tamaño es válido
 */
export const isValidFileSize = (file: File, maxSizeMB: number = 5): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Formatea el tamaño de un archivo a una cadena legible
 * @param bytes - Tamaño en bytes
 * @returns Cadena formateada (ej: "2.5 MB", "150 KB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

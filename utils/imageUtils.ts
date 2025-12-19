/**
 * Utilidades para manejo de imágenes en el CRM
 */

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
    // Extraer FILE_ID de cualquier formato de URL de Google Drive
    const match = url.match(/[-\w]{25,}/);
    
    if (match) {
      const fileId = match[0];
      // Usar el thumbnail service de Google Drive con tamaño grande
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
  }
  
  // Si es cualquier otra URL, devolverla tal cual
  return url;
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

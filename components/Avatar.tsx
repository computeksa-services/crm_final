import React, { useState } from 'react';
import { getImageUrl } from '../utils/imageUtils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineIndicator?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  size = 'md', 
  className = '',
  showOnlineIndicator = false 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Generar initiales del nombre
  const getInitials = (fullName: string) => {
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  // URL de fallback usando UI Avatars
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`;

  // Convertir la URL a formato correcto (ej: Google Drive)
  const imageUrl = getImageUrl(src);

  // Si hay error de imagen o no hay src, mostrar fallback
  const shouldShowFallback = !imageUrl || imageError;

  const handleImageError = () => {

    setImageError(true);
  };

  const handleImageLoad = () => {

    setImageLoaded(true);
  };

  return (
    <div className={`relative inline-block ${sizeClasses[size]} ${className}`}>
      {shouldShowFallback ? (
        // Fallback: usar el servicio UI Avatars
        <img
          src={fallbackUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        // Intentar cargar la imagen original
        <>
          <img
            src={imageUrl || fallbackUrl}
            alt={name}
            className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          {/* Mostrar spinner mientras carga */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200 rounded-full">
              <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-xs"></i>
            </div>
          )}
        </>
      )}
      
      {/* Indicador online */}
      {showOnlineIndicator && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
      )}
    </div>
  );
};

export default Avatar;

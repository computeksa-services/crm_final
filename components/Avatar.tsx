import React, { useState, useMemo } from 'react';
import { getImageUrl } from '../utils/imageUtils';
import { BrandSpinner } from './AppLoaders';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineIndicator?: boolean;
  loading?: 'lazy' | 'eager';
  badge?: {
    type: 'OWNER' | 'EDIT' | 'VIEW';
    accessLevel?: string;
  };
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
} as const;

const badgeConfig = {
  OWNER: {
    bg: 'bg-amber-400',
    icon: 'fa-star',
    label: 'Creador'
  },
  EDIT: {
    bg: 'bg-indigo-500',
    icon: 'fa-crown',
    label: 'Principal'
  },
  VIEW: {
    bg: 'bg-slate-400',
    icon: 'fa-eye',
    label: 'Secundario'
  }
} as const;

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  size = 'md', 
  className = '',
  showOnlineIndicator = false,
  loading = 'lazy',
  badge = undefined
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Memoizar URL para evitar recálculos innecesarios
  const imageUrl = useMemo(() => getImageUrl(src), [src]);
  const fallbackUrl = useMemo(
    () => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`,
    [name]
  );

  const shouldShowFallback = !imageUrl || imageError;

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const badgeType = badge?.type;
  const badgeInfo = badgeType ? badgeConfig[badgeType] : null;

  return (
    <div className={`relative inline-block ${sizeClasses[size]} ${className}`} style={{background: 'none', border: 'none', boxShadow: 'none'}}>
      {shouldShowFallback ? (
        <img
          src={fallbackUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          loading={loading}
          decoding="async"
          crossOrigin="anonymous"
        />
      ) : (
        <>
          <img
            src={imageUrl || fallbackUrl}
            alt={name}
            className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading={loading}
            decoding="async"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-400 rounded-full">
              <BrandSpinner size="xs" />
            </div>
          )}
        </>
      )}
      
      {/* Indicador online - esquina inferior derecha */}
      {showOnlineIndicator && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-500 rounded-full pointer-events-none"></span>
      )}

      {/* Badge de colaborador - esquina inferior derecha con z-index */}
      {badgeInfo && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${badgeInfo.bg} rounded-full flex items-center justify-center shadow-sm pointer-events-none z-10`}>
          <i className={`fa-solid ${badgeInfo.icon} text-white text-[6px]`}></i>
        </div>
      )}
    </div>
  );
};

export default React.memo(Avatar);

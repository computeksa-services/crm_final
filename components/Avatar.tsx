import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  getImageUrl,
  getLocalAvatarDataUrl,
  isAvatarUrlKnownFailed,
  markAvatarUrlAsFailed,
  clearFailedAvatarUrl,
} from '../utils/imageUtils';
import { BrandSpinner } from './AppLoaders';

const loadedAvatarUrls = new Set<string>();

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineIndicator?: boolean;
  loading?: 'lazy' | 'eager';
  badgeInset?: boolean;
  enableHoverZoom?: boolean;
  hoverScale?: number;
  showTooltip?: boolean;
  tooltipRole?: string;
  tooltipPosition?: 'top' | 'bottom';
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

const badgeSizeClasses = {
  xs: { floating: '-bottom-0.5 -right-0.5 w-3 h-3', inset: 'bottom-0 right-0 w-2.5 h-2.5', icon: 'text-[5px]' },
  sm: { floating: '-bottom-0.5 -right-0.5 w-3.5 h-3.5', inset: 'bottom-0 right-0 w-3 h-3', icon: 'text-[6px]' },
  md: { floating: '-bottom-0.5 -right-0.5 w-4 h-4', inset: 'bottom-0 right-0 w-3.5 h-3.5', icon: 'text-[7px]' },
  lg: { floating: '-bottom-0.5 -right-0.5 w-[18px] h-[18px]', inset: 'bottom-0 right-0 w-4 h-4', icon: 'text-[7px]' },
  xl: { floating: '-bottom-0.5 -right-0.5 w-[22px] h-[22px]', inset: 'bottom-0 right-0 w-[18px] h-[18px]', icon: 'text-[9px]' },
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
  badgeInset = false,
  enableHoverZoom = false,
  hoverScale = 1.12,
  showTooltip = false,
  tooltipRole,
  tooltipPosition = 'bottom',
  badge = undefined
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);

  // Memoizar URL para evitar recálculos innecesarios
  const imageUrl = useMemo(() => getImageUrl(src), [src]);
  const fallbackUrl = useMemo(() => getLocalAvatarDataUrl(name), [name]);
  const effectiveImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    if (isAvatarUrlKnownFailed(imageUrl)) return null;
    return imageUrl;
  }, [imageUrl]);
  const wasLoadedBefore = useMemo(
    () => (effectiveImageUrl ? loadedAvatarUrls.has(effectiveImageUrl) : false),
    [effectiveImageUrl]
  );

  const shouldShowFallback = !effectiveImageUrl || imageError;

  useEffect(() => {
    setImageError(false);
    setImageLoaded(wasLoadedBefore);
  }, [effectiveImageUrl, wasLoadedBefore]);

  useEffect(() => {
    if (!effectiveImageUrl || imageLoaded || imageError) return;
    const timeoutId = window.setTimeout(() => {
      // Safety net: avoid infinite spinner when remote providers hang/rate-limit.
      setImageError(true);
    }, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [effectiveImageUrl, imageLoaded, imageError]);

  const handleImageError = () => {
    markAvatarUrlAsFailed(effectiveImageUrl);
    setImageError(true);
  };

  const handleImageLoad = () => {
    clearFailedAvatarUrl(effectiveImageUrl);
    if (effectiveImageUrl) {
      loadedAvatarUrls.add(effectiveImageUrl);
    }
    setImageLoaded(true);
  };

  const badgeType = badge?.type;
  const badgeInfo = badgeType ? badgeConfig[badgeType] : null;
  const badgeSize = badgeSizeClasses[size];
  const roleLabel = tooltipRole || badgeInfo?.label || '';
  const roleColorClass = badgeType === 'OWNER' ? 'text-amber-300' : badgeType === 'EDIT' ? 'text-indigo-300' : 'text-slate-300';

  const updateTooltipPosition = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const left = rect.left + rect.width / 2;
    const offset = 6;

    if (tooltipPosition === 'top') {
      setTooltipStyle({
        position: 'fixed',
        left,
        top: rect.top - offset,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
      });
      return;
    }

    setTooltipStyle({
      position: 'fixed',
      left,
      top: rect.bottom + offset,
      transform: 'translateX(-50%)',
      zIndex: 9999,
    });
  }, [tooltipPosition]);

  useEffect(() => {
    if (!showTooltip || !isHovered) return;

    updateTooltipPosition();

    const onViewportChange = () => updateTooltipPosition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [showTooltip, isHovered, updateTooltipPosition]);

  return (
    <div
      ref={rootRef}
      className={`relative inline-block ${sizeClasses[size]} ${className}`}
      style={{ background: 'none', border: 'none', boxShadow: 'none' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`${enableHoverZoom ? 'relative w-full h-full transition-transform duration-200 will-change-transform origin-center' : 'relative w-full h-full'}`}
        style={enableHoverZoom && isHovered ? { transform: `scale(${hoverScale})`, zIndex: 10 } : undefined}
      >
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
              src={effectiveImageUrl || fallbackUrl}
              alt={name}
              className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading={loading}
              decoding="async"
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
          <div
            className={`absolute ${badgeInset ? badgeSize.inset : badgeSize.floating} ${badgeInfo.bg} rounded-full border border-white flex items-center justify-center shadow-sm pointer-events-none z-10`}
          >
            <span className="inline-flex w-full h-full items-center justify-center leading-none">
              <i
                className={`fa-solid ${badgeInfo.icon} text-white ${badgeSize.icon} leading-none`}
                style={{ lineHeight: 1, transform: 'translateY(0.25px)' }}
              ></i>
            </span>
          </div>
        )}
      </div>

      {showTooltip && isHovered && (
        <div
          style={tooltipStyle}
          className="px-2 py-1 bg-slate-900 text-white text-[10px] rounded-md whitespace-nowrap pointer-events-none shadow-lg opacity-100"
        >
          <div className="flex flex-col gap-0 leading-tight">
            <div className="font-bold leading-tight">{name}</div>
            {roleLabel ? <div className={`text-[9px] leading-tight ${roleColorClass}`}>{roleLabel}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Avatar);

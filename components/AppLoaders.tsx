import React from 'react';

type LoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<LoaderSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-14 h-14'
};

const SIMPLE_SIZE_MAP: Record<LoaderSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
};

const ICON_SIZE_MAP: Record<LoaderSize, string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-7 h-7'
};

interface BrandSpinnerProps {
  size?: LoaderSize;
  className?: string;
}

interface SimpleSpinnerProps {
  size?: LoaderSize;
  className?: string;
}

export function SimpleSpinner({
  size = 'sm',
  className = ''
}: SimpleSpinnerProps) {
  return (
    <span className={`inline-flex items-center justify-center ${SIMPLE_SIZE_MAP[size]} ${className}`}>
      <span className="w-full h-full rounded-full border-2 border-brand-100 border-t-brand-600 animate-spin" />
    </span>
  );
}

export function BrandSpinner({
  size = 'md',
  className = ''
}: BrandSpinnerProps) {
  if (size === 'xs') {
    return <SimpleSpinner size="sm" className={className} />;
  }

  return (
    <span className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <span className="absolute inset-0 rounded-full border-2 border-brand-100 border-t-brand-600 animate-spin" />
      <img src="/logo.png" alt="Computeksa" className={`${ICON_SIZE_MAP[size]} object-contain`} />
    </span>
  );
}

interface PageLoaderProps {
  message?: string;
  fullscreen?: boolean;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = '',
  fullscreen = true
}) => {
  return (
    <div className={`${fullscreen ? 'min-h-screen' : 'h-full'} bg-slate-50 dark:bg-slate-600 flex items-center justify-center`}>
      <div className="text-center">
        <BrandSpinner size="xl" className="mb-4" />
        {message ? <p className="text-slate-600 dark:text-slate-300">{message}</p> : null}
      </div>
    </div>
  );
};

interface SectionLoaderProps {
  message?: string;
  className?: string;
}

export const SectionLoader: React.FC<SectionLoaderProps> = ({
  message = '',
  className = ''
}) => {
  return (
    <div className={`py-10 text-center ${className}`}>
      <BrandSpinner size="md" className="mb-2" />
      {message ? <p className="text-xs text-gray-400">{message}</p> : null}
    </div>
  );
};

interface ButtonLoaderProps {
  size?: LoaderSize;
  className?: string;
}

export const ButtonLoader: React.FC<ButtonLoaderProps> = ({
  size = 'sm',
  className = ''
}) => {
  return <SimpleSpinner size={size} className={className} />;
};

interface SkeletonLoaderProps {
  rows?: number;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  rows = 3,
  className = ''
}) => {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`h-3 rounded bg-slate-200 dark:bg-slate-700 ${index === rows - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

/**
 * Componente de carga optimizado para Suspense fallback
 * Usado durante lazy loading de rutas y componentes pesados
 */
export const AppLoadingFallback: React.FC = () => {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <BrandSpinner size="lg" />
      </div>
    </div>
  );
};

// Exportación por defecto como respaldo
export default BrandSpinner;

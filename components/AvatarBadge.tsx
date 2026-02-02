import React, { useMemo } from 'react';

interface AvatarBadgeProps {
  initials: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Avatar badge con soporte para dark mode.
 * Usa colores suaves que se adaptan al tema oscuro/claro.
 */
export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  initials,
  name,
  size = 'md',
  className = '',
}) => {
  const color = useMemo(() => {
    const colors = [
      { light: '#F0E6E6', dark: '#3a2f2f', lightText: '#A67C7C', darkText: '#d4a5a5' },    // Rojo suave
      { light: '#F5EAF0', dark: '#3a2f35', lightText: '#B397AA', darkText: '#d4b5d4' },    // Rosa suave
      { light: '#EDE4F5', dark: '#35302f', lightText: '#9B7DB0', darkText: '#c5a5d4' },    // Púrpura suave
      { light: '#E8E0F0', dark: '#32283f', lightText: '#8B7BA3', darkText: '#b5a5d4' },    // Índigo suave
      { light: '#E1E8F5', dark: '#2f3640', lightText: '#7A8FB5', darkText: '#a5c5d4' },    // Azul suave
      { light: '#DFF0ED', dark: '#2f3a37', lightText: '#7BA89C', darkText: '#a5d4d0' },    // Teal suave
      { light: '#E9F0E8', dark: '#313930', lightText: '#7FA080', darkText: '#a8d4a5' },    // Verde suave
      { light: '#EEF2E7', dark: '#353f32', lightText: '#92A680', darkText: '#b5d4a5' },    // Verde claro suave
      { light: '#F5F2E1', dark: '#3f3d2f', lightText: '#B8AC5B', darkText: '#d4cc96' },    // Amarillo suave
      { light: '#F7EFEA', dark: '#3f3630', lightText: '#B88263', darkText: '#d4a58a' },    // Naranja suave
      { light: '#EFE8E4', dark: '#36302c', lightText: '#8B7B6F', darkText: '#c5b5a5' },    // Marrón suave
      { light: '#E8E8E8', dark: '#2f2f2f', lightText: '#707070', darkText: '#a5a5a5' },    // Gris suave
    ];

    let hash = 0;
    const displayName = name || '';
    for (let i = 0; i < displayName.length; i++) {
      hash = ((hash << 5) - hash) + displayName.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }, [name]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-16 h-16 text-sm',
  };

  return (
    <div
      className={`flex items-center justify-center font-bold border shadow-sm flex-shrink-0 rounded-full transition-colors ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: color.light,
        color: color.lightText,
        borderColor: color.lightText,
        // CSS variables para dark mode
        '--avatar-dark': color.dark,
        '--avatar-dark-text': color.darkText,
      } as React.CSSProperties & { '--avatar-dark': string; '--avatar-dark-text': string }}
    >
      {initials}
    </div>
  );
};

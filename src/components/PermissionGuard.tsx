import React from 'react';
import { User } from '../types';
import { GoogleLoginButton } from './GoogleLoginButton';

interface PermissionGuardProps {
  user: User | null;
  permission: 'sync_calendar' | 'sync_emails' | 'send_emails';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onConnect?: () => void;
}

const permissionLabels: Record<string, { label: string; description: string; benefit: string; icon: string }> = {
  sync_calendar: {
    label: 'Sincronizar Google Calendar',
    description: 'acceder al calendario',
    benefit: 'Mantén tu calendario sincronizado con tu cuenta de Google',
    icon: '📅'
  },
  sync_emails: {
    label: 'Sincronizar Correos de Gmail',
    description: 'acceder al gestor de correos',
    benefit: 'Sincroniza automáticamente tus correos para una gestión más fácil',
    icon: '📧'
  },
  send_emails: {
    label: 'Enviar Correos desde Gmail',
    description: 'enviar correos y cotizaciones',
    benefit: 'Envía correos directamente desde la plataforma sin cambiar de aplicación',
    icon: '✉️'
  }
};

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  user,
  permission,
  children,
  fallback,
  onConnect
}) => {
  const hasPermission = user?.[permission as keyof User] === true;

  if (!hasPermission) {
    const permissionInfo = permissionLabels[permission];
    
    // Verificar si ya tiene el scope en Google (pero toggle desactivado)
    const scopeMap = {
      'sync_calendar': 'https://www.googleapis.com/auth/calendar',
      'sync_emails': 'https://www.googleapis.com/auth/gmail.modify',
      'send_emails': 'https://www.googleapis.com/auth/gmail.send'
    };
    
    const requiredScope = scopeMap[permission];
    const grantedScopes = Array.isArray(user?.granted_scopes) ? user.granted_scopes : [];
    const hasScope = grantedScopes.includes(requiredScope);
    
    // Si tiene el scope pero está desactivado → Solo ir a configuración
    if (hasScope) {
      return (
        fallback || (
          <div className="flex items-center justify-center min-h-96 bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl">
            <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-lg p-8 max-w-2xl w-full">
              <div className="flex items-start gap-4 mb-6">
                <div className="text-5xl flex-shrink-0">⚠️</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">
                    {permissionInfo.label} Desactivado
                  </h2>
                  <p className="text-slate-600 text-sm">
                    Ya tienes la conexión con Google, solo necesitas activar el permiso
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
                <p className="text-slate-700 text-sm mb-3">
                  <strong>¿Qué pasó?</strong> Anteriormente conectaste tu cuenta de Google, pero este permiso está desactivado.
                </p>
                <p className="text-slate-700 text-sm">
                  <strong>Solución:</strong> Ve a tu perfil y activa el toggle <strong>"{permissionInfo.label}"</strong>. No necesitas volver a conectar con Google.
                </p>
              </div>

              <a
                href="/app/integrations"
                className="w-full px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <i className="fa-solid fa-user-gear"></i>
                Ir a Configuración
              </a>

              <p className="text-xs text-slate-500 text-center mt-4">
                <i className="fa-solid fa-toggle-on text-brand-600 mr-1"></i>
                Un solo clic en el toggle y podrás usar esta función
              </p>
            </div>
          </div>
        )
      );
    }
    
    // No tiene el scope → Pedir OAuth completo
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-96 bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl">
          <div className="bg-white rounded-2xl border-2 border-brand-100 shadow-lg p-8 max-w-2xl w-full">
            {/* Header con icono */}
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl flex-shrink-0">{permissionInfo.icon}</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  Activa {permissionInfo.label}
                </h2>
                <p className="text-slate-600 text-sm">
                  {permissionInfo.benefit}
                </p>
              </div>
            </div>

            {/* Descripción del beneficio */}
            <div className="bg-brand-50 rounded-xl p-4 mb-6 border border-brand-100">
              <p className="text-slate-700 text-sm">
                Una vez conectes, podrás {permissionInfo.description} sin cambiar de aplicación.
              </p>
            </div>

            {/* Pasos compactos */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                3 clics para conectar
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <span className="text-slate-700">Ve a <strong>Perfil</strong> → <strong>Integración y Sincronización</strong></span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <span className="text-slate-700">Busca <strong>"{permissionInfo.label}"</strong> y actívalo</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <span className="text-slate-700">Autoriza el acceso y ¡listo!</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex gap-3">
              <GoogleLoginButton
                onClick={onConnect || (() => window.location.href = '/app/integrations')}
                text="Conectar con Google"
              />
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">
              <i className="fa-solid fa-shield text-brand-600 mr-1"></i>
              Tu privacidad está protegida. Solo sincronizamos lo que necesitas.
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};

// Hook para verificación simple de permisos
export const useHasPermission = (user: User | null, permission: 'sync_calendar' | 'sync_emails' | 'send_emails'): boolean => {
  return user?.[permission as keyof User] === true;
};

// Utilidad para validar múltiples permisos
export const validatePermissions = (
  user: User | null,
  permissions: Array<'sync_calendar' | 'sync_emails' | 'send_emails'>,
  mode: 'all' | 'any' = 'all'
): boolean => {
  if (!user) return false;
  
  const checks = permissions.map(p => user[p as keyof User] === true);
  
  return mode === 'all' 
    ? checks.every(c => c) 
    : checks.some(c => c);
};

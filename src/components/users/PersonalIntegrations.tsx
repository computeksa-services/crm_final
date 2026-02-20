import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { useMicrosoftLogin } from '../../../hooks/useMicrosoftLogin';
import Toast from '../../../components/Toast';
import { GATEWAY_CONFIG } from '../../../services/gatewayConfig';
import { oauthRedirectUri } from '../../../services/oauthConfig';
import { PermissionToggle } from './PermissionToggle';
import { apiFetch } from '../../../services/apiClient';

interface PersonalIntegrationsProps {
    user: User;
}

export const PersonalIntegrations: React.FC<PersonalIntegrationsProps> = ({ user }) => {
    const { refreshUser } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [updatingPermissions, setUpdatingPermissions] = useState<Record<string, boolean>>({});
    const [currentUser, setCurrentUser] = useState<User>(user);
    const [tenantSettings, setTenantSettings] = useState<any>(null);

    // Sincronizar cuando el prop user cambia (ej: logout/login o refreshUser())
    useEffect(() => {
        setCurrentUser(user);
    }, [user]);

    const loadTenantSettings = async () => {
        if (!user?.id_tenant) return;
        try {
            const appToken = localStorage.getItem('appToken');
            const res = await fetch(`${GATEWAY_CONFIG.API.TENANTS.DETAIL}?id_tenant=${user.id_tenant}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                }
            });

            if (res.ok) {
                const data = await res.json();
                setTenantSettings(Array.isArray(data) ? data[0] : data);
            }
        } catch (error) {
            console.error('Error loading tenant settings', error);
        }
    };

    useEffect(() => {
        loadTenantSettings();
    }, [user?.id_tenant]);

    useEffect(() => {
        const onPolicyUpdated = () => loadTenantSettings();
        window.addEventListener('email-policy-updated', onPolicyUpdated);
        return () => window.removeEventListener('email-policy-updated', onPolicyUpdated);
    }, [user?.id_tenant]);

    const isTenantEmailPolicyActive = Boolean(tenantSettings?.corporate_email_address) && Boolean(
        tenantSettings?.corporate_send_emails || tenantSettings?.corporate_sync_emails
    );

    const isPermissionManagedByTenant = (permission: 'sync_calendar' | 'sync_emails' | 'send_emails') => {
        return isTenantEmailPolicyActive && permission !== 'sync_calendar';
    };

    const notifyPolicyUpdated = () => {
        window.dispatchEvent(new Event('email-policy-updated'));
    };

    const sendPermissionCodeToGateway = async (code: string, module: string, provider: 'google' | 'microsoft' = 'google', scope?: string) => {
        try {
            console.log('🔄 [OAuth Callback] Iniciando sendPermissionCodeToGateway:', { code: code?.substring(0, 20), module, provider, scope });
            console.log('📍 [OAuth Callback] redirect_uri value:', oauthRedirectUri);
            
            // ⚠️ USAR fetch DIRECTO porque apiFetch puede redirigir a login en ciertos casos
            const appToken = localStorage.getItem('appToken');
            
            const payload = {
                code: code,
                provider: provider,
                module: module,
                scope: scope,
                redirect_uri: oauthRedirectUri,
                app_id: 'crm',
                user_id: currentUser.id_user,
                tenant_id: currentUser.id_tenant,
                email: currentUser.email_user
            };
            
            console.log('📤 [OAuth Callback] Payload completo:', JSON.stringify(payload));
            
            const response = await fetch(GATEWAY_CONFIG.AUTH.LOGIN, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                },
                body: JSON.stringify(payload),
            });

            console.log('📡 [OAuth Callback] Respuesta del gateway:', response.status);
            
            if (!response.ok) throw new Error(`Gateway error: ${response.status}`);
            
            // Obtener la respuesta (puede o no incluir token/user)
            const responseData = await response.json();
            console.log('🔍 [OAuth Callback] RESPUESTA COMPLETA:', JSON.stringify(responseData));
            
            const dataArray = Array.isArray(responseData) ? responseData : [responseData];
            const data = dataArray[0];
            
            // ✅ CASO 1: El gateway devuelve token + user actualizado CON datos útiles
            if (data && data.token && data.user && data.user.id_user && data.user.integrations) {
                console.log('💾 [OAuth Callback] Guardando token y usuario desde respuesta...');
                
                // ⚠️ IMPORTANTE: Aplanar integrations al nivel raíz para que React pueda leerlos
                const flattenedUser = {
                    ...data.user,
                    send_emails: data.user.integrations?.send_emails,
                    sync_emails: data.user.integrations?.sync_emails,
                    sync_calendar: data.user.integrations?.sync_calendar,
                    watch_active: data.user.integrations?.watch_active,
                    granted_scopes: data.user.integrations?.granted_scopes,
                };
                
                console.log('✅ [OAuth Callback] Usuario aplanado:', flattenedUser);
                
                localStorage.setItem('appToken', data.token);
                localStorage.setItem('user', JSON.stringify(flattenedUser));
                
                // ✅ Refrescar contexto global para forzar re-render en todos los componentes
                await refreshUser();
                
                // ✅ Mostrar toast global que persista el remount
                window.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Integración activada correctamente', type: 'success' } 
                }));
                
                notifyPolicyUpdated();
            } 
            // ✅ CASO 2: El gateway devuelve 200 pero sin datos útiles en la respuesta
            // O devuelve datos incompletos/vacíos
            // En este caso, hacer refresh del usuario actual desde /api/v1/me
            else {
                console.log('🔄 [OAuth Callback] Datos insuficientes en respuesta. Refrescando usuario desde /api/v1/me...');
                try {
                    const meResponse = await fetch(GATEWAY_CONFIG.API.USERS.ME, {
                        method: 'GET',
                        headers: {
                            ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                        }
                    });
                    
                    console.log('📡 [OAuth Callback] Respuesta ME:', meResponse.status);
                    
                    if (!meResponse.ok) {
                        console.error('❌ [OAuth Callback] /api/v1/me devolvió:', meResponse.status);
                        throw new Error('Error refrescando usuario');
                    }
                    
                    const meData = await meResponse.json();
                    console.log('🔍 [OAuth Callback] Datos de /api/v1/me:', JSON.stringify(meData));
                    
                    const updatedUser = Array.isArray(meData) ? meData[0] : meData;
                    
                    console.log('✅ [OAuth Callback] Usuario refrescado:', updatedUser);
                    
                    if (updatedUser && updatedUser.id_user) {
                        console.log('💾 [OAuth Callback] Guardando usuario actualizado en localStorage...');
                        
                        // ⚠️ IMPORTANTE: Aplanar integrations al nivel raíz para que React pueda leerlos
                        const flattenedUser = {
                            ...updatedUser,
                            send_emails: updatedUser.integrations?.send_emails,
                            sync_emails: updatedUser.integrations?.sync_emails,
                            sync_calendar: updatedUser.integrations?.sync_calendar,
                            watch_active: updatedUser.integrations?.watch_active,
                            granted_scopes: updatedUser.integrations?.granted_scopes,
                        };
                        
                        console.log('✅ [OAuth Callback] Usuario aplanado:', flattenedUser);
                        
                        localStorage.setItem('user', JSON.stringify(flattenedUser));
                        
                        // ✅ Refrescar contexto global para forzar re-render en todos los componentes
                        await refreshUser();
                        
                        // ✅ Mostrar toast global que persista el remount
                        window.dispatchEvent(new CustomEvent('showToast', { 
                            detail: { message: 'Integración activada correctamente', type: 'success' } 
                        }));
                        
                        notifyPolicyUpdated();
                    } else {
                        console.error('❌ [OAuth Callback] Usuario refrescado pero sin datos completos:', updatedUser);
                        throw new Error('Usuario incompleto');
                    }
                } catch (refreshError) {
                    console.error('❌ [OAuth Callback] Error refrescando usuario:', refreshError);
                    setToast({ message: 'Permiso guardado. Recargue la página para actualizar', type: 'error' });
                }
            }
        } catch (error) {
            console.error('❌ [OAuth Callback] Error enviando permiso:', error);
            setToast({ message: 'Error al actualizar permiso', type: 'error' });
        }
    };

    const grantSendEmail = useGoogleLogin({
        onSuccess: (codeResponse) => {
            console.log('✅ [Google OAuth] Success callback invoked:', { code: codeResponse.code?.substring(0, 20) });
            codeResponse.code && sendPermissionCodeToGateway(codeResponse.code, 'mail_send');
        },
        onError: () => {
            console.error('❌ [Google OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        },
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
    });

    const grantSyncEmail = useGoogleLogin({
        onSuccess: (codeResponse) => {
            console.log('✅ [Google OAuth] Success callback invoked:', { code: codeResponse.code?.substring(0, 20) });
            codeResponse.code && sendPermissionCodeToGateway(codeResponse.code, 'mail_sync');
        },
        onError: () => {
            console.error('❌ [Google OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        },
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.modify',
    });

    const grantCalendar = useGoogleLogin({
        onSuccess: (codeResponse) => {
            console.log('✅ [Google OAuth] Success callback invoked:', { code: codeResponse.code?.substring(0, 20) });
            codeResponse.code && sendPermissionCodeToGateway(codeResponse.code, 'calendar_sync');
        },
        onError: () => {
            console.error('❌ [Google OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        },
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/calendar',
    });

    // --- MICROSOFT LOGIN HOOKS (Mirror pattern) ---
    const grantSendEmailMicrosoft = useMicrosoftLogin({
        scope: 'openid profile email Mail.Send offline_access',
        module: 'mail_send',
        prompt: 'consent',
        onSuccess: (response) => {
            console.log('✅ [Microsoft OAuth] Success callback invoked:', { code: response.code?.substring(0, 20) });
            response.code && sendPermissionCodeToGateway(response.code, 'mail_send', 'microsoft', 'openid profile email Mail.Send offline_access');
        },
        onError: () => {
            console.error('❌ [Microsoft OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        }
    });

    const grantSyncEmailMicrosoft = useMicrosoftLogin({
        scope: 'openid profile email Mail.ReadWrite offline_access',
        module: 'mail_sync',
        prompt: 'consent',
        onSuccess: (response) => {
            console.log('✅ [Microsoft OAuth] Success callback invoked:', { code: response.code?.substring(0, 20) });
            response.code && sendPermissionCodeToGateway(response.code, 'mail_sync', 'microsoft', 'openid profile email Mail.ReadWrite offline_access');
        },
        onError: () => {
            console.error('❌ [Microsoft OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        }
    });

    const grantCalendarMicrosoft = useMicrosoftLogin({
        scope: 'openid profile email Calendars.ReadWrite offline_access',
        module: 'calendar_sync',
        prompt: 'consent',
        onSuccess: (response) => {
            console.log('✅ [Microsoft OAuth] Success callback invoked:', { code: response.code?.substring(0, 20) });
            response.code && sendPermissionCodeToGateway(response.code, 'calendar_sync', 'microsoft', 'openid profile email Calendars.ReadWrite offline_access');
        },
        onError: () => {
            console.error('❌ [Microsoft OAuth] Error callback invoked');
            setToast({ message: 'Error al autorizar permiso', type: 'error' });
        }
    });

    const handlePermissionToggle = async (permission: 'sync_calendar' | 'sync_emails' | 'send_emails', enabled: boolean) => {
        console.log('🎛️ [Toggle] Usuario cambió:', { permission, enabled, provider: currentUser.provider });

        if (isPermissionManagedByTenant(permission)) {
            setToast({ message: 'Deshabilitado por política de correo del workspace', type: 'error' });
            return;
        }
        
        if (enabled) {
            // ACTIVAR: Verificar si usuario ya tiene el scope guardado
            const scopeMap = {
                'send_emails': currentUser.provider === 'microsoft' ? 'Mail.Send' : 'https://www.googleapis.com/auth/gmail.send',
                'sync_emails': currentUser.provider === 'microsoft' ? 'Mail.ReadWrite' : 'https://www.googleapis.com/auth/gmail.modify',
                'sync_calendar': currentUser.provider === 'microsoft' ? 'Calendars.ReadWrite' : 'https://www.googleapis.com/auth/calendar'
            };
            
            const requiredScope = scopeMap[permission];
            const grantedScopes = Array.isArray(currentUser.granted_scopes) ? currentUser.granted_scopes : [];
            const hasScope = grantedScopes.includes(requiredScope);
            
            console.log('🔍 [Toggle] Verificando scope:', { permission, requiredScope, hasScope, grantedScopes });
            
            if (hasScope) {
                // Scope ya existe → Solo activar toggle (sin OAuth)
                console.log('✅ [Toggle] Scope ya existe, activando toggle directo:', permission);
                const previousValue = currentUser[permission as keyof User];
                // ✅ OPTIMISTIC UPDATE: Actualizar UI inmediatamente
                setCurrentUser(prev => ({ ...prev, [permission]: true }));
                setUpdatingPermissions(prev => ({ ...prev, [permission]: true }));
                try {
                    // ⚠️ USAR fetch DIRECTO para evitar logout automático
                    const appToken = localStorage.getItem('appToken');
                    const res = await fetch(GATEWAY_CONFIG.API.USERS.UPDATE_SETTINGS, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                        },
                        body: JSON.stringify({ [permission]: true })
                    });
                    
                    if (!res.ok) throw new Error('Error activando permiso');
                    setToast({ message: 'Permiso activado', type: 'success' });
                    notifyPolicyUpdated();
                } catch (error) {
                    // ❌ REVERTIR si falla
                    setCurrentUser(prev => ({ ...prev, [permission]: previousValue }));
                    setToast({ message: 'Error al activar', type: 'error' });
                } finally {
                    setUpdatingPermissions(prev => ({ ...prev, [permission]: false }));
                }
            } else {
                // Scope NO existe → OAuth completo
                console.log('🔐 [Toggle] Scope no existe, iniciando OAuth popup:', permission);
                if (currentUser.provider === 'google') {
                    console.log('📲 [Google OAuth] Abriendo popup para:', permission);
                    if (permission === 'send_emails') grantSendEmail();
                    else if (permission === 'sync_emails') grantSyncEmail();
                    else if (permission === 'sync_calendar') grantCalendar();
                } else if (currentUser.provider === 'microsoft') {
                    console.log('📲 [Microsoft OAuth] Abriendo popup para:', permission);
                    if (permission === 'send_emails') grantSendEmailMicrosoft();
                    else if (permission === 'sync_emails') grantSyncEmailMicrosoft();
                    else if (permission === 'sync_calendar') grantCalendarMicrosoft();
                }
            }
        } else {
            // DESACTIVAR: Solo actualiza toggle (scope permanece en provider)
            console.log('❌ [Toggle] Desactivando:', permission);
            const previousValue = currentUser[permission as keyof User];
            // ✅ OPTIMISTIC UPDATE: Actualizar UI inmediatamente
            setCurrentUser(prev => ({ ...prev, [permission]: false }));
            setUpdatingPermissions(prev => ({ ...prev, [permission]: true }));
            try {
                // ⚠️ USAR fetch DIRECTO para evitar logout automático
                const appToken = localStorage.getItem('appToken');
                const res = await fetch(GATEWAY_CONFIG.API.USERS.UPDATE_SETTINGS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                    },
                    body: JSON.stringify({ [permission]: false })
                });

                if (!res.ok) throw new Error('Error desactivando permiso');
                setToast({ message: 'Permiso desactivado', type: 'success' });
                notifyPolicyUpdated();
            } catch (error) {
                // ❌ REVERTIR si falla
                setCurrentUser(prev => ({ ...prev, [permission]: previousValue }));
                setToast({ message: 'Error al desactivar', type: 'error' });
            } finally {
                setUpdatingPermissions(prev => ({ ...prev, [permission]: false }));
            }
        }
    };

    return (
        <div className="space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <i className="fa-solid fa-user text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm">Integración Personal</h3>
                    <p className="text-xs text-slate-500 mt-1">Configure permisos para su cuenta individual</p>
                </div>
            </div>

            {isTenantEmailPolicyActive && (
                <div className="p-3 border border-slate-300 bg-slate-100 text-slate-700">
                    <div className="flex items-start gap-2">
                        <i className="fa-solid fa-building text-slate-600 mt-0.5"></i>
                        <div>
                            <p className="text-sm font-medium">Correo personal deshabilitado</p>
                            <p className="text-xs mt-1">El workspace usa correo corporativo. Calendario personal sigue disponible.</p>
                        </div>
                    </div>
                </div>
            )}

            {currentUser.provider === 'google' ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 border border-slate-200 bg-slate-50">
                        <div className="w-9 h-9 bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <i className="fa-brands fa-google text-base text-[#4285F4]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">Cuenta Conectada</p>
                            <p className="text-xs text-slate-500 truncate">{currentUser.email_connected || currentUser.email_user}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                        <PermissionToggle
                            id="personal_send"
                            label="Enviar Correos Personales"
                            description={isPermissionManagedByTenant('send_emails') ? 'Deshabilitado por Workspace.' : 'Autoriza enviar correos desde tu cuenta personal.'}
                            checked={isPermissionManagedByTenant('send_emails') ? false : (currentUser.send_emails || false)}
                            isUpdating={updatingPermissions.send_emails}
                            disabled={isPermissionManagedByTenant('send_emails')}
                            sideNote={isPermissionManagedByTenant('send_emails') ? 'Workspace' : undefined}
                            onChange={(chk) => handlePermissionToggle('send_emails', chk)}
                        />
                        <PermissionToggle
                            id="personal_sync"
                            label="Sincronizar Bandeja"
                            description={isPermissionManagedByTenant('sync_emails') ? 'Deshabilitado por Workspace.' : 'Leer respuestas en tu bandeja de entrada personal.'}
                            checked={isPermissionManagedByTenant('sync_emails') ? false : (currentUser.sync_emails || false)}
                            isUpdating={updatingPermissions.sync_emails}
                            disabled={isPermissionManagedByTenant('sync_emails')}
                            sideNote={isPermissionManagedByTenant('sync_emails') ? 'Workspace' : undefined}
                            onChange={(chk) => handlePermissionToggle('sync_emails', chk)}
                        />
                        <PermissionToggle
                            id="personal_calendar"
                            label="Sincronizar Calendario"
                            description="Gestionar eventos en tu calendario personal."
                            checked={currentUser.sync_calendar || false}
                            isUpdating={updatingPermissions.sync_calendar}
                            disabled={false}
                            onChange={(chk) => handlePermissionToggle('sync_calendar', chk)}
                        />
                    </div>
                </div>
            ) : currentUser.provider === 'microsoft' ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 border border-slate-200 bg-slate-50">
                        <div className="w-9 h-9 bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <i className="fa-brands fa-microsoft text-base text-[#00A4EF]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">Cuenta Conectada</p>
                            <p className="text-xs text-slate-500 truncate">{currentUser.email_connected || currentUser.email_user}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                        <PermissionToggle
                            id="personal_send_ms"
                            label="Enviar Correos Personales"
                            description={isPermissionManagedByTenant('send_emails') ? 'Deshabilitado por Workspace.' : 'Autoriza enviar correos desde tu cuenta personal.'}
                            checked={isPermissionManagedByTenant('send_emails') ? false : (currentUser.send_emails || false)}
                            isUpdating={updatingPermissions.send_emails}
                            disabled={isPermissionManagedByTenant('send_emails')}
                            sideNote={isPermissionManagedByTenant('send_emails') ? 'Workspace' : undefined}
                            onChange={(chk) => handlePermissionToggle('send_emails', chk)}
                        />
                        <PermissionToggle
                            id="personal_sync_ms"
                            label="Sincronizar Bandeja"
                            description={isPermissionManagedByTenant('sync_emails') ? 'Deshabilitado por Workspace.' : 'Leer respuestas en tu bandeja de entrada personal.'}
                            checked={isPermissionManagedByTenant('sync_emails') ? false : (currentUser.sync_emails || false)}
                            isUpdating={updatingPermissions.sync_emails}
                            disabled={isPermissionManagedByTenant('sync_emails')}
                            sideNote={isPermissionManagedByTenant('sync_emails') ? 'Workspace' : undefined}
                            onChange={(chk) => handlePermissionToggle('sync_emails', chk)}
                        />
                        <PermissionToggle
                            id="personal_calendar_ms"
                            label="Sincronizar Calendario"
                            description="Gestionar eventos en tu calendario personal."
                            checked={currentUser.sync_calendar || false}
                            isUpdating={updatingPermissions.sync_calendar}
                            disabled={false}
                            onChange={(chk) => handlePermissionToggle('sync_calendar', chk)}
                        />
                    </div>
                </div>
            ) : (
                <div className="p-6 text-center bg-slate-50 border border-slate-200">
                    <p className="text-slate-500 text-sm">Debe iniciar sesión con Google o Microsoft para habilitar integraciones.</p>
                </div>
            )}
        </div>
    );
};

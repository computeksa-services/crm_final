import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { GATEWAY_CONFIG, buildUrl } from '../../../services/gatewayConfig';
import { apiFetch } from '../../../services/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { useMicrosoftLogin } from '../../../hooks/useMicrosoftLogin';
import Toast from '../../../components/Toast';
import ConfirmModal from '../../../components/ConfirmModal';
import { PermissionToggle } from './PermissionToggle';
import { oauthRedirectUri } from '../../../services/oauthConfig';
import { SimpleSpinner } from '../../../components/AppLoaders';

interface TenantEmailSettingsProps {
    user: User;
}

export const TenantEmailSettings: React.FC<TenantEmailSettingsProps> = ({ user }) => {
    const { refreshUser } = useAuth();
    const [tenantData, setTenantData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const notifyPolicyUpdated = () => {
        window.dispatchEvent(new Event('email-policy-updated'));
    };

    useEffect(() => {
        loadTenant();
    }, [user.id_tenant]);

    const loadTenant = async () => {
        if (!user?.id_tenant) return;
        setLoading(true);
        try {
            // ⚠️ USAR fetch DIRECTO para evitar logout automático si el token cambió
            const appToken = localStorage.getItem('appToken');
            const url = buildUrl(GATEWAY_CONFIG.API.TENANTS.DETAIL, { id_tenant: user.id_tenant });
            
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setTenantData(Array.isArray(data) ? data[0] : data);
            } else if (res.status === 401 || res.status === 403) {
                // Token inválido, forzar recarga completa de la página
                console.log('⚠️ Token inválido al cargar tenant, recargando página...');
                window.location.reload();
            }
        } catch (e) {
            console.error('Error loading tenant detail', e);
        } finally {
            setLoading(false);
        }
    };

    const updateCorporativeSettings = async (field: 'corporate_send_emails' | 'corporate_sync_emails', value: boolean) => {
        if (!user?.id_tenant || !tenantData) return;
        
        const originalValue = tenantData[field];
        setTenantData((prev: any) => ({ ...prev, [field]: value }));

        try {
            // ⚠️ USAR fetch DIRECTO para evitar logout automático
            const appToken = localStorage.getItem('appToken');
            
            const res = await fetch(GATEWAY_CONFIG.API.TENANTS.UPDATE_EMAIL_SETTINGS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                },
                body: JSON.stringify({ 
                    id_tenant: user.id_tenant,
                    provider: tenantData?.corporate_provider,
                    [field]: value 
                })
            });

            if (!res.ok) throw new Error('Error al actualizar configuración');
            setToast({
                message: value
                    ? 'Correo corporativo activado. Se desactivarán permisos personales de correo; el calendario personal no se afecta'
                    : 'Configuración actualizada',
                type: 'success'
            });
            await loadTenant();
            notifyPolicyUpdated();
        } catch (error) {
            console.error('Error updating tenant settings:', error);
            setToast({ message: 'Error al actualizar configuración', type: 'error' });
            setTenantData((prev: any) => ({ ...prev, [field]: originalValue }));
        }
    };

    const handleCorporativeToggle = (field: 'corporate_send_emails' | 'corporate_sync_emails') => {
        const newValue = !tenantData?.[field];
        
        if (newValue) {
            // ACTIVAR: Verificar si backend ya tiene el scope guardado
            // Patrón de grandes empresas (Slack, Google Workspace, Microsoft 365):
            // - Si scope existe → Solo cambiar toggle (rápido, sin OAuth)
            // - Si scope NO existe → OAuth completo
            
            const scopeMap = {
                'corporate_send_emails': tenantData?.corporate_provider === 'microsoft' 
                    ? 'Mail.Send'
                    : 'https://www.googleapis.com/auth/gmail.send',
                'corporate_sync_emails': tenantData?.corporate_provider === 'microsoft'
                    ? 'Mail.ReadWrite'
                    : 'https://www.googleapis.com/auth/gmail.modify'
            };
            
            const requiredScope = scopeMap[field];
            const grantedScopes = Array.isArray(tenantData?.corporate_granted_scopes) 
                ? tenantData.corporate_granted_scopes 
                : [];
            const hasScope = grantedScopes.includes(requiredScope);
            
            if (hasScope) {
                // Scope ya existe → Solo activar toggle (sin OAuth)
                console.log('✅ Scope ya existe, activando toggle directo:', field);
                updateCorporativeSettings(field, newValue);
            } else {
                // Scope NO existe → Pedir permisos (OAuth completo)
                console.log('🔐 Scope no existe, iniciando OAuth:', field);
                if (tenantData?.corporate_provider === 'microsoft') {
                    if (field === 'corporate_send_emails') grantSendEmailMicrosoft();
                    else grantSyncEmailMicrosoft();
                } else {
                    if (field === 'corporate_send_emails') grantSendEmail();
                    else grantSyncEmail();
                }
            }
        } else {
            // DESACTIVAR: Solo actualiza toggle en BD (scope permanece en provider)
            updateCorporativeSettings(field, newValue);
        }
    };

    const handleAuthSuccess = async (codeResponse: any, module: string, provider: 'google' | 'microsoft' = 'google', scope?: string) => {
        if (!codeResponse.code) return;
        try {
            console.log('📧 [Corporate OAuth] Iniciando callback:', { module, provider });
            console.log('📍 [Corporate OAuth] redirect_uri value:', oauthRedirectUri);
            
            // ⚠️ USAR fetch DIRECTO porque apiFetch puede redirigir a login cuando el token cambia
            const appToken = localStorage.getItem('appToken');
            
            const jsonPayload = {
                id_tenant: user.id_tenant,
                id_user: user.id_user,
                code: codeResponse.code,
                provider: provider,
                module: module,
                scope: scope,
                redirect_uri: oauthRedirectUri, // ⚠️ IMPORTANTE: Microsoft requiere URI absoluta, no "postmessage"
            };
            
            console.log('📤 [Corporate OAuth] Payload enviado:', JSON.stringify(jsonPayload, null, 2));
            
            const response = await fetch(GATEWAY_CONFIG.API.TENANTS.EMAIL_SETTINGS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                },
                body: JSON.stringify(jsonPayload)
            });

            console.log('📡 [Corporate OAuth] Respuesta del gateway:', response.status);

            if (!response.ok) {
                console.error('❌ [Corporate OAuth] Error:', response.status);
                const errorText = await response.text();
                console.error('📄 [Corporate OAuth] Error body:', errorText);
                throw new Error('Error al conectar permiso');
            }
            
            const responseData = await response.json();
            console.log('🔍 [Corporate OAuth] RESPUESTA COMPLETA:', JSON.stringify(responseData));
            
            const data = Array.isArray(responseData) ? responseData[0] : responseData;
            
            let tokenUpdated = false;
            
            // ✅ Si el gateway devuelve nuevo token (porque los scopes cambiaron), actualizarlo
            if (data && data.token) {
                console.log('💾 [Corporate OAuth] Actualizando token desde respuesta...');
                localStorage.setItem('appToken', data.token);
                tokenUpdated = true;
                
                // ✅ Si devuelve usuario actualizado, guardarlo también
                if (data.user && data.user.id_user) {
                    const flattenedUser = data.user.integrations ? {
                        ...data.user,
                        send_emails: data.user.integrations?.send_emails,
                        sync_emails: data.user.integrations?.sync_emails,
                        sync_calendar: data.user.integrations?.sync_calendar,
                        watch_active: data.user.integrations?.watch_active,
                        granted_scopes: data.user.integrations?.granted_scopes,
                    } : data.user;
                    
                    localStorage.setItem('user', JSON.stringify(flattenedUser));
                }
            }
            
            // ⚠️ IMPORTANTE: Esperar un momento antes de refrescar para que el backend procese el token
            console.log('⏳ [Corporate OAuth] Esperando 500ms antes de refrescar...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // ✅ NO llamar a refreshUser() para evitar logout si el token cambió
            // En su lugar, solo refrescar los datos del tenant
            console.log('🔄 [Corporate OAuth] Refrescando datos del tenant...');
            
            console.log('✅ [Corporate OAuth] Permiso activado:', module);
            
            // ✅ Mostrar toast global que persista el remount
            window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Permiso activado correctamente', type: 'success' } 
            }));
            
            notifyPolicyUpdated();
            
            // Refrescar datos del tenant (ahora es seguro porque usa fetch directo)
            setTimeout(() => loadTenant(), 1000);
            
        } catch (error) {
            console.error('❌ [Corporate OAuth] Error:', error);
            setToast({ message: 'Error al procesar permiso', type: 'error' });
        }
    };
    
    const grantSendEmail = useGoogleLogin({
        onSuccess: (codeResponse) => handleAuthSuccess(codeResponse, 'mail_send'),
        onError: () => setToast({ message: 'Error al autorizar permiso', type: 'error' }),
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
    });

    const grantSyncEmail = useGoogleLogin({
        onSuccess: (codeResponse) => handleAuthSuccess(codeResponse, 'mail_sync'),
        onError: () => setToast({ message: 'Error al autorizar permiso', type: 'error' }),
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.modify',
    });

    // --- MICROSOFT CORPORATE EMAIL HOOKS (Mirror pattern) ---
    const grantSendEmailMicrosoft = useMicrosoftLogin({
        scope: 'openid profile email Mail.Send offline_access',
        module: 'mail_send',
        prompt: 'consent',
        onSuccess: (response) => handleAuthSuccess({ code: response.code }, 'mail_send', 'microsoft', 'openid profile email Mail.Send offline_access'),
        onError: () => setToast({ message: 'Error al autorizar permiso', type: 'error' })
    });

    const grantSyncEmailMicrosoft = useMicrosoftLogin({
        scope: 'openid profile email Mail.ReadWrite offline_access',
        module: 'mail_sync',
        prompt: 'consent',
        onSuccess: (response) => handleAuthSuccess({ code: response.code }, 'mail_sync', 'microsoft', 'openid profile email Mail.ReadWrite offline_access'),
        onError: () => setToast({ message: 'Error al autorizar permiso', type: 'error' })
    });

    // PRIMERA CONEXIÓN CORPORATIVA:
    // - Obligatorio: gmail.send o Mail.Send (para enviar correos y cotizaciones)
    // - NO solicitar: sync_emails (sincronización es opcional con toggle después)
    // - NO solicitar: calendario (solo email corporativo)
    const googleLoginCorporative = useGoogleLogin({
        onSuccess: (codeResponse) => saveCorporativeEmail(codeResponse.code, 'google'),
        onError: () => setToast({ message: 'Error al conectar cuenta', type: 'error' }),
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
    });

    // Microsoft corporate email login (equivalent to Google)
    const microsoftLoginCorporative = useMicrosoftLogin({
        scope: 'openid profile email Mail.Send offline_access',
        module: 'mail_send',
        prompt: 'consent',
        onSuccess: (response) => saveCorporativeEmail(response.code, 'microsoft', 'openid profile email Mail.Send offline_access'),
        onError: () => setToast({ message: 'Error al conectar cuenta', type: 'error' })
    });

    const saveCorporativeEmail = async (code: string, provider: 'google' | 'microsoft', scope?: string) => {
        setActionLoading(true);
        try {
            // El payload para email corporativo debe procesarse a través del endpoint específico
            // EMAIL_SETTINGS apunta a /api/tenants/email/corporative que procesa la primera conexión
            // IMPORTANTE: incluir 'module' para que el backend sepa qué permiso activar
            const jsonPayload = {
                id_tenant: user.id_tenant,
                id_user: user.id_user,
                code,
                provider,
                module: 'mail_send', // Primer módulo obligatorio: envío de correos corporativos
                scope: scope,
                redirect_uri: oauthRedirectUri,
            };
            
            const logMsg = `📧 [Corporate Email] Enviando a ${GATEWAY_CONFIG.API.TENANTS.EMAIL_SETTINGS}: ${JSON.stringify(jsonPayload)}`;
            console.log(logMsg);
            localStorage.setItem('corporate_email_log', logMsg);
            
            // ⚠️ USAR fetch DIRECTO porque apiFetch hace logout automático en 401/403
            const appToken = localStorage.getItem('appToken');
            
            const res = await fetch(GATEWAY_CONFIG.API.TENANTS.EMAIL_SETTINGS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                },
                body: JSON.stringify(jsonPayload)
            });
            
            const statusMsg = `📧 [Corporate Email] Respuesta: ${res.status} ${res.statusText}`;
            console.log(statusMsg);
            localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + statusMsg);
            
            if (!res.ok) {
                try {
                    const errorData = await res.json();
                    const errMsg = `❌ [Corporate Email] Error: ${JSON.stringify(errorData)}`;
                    console.error(errMsg);
                    localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + errMsg);
                } catch (e) {
                    const errMsg = `❌ [Corporate Email] Error (sin JSON): ${res.statusText}`;
                    console.error(errMsg);
                    localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + errMsg);
                }
                throw new Error(`Error del servidor: ${res.status}`);
            }
            
            // ✅ Email corporativo guardado correctamente
            const successMsg = `✅ [Corporate Email] Conexión exitosa`;
            console.log(successMsg);
            localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + successMsg);
            
            setToast({ message: 'Email corporativo conectado correctamente', type: 'success' });
            
            // ✅ Recargar configuración del tenant y notificar cambio de política
            await loadTenant();
            notifyPolicyUpdated();
        } catch (e) {
            const errorMsg = `❌ Error: ${e instanceof Error ? e.message : 'Desconocido'}`;
            console.error(errorMsg);
            localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + errorMsg);
            localStorage.setItem('corporate_email_log', (localStorage.getItem('corporate_email_log') || '') + '\n' + 'Revisa en DevTools → Application → LocalStorage → corporate_email_log');
            setToast({ message: `Error: ${e instanceof Error ? e.message : 'Error desconocido'}`, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };
    
    const deleteCorporativeEmail = async () => {
        setActionLoading(true);
        try {
            // ⚠️ USAR fetch DIRECTO para evitar logout automático
            const appToken = localStorage.getItem('appToken');
            
            const res = await fetch(GATEWAY_CONFIG.API.TENANTS.EMAIL_DELETE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(appToken ? { 'Authorization': `Bearer ${appToken}` } : {})
                },
                body: JSON.stringify({ id_tenant: user.id_tenant, id_user: user.id_user })
            });
            
            if (!res.ok) throw new Error('Error al eliminar');
            setTenantData(null);
            setToast({ message: 'Configuración eliminada.', type: 'success' });
            await loadTenant();
            notifyPolicyUpdated();
        } catch (e) {
            setToast({ message: 'Error al eliminar configuración.', type: 'error' });
        } finally {
            setActionLoading(false);
            setConfirmDelete(false);
        }
    };

    if (!user || !user.is_owner) return null;

    return (
        <div className="space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={deleteCorporativeEmail}
                title="Desconectar Cuenta Corporativa"
                message="¿Confirma que desea desconectar la cuenta corporativa? Esta acción afectará a toda la organización."
                isDestructive
            />

            <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <i className="fa-solid fa-building text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm">Cuenta de Correo Corporativo</h3>
                        <div className="relative group">
                            <i className="fa-solid fa-circle-info text-slate-400 text-xs cursor-help hover:text-slate-600 transition-colors"></i>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <i className="fa-solid fa-check text-slate-400 mt-0.5 flex-shrink-0 text-xs"></i>
                                        <span>Envío de correos siempre activo</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <i className="fa-solid fa-sync text-slate-400 mt-0.5 flex-shrink-0 text-xs"></i>
                                        <span>Sincronización disponible opcionalmente</span>
                                    </div>
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Configuración centralizada para {tenantData?.name_tenant || 'su organización'}</p>
                </div>
            </div>

            <div className="p-3 border border-slate-300 bg-slate-100 text-slate-700">
                <div className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-slate-600 mt-0.5"></i>
                    <div>
                        <p className="text-sm font-medium">Impacto sobre usuarios</p>
                        <p className="text-xs mt-1">Al activar correo corporativo, se desactivan los permisos personales de correo. El calendario personal de usuarios no se desactiva.</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                    <div className="flex justify-center mb-2"><SimpleSpinner size="md" /></div>
                    <p>Cargando configuración...</p>
                </div>
            ) : !tenantData?.corporate_email_address ? (
                <div className="space-y-3">
                    <p className="text-sm text-slate-600">Conecte una cuenta de correo para gestionar notificaciones y comunicaciones automatizadas desde el sistema.</p>
                    <div className="grid gap-2">
                        <button 
                            onClick={() => googleLoginCorporative()} 
                            disabled={actionLoading}
                            className="w-full px-4 py-2.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {actionLoading ? (
                                <SimpleSpinner size="sm" />
                            ) : (
                                <i className="fa-brands fa-google text-base text-[#4285F4]"></i>
                            )}
                            Conectar con Google
                        </button>
                        <button 
                            onClick={() => microsoftLoginCorporative()} 
                            disabled={actionLoading}
                            className="w-full px-4 py-2.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {actionLoading ? (
                                <SimpleSpinner size="sm" />
                            ) : (
                                <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="M" className="w-4 h-4" />
                            )}
                            Conectar con Microsoft
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Cuenta conectada */}
                    <div className="p-3 bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                         <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                                <i className={`text-base ${
                                  tenantData.corporate_provider === 'microsoft' 
                                    ? 'fa-brands fa-microsoft text-[#00A4EF]' 
                                    : 'fa-brands fa-google text-[#4285F4]'
                                }`}></i>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-slate-900 truncate">{tenantData.corporate_email_address}</p>
                                <p className="text-xs text-slate-500">
                                    {tenantData.corporate_provider === 'microsoft' ? 'Microsoft' : 'Google'}
                                </p>
                            </div>
                         </div>
                         <button 
                            onClick={() => setConfirmDelete(true)} 
                            disabled={actionLoading}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Desconectar cuenta"
                         >
                            <i className="fa-solid fa-trash text-sm"></i>
                         </button>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-200">
                        {/* Envío (siempre activo) */}
                        <div className="p-3 border border-slate-300 bg-slate-50">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-8 h-8 bg-slate-200 border border-slate-300 flex items-center justify-center flex-shrink-0">
                                        <i className="fa-solid fa-envelope text-slate-600 text-xs"></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-slate-900 text-sm">Envío de Correos</p>
                                        <p className="text-xs text-slate-600 mt-0.5">Activo - Requerido para el sistema</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <span className="text-xs font-medium text-slate-700 bg-slate-200 border border-slate-300 px-2 py-1">
                                        Activo
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Sincronización (opcional) */}
                        <PermissionToggle
                            id="corp_sync"
                            label="Sincronización de Correos"
                            description="Captura automática de respuestas y comunicaciones en el sistema. Puede activarse o desactivarse según necesidad."
                            checked={tenantData.corporate_sync_emails || false}
                            isUpdating={false}
                            onChange={() => handleCorporativeToggle('corporate_sync_emails')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../contexts/AuthContext';
import { GATEWAY_CONFIG } from '../../services/gatewayConfig';
import { oauthRedirectUri } from '../../services/oauthConfig';
import { apiFetch } from '../../services/apiClient';
import { User } from '../../types';
import { useState } from 'react';

export const useCalendarPermission = (user: User) => {
    const { refreshUser } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const sendPermissionCodeToGateway = async (code: string, module: string) => {
        try {
            const response = await apiFetch(GATEWAY_CONFIG.AUTH.LOGIN, {
                method: 'POST',
                body: JSON.stringify({
                    code: code,
                    provider: 'google',
                    module: module,
                    redirect_uri: oauthRedirectUri,
                    app_id: 'crm',
                    user_id: user.id_user,
                    tenant_id: user.id_tenant,
                    email: user.email_user
                }),
            });

            if (!response.ok) throw new Error('No se pudo completar la solicitud.');
            
            // El backend activa automáticamente el permiso cuando recibe un código OAuth válido
            // refreshUser() obtiene el estado actualizado (sync_calendar: true)
            // Si previamente fue desactivado, ahora se reactiva
            await refreshUser();
            setToast({ message: 'Calendario conectado y sincronizado.', type: 'success' });
        } catch (error) {
            console.error('Error enviando permiso:', error);
            setToast({ message: 'Error al sincronizar calendario.', type: 'error' });
        }
    };

    const grantCalendar = useGoogleLogin({
        onSuccess: (codeResponse) => codeResponse.code && sendPermissionCodeToGateway(codeResponse.code, 'calendar_sync'),
        onError: () => setToast({ message: 'Error en Google Auth.', type: 'error' }),
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/calendar',
        include_granted_scopes: true,
        prompt: 'consent',
    });

    return { grantCalendar, toast, setToast };
};

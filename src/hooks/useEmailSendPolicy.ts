import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '../../types';
import { GATEWAY_CONFIG, buildUrl } from '../../services/gatewayConfig';

type EmailSendStatus = 'loading' | 'corporate' | 'personal' | 'blocked';

export interface EmailSendPolicy {
  status: EmailSendStatus;
  reason: string;
  senderLabel?: string;
  ctaPath?: string;
}

export const useEmailSendPolicy = (user?: User | null) => {
  const [tenantData, setTenantData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refreshTenant = useCallback(async () => {
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
        // Token inválido, pero no hacer logout - simplemente no actualizar
        console.log('⚠️ Token inválido en useEmailSendPolicy, esperando recarga...');
      }
    } catch (e) {
      console.error('Error loading tenant detail', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id_tenant]);

  useEffect(() => {
    refreshTenant();
  }, [refreshTenant]);

  useEffect(() => {
    const handleRefresh = () => refreshTenant();
    const handleFocus = () => refreshTenant();

    window.addEventListener('email-policy-updated', handleRefresh);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('email-policy-updated', handleRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshTenant]);

  const policy = useMemo<EmailSendPolicy>(() => {
    if (loading) {
      return {
        status: 'loading',
        reason: 'Validando configuracion de correo...'
      };
    }

    const hasCorporateEmail = !!tenantData?.corporate_email_address;
    const corporateEnabled = !!tenantData?.corporate_send_emails;
    const hasPersonalSend = !!user?.send_emails;

    if (hasCorporateEmail && corporateEnabled) {
      return {
        status: 'corporate',
        reason: 'Se enviara desde la cuenta corporativa.',
        senderLabel: 'Cuenta corporativa'
      };
    }

    if (hasPersonalSend) {
      return {
        status: 'personal',
        reason: 'Se enviara desde tu cuenta personal.',
        senderLabel: 'Cuenta personal'
      };
    }

    if (hasCorporateEmail && !corporateEnabled) {
      return {
        status: 'blocked',
        reason: 'El correo corporativo esta configurado pero desactivado. Activalo para enviar cotizaciones.',
        ctaPath: '/app/workspace-settings'
      };
    }

    return {
      status: 'blocked',
      reason: 'No hay correo corporativo activo ni permiso personal para enviar correos.',
      ctaPath: '/app/integrations'
    };
  }, [loading, tenantData, user?.send_emails]);

  return { policy, isLoading: loading, refreshTenant };
};

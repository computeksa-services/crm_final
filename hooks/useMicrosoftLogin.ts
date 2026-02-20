import { useCallback, useState } from 'react';
import { microsoftClientId, oauthRedirectUri } from '../services/oauthConfig';

interface UseMicrosoftLoginOptions {
  scope?: string;
  module?: string;
  prompt?: 'select_account' | 'consent' | 'none';
  onSuccess?: (response: { code: string; module?: string }) => void;
  onError?: (error: any) => void;
}

const microsoftScopes = {
  mail_send: 'Mail.Send offline_access',
  mail_sync: 'Mail.ReadWrite offline_access',
  calendar_sync: 'Calendars.ReadWrite offline_access',
  default: 'openid email profile offline_access'
};

// ✅ Generar PKCE code challenge
const generateCodeChallenge = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let codeVerifier = '';
  for (let i = 0; i < 128; i++) {
    codeVerifier += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  // Store in window for later retrieval
  (window as any).microsoftCodeVerifier = codeVerifier;
  
  return codeVerifier;
};

// ✅ Generar nonce
const generateNonce = () => {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  (window as any).microsoftNonce = nonce;
  return nonce;
};

// ✅ Generar state único por cada instancia del hook
const generateState = () => {
  const state = `ms_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return state;
};

export const useMicrosoftLogin = (options: UseMicrosoftLoginOptions = {}) => {
  const { scope = 'openid email profile offline_access User.Read', prompt = 'select_account', module, onSuccess, onError } = options;
  
  // ✅ Cada instancia del hook tiene su propio state único
  const [instanceState] = useState(() => generateState());

  const buildAuthUrl = useCallback(() => {
    const baseUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const redirectUrl = oauthRedirectUri || `${window.location.origin}/auth/callback`;

    const params = new URLSearchParams({
      client_id: microsoftClientId,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: scope,
      response_mode: 'query',
      prompt: prompt,
      nonce: generateNonce(), // ✅ AGREGADO
      state: instanceState, // ✅ Usar state único de esta instancia
    });

    return `${baseUrl}?${params.toString()}`;
  }, [scope, prompt, instanceState]);

  const registerMessageListener = useCallback(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      // ✅ IMPORTANTE: Solo procesar mensajes con el state de ESTA instancia específica
      if (event.data.state !== instanceState) {
        console.log(`[useMicrosoftLogin] Mensaje ignorado - state no coincide. Esperado: ${instanceState}, Recibido: ${event.data.state}`);
        return;
      }

      // Capturar ambos tipos de mensajes: AUTH_SUCCESS (de AuthCallbackPage) y MICROSOFT_AUTH_SUCCESS
      if ((event.data.type === 'AUTH_SUCCESS' || event.data.type === 'MICROSOFT_AUTH_SUCCESS') && event.data.provider === 'microsoft') {
        console.log(`[useMicrosoftLogin] Procesando mensaje con state: ${event.data.state}`);
        onSuccess?.({
          code: event.data.code,
          module: module
        });
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'MICROSOFT_AUTH_ERROR') {
        onError?.(event.data.error);
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceState, module, onSuccess, onError]);

  const trigger = useCallback(() => {
    const authUrl = buildAuthUrl();
    registerMessageListener();
    
    // Open popup window with persistent dimensions
    const width = 500;
    const height = 600;
    const left = Math.max(0, (window.innerWidth - width) / 2);
    const top = Math.max(0, (window.innerHeight - height) / 2);

    window.open(
      authUrl,
      'microsoft-oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }, [buildAuthUrl, registerMessageListener]);

  return trigger;
};

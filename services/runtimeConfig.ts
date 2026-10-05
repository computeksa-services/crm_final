const RAW: Record<string, string> = {
  VITE_WEBHOOK_URL: import.meta.env.VITE_WEBHOOK_URL || '',
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  VITE_MICROSOFT_CLIENT_ID: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  VITE_REDIRECT_URI: import.meta.env.VITE_REDIRECT_URI || '',
  VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  VITE_MICROSOFT_TENANT_ID: import.meta.env.VITE_MICROSOFT_TENANT_ID || '',
  VITE_MICROSOFT_CRM_CLIENT_ID: import.meta.env.VITE_MICROSOFT_CRM_CLIENT_ID || '',
};

declare global {
  interface Window {
    __APP_CONFIG__?: Record<string, string>;
  }
}

const injected = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

export const config: Record<string, string> = { ...RAW, ...injected };

export const getConfig = (key: string): string => config[key] || '';

export default config;
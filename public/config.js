// Valores por defecto para desarrollo local.
// En produccion este archivo lo regenera docker-entrypoint.sh con las
// variables de entorno del contenedor, asi que lo que hay aqui se ignora.
window.__APP_CONFIG__ = {
  VITE_WEBHOOK_URL: 'https://gateway.computeksa.com',
  VITE_GOOGLE_CLIENT_ID: '899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com',
  VITE_MICROSOFT_CLIENT_ID: 'f313a15a-a78b-4d15-ae88-9e236e62da04',
  VITE_REDIRECT_URI: 'https://crm.computeksa.com/auth/callback',
  VITE_GOOGLE_MAPS_API_KEY: '',
  VITE_MICROSOFT_TENANT_ID: '',
  VITE_MICROSOFT_CRM_CLIENT_ID: '',
};
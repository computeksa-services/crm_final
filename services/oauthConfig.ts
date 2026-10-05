import { getConfig } from './runtimeConfig';

export const googleClientId = getConfig('VITE_GOOGLE_CLIENT_ID');
export const microsoftClientId = getConfig('VITE_MICROSOFT_CLIENT_ID');
export const oauthRedirectUri = getConfig('VITE_REDIRECT_URI');

// Helper to know which providers are configured
export const enabledProviders = {
  google: Boolean(googleClientId),
  microsoft: Boolean(microsoftClientId),
};
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
export const oauthRedirectUri = import.meta.env.VITE_REDIRECT_URI || '';

// Helper to know which providers are configured
export const enabledProviders = {
  google: Boolean(googleClientId),
  microsoft: Boolean(microsoftClientId),
};

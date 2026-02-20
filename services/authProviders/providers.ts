// Estructura base para proveedores OAuth
// Agrega nuevos proveedores aquí sin modificar LoginPage

export interface OAuthProviderConfig {
  id: string;
  name: string;
  icon: string; // Nombre de clase Font Awesome o URL de imagen
  color: string; // Clase de color Tailwind
  enabled: boolean;
}

export interface OAuthProviderHandler {
  provider: string;
  trigger: () => void;
  isLoading: boolean;
}

// Configuración de proveedores disponibles
export const AUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google',
    icon: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
    color: 'text-red-500',
    enabled: true
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    color: 'text-blue-600',
    enabled: true
  },
  // Futuros proveedores (GitHub, LinkedIn, etc.)
  // github: { ... },
  // linkedin: { ... },
};

// Tipado para facilitar agregar proveedores
export type ProviderType = keyof typeof AUTH_PROVIDERS;

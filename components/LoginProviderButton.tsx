import React from 'react';
import { AUTH_PROVIDERS, ProviderType } from '../services/authProviders/providers';
import { ButtonLoader } from './AppLoaders';

interface LoginProviderButtonProps {
  provider: ProviderType;
  isLoading: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const LoginProviderButton: React.FC<LoginProviderButtonProps> = ({
  provider,
  isLoading,
  onClick,
  disabled = false
}) => {
  const config = AUTH_PROVIDERS[provider];

  if (!config || !config.enabled) return null;

  const isImage = config.icon.startsWith('http');

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      aria-label={isLoading ? `Conectando con ${config.name}` : `Continuar con ${config.name}`}
      className={`w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 dark:border-slate-400 rounded-lg shadow-sm bg-white dark:bg-slate-400 text-sm font-semibold text-slate-700 dark:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-300 transition ${
        isLoading ? 'opacity-70 cursor-wait' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isLoading ? <ButtonLoader size="sm" /> : isImage ? (
        <img src={config.icon} alt={config.name} className="w-5 h-5" />
      ) : (
        <i className={`${config.icon} ${config.color}`}></i>
      )}
      {!isLoading && `Continuar con ${config.name}`}
    </button>
  );
};

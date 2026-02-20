import { useGoogleLogin } from '@react-oauth/google';

interface GoogleAuthOptions {
  onSuccess?: (code: string) => void;
  onError?: (error: any) => void;
  scope?: string;
  module?: string;
}

export const useGoogleAuth = (options: GoogleAuthOptions = {}) => {
  const {
    scope = 'openid email profile',
    module,
    onSuccess,
    onError
  } = options;

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse: any) => {
      if (tokenResponse.code) {
        onSuccess?.(tokenResponse.code);
      }
    },
    onError: () => {
      onError?.({ message: 'Google authentication failed' });
    },
    flow: 'auth-code',
    scope: scope,
    access_type: 'offline',
    prompt: module ? 'consent' : 'none',
    include_granted_scopes: true
  });

  return googleLogin;
};

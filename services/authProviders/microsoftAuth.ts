import { useMicrosoftLogin } from '../../hooks/useMicrosoftLogin';

interface MicrosoftAuthOptions {
  onSuccess?: (code: string) => void;
  onError?: (error: any) => void;
  scope?: string;
  module?: string;
}

export const useMicrosoftAuth = (options: MicrosoftAuthOptions = {}) => {
  const {
    scope = 'openid profile email offline_access User.Read',
    module,
    onSuccess,
    onError
  } = options;

  const microsoftLogin = useMicrosoftLogin({
    scope: scope,
    module: module,
    onSuccess: (response) => {
      if (response.code) {
        onSuccess?.(response.code);
      }
    },
    onError: (error) => {
      onError?.(error);
    }
  });

  return microsoftLogin;
};

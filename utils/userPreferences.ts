import { UserPreferences, UserThemeMode, UserLanguage } from '../types';

export type UserPreferencesPatch = Partial<{
  general: Partial<UserPreferences['general']>;
  cartera: {
    mode?: UserPreferences['cartera']['mode'];
    reminder_days?: number;
    internal_alerts_enabled?: boolean;
    schedule?: Partial<UserPreferences['cartera']['schedule']>;
  };
  notifications: Partial<UserPreferences['notifications']>;
}>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  general: {
    theme: 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    language: 'es',
  },
  cartera: {
    mode: 'internal_first',
    reminder_days: 3,
    internal_alerts_enabled: true,
    schedule: {
      days: [1, 3, 5],
      time: '09:00',
    },
  },
  notifications: {
    deal_updates: true,
    marketing_alerts: false,
  },
};

export const normalizeUserPreferences = (input?: Partial<UserPreferences> | null): UserPreferences => {
  const safe = input || {};
  const safeGeneral: Partial<UserPreferences['general']> = safe.general || {};
  const safeCartera: Partial<UserPreferences['cartera']> = safe.cartera || {};
  const safeSchedule: Partial<UserPreferences['cartera']['schedule']> = safeCartera.schedule || {};
  const safeNotifications: Partial<UserPreferences['notifications']> = safe.notifications || {};

  const normalizedDays = Array.isArray(safeSchedule.days)
    ? [...new Set(safeSchedule.days.filter((day: unknown): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b)
    : DEFAULT_USER_PREFERENCES.cartera.schedule.days;

  return {
    general: {
      theme: normalizeThemeMode(safeGeneral.theme),
      timezone: typeof safeGeneral.timezone === 'string' && safeGeneral.timezone.trim()
        ? safeGeneral.timezone
        : DEFAULT_USER_PREFERENCES.general.timezone,
      language: normalizeLanguage(safeGeneral.language),
    },
    cartera: {
      mode: safeCartera.mode === 'auto_client' ? 'auto_client' : DEFAULT_USER_PREFERENCES.cartera.mode,
      reminder_days: Number.isFinite(Number(safeCartera.reminder_days))
        ? Math.max(0, Math.trunc(Number(safeCartera.reminder_days)))
        : DEFAULT_USER_PREFERENCES.cartera.reminder_days,
      internal_alerts_enabled: typeof safeCartera.internal_alerts_enabled === 'boolean'
        ? safeCartera.internal_alerts_enabled
        : DEFAULT_USER_PREFERENCES.cartera.internal_alerts_enabled,
      schedule: {
        days: normalizedDays.length > 0 ? normalizedDays : DEFAULT_USER_PREFERENCES.cartera.schedule.days,
        time: normalizeTime24h(safeSchedule.time) || DEFAULT_USER_PREFERENCES.cartera.schedule.time,
      },
    },
    notifications: {
      deal_updates: typeof safeNotifications.deal_updates === 'boolean'
        ? safeNotifications.deal_updates
        : DEFAULT_USER_PREFERENCES.notifications.deal_updates,
      marketing_alerts: typeof safeNotifications.marketing_alerts === 'boolean'
        ? safeNotifications.marketing_alerts
        : DEFAULT_USER_PREFERENCES.notifications.marketing_alerts,
    },
  };
};

export const mergeUserPreferences = (
  base: Partial<UserPreferences> | null | undefined,
  patch: UserPreferencesPatch,
): UserPreferences => {
  const current = normalizeUserPreferences(base);

  return normalizeUserPreferences({
    ...current,
    general: {
      ...current.general,
      ...(patch.general || {}),
    },
    cartera: {
      ...current.cartera,
      ...(patch.cartera || {}),
      schedule: {
        ...current.cartera.schedule,
        ...(patch.cartera?.schedule || {}),
      },
    },
    notifications: {
      ...current.notifications,
      ...(patch.notifications || {}),
    },
  });
};

export const applyThemePreference = (theme: UserThemeMode): void => {
  const shouldUseDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', shouldUseDark);
  localStorage.setItem('theme-mode', theme);
  localStorage.setItem('theme-dark', JSON.stringify(shouldUseDark));
};

export const applyLanguagePreference = (language: UserLanguage): void => {
  document.documentElement.lang = language;
  localStorage.setItem('app-language', language);
};

export const normalizeTime24h = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const isValidIanaTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

export const getAvailableTimezones = (): string[] => {
  const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
  if (Array.isArray(supported) && supported.length > 0) {
    return supported;
  }

  return [
    'UTC',
    'America/Guayaquil',
    'America/Bogota',
    'America/Mexico_City',
    'America/Santiago',
    'America/Argentina/Buenos_Aires',
    'America/New_York',
    'Europe/Madrid',
  ];
};

function normalizeThemeMode(theme: unknown): UserThemeMode {
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    return theme;
  }

  const legacyThemeDark = localStorage.getItem('theme-dark');
  if (legacyThemeDark !== null) {
    try {
      return JSON.parse(legacyThemeDark) ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  const storedThemeMode = localStorage.getItem('theme-mode');
  if (storedThemeMode === 'dark' || storedThemeMode === 'light' || storedThemeMode === 'system') {
    return storedThemeMode;
  }

  return DEFAULT_USER_PREFERENCES.general.theme;
}

function normalizeLanguage(language: unknown): UserLanguage {
  if (language === 'es' || language === 'en') {
    return language;
  }

  const stored = localStorage.getItem('app-language');
  if (stored === 'es' || stored === 'en') {
    return stored;
  }

  const htmlLang = document.documentElement.lang;
  if (htmlLang === 'es' || htmlLang === 'en') {
    return htmlLang;
  }

  return DEFAULT_USER_PREFERENCES.general.language;
}

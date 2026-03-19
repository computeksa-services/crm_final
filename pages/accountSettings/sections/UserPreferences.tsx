import React, { useEffect, useMemo, useState } from 'react';
import Toast from '../../../components/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/authService';
import { GATEWAY_CONFIG } from '../../../services/gatewayConfig';
import { UserPreferences as UserPreferencesType, UserThemeMode, UserLanguage, CarteraMode } from '../../../types';
import {
  getAvailableTimezones,
  isValidIanaTimezone,
  mergeUserPreferences,
  normalizeTime24h,
  normalizeUserPreferences,
  UserPreferencesPatch,
} from '../../../utils/userPreferences';
import { PermissionToggle } from '../../../src/components/users/PermissionToggle';

const WEEK_DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 7, label: 'D' },
];

const UserPreferences: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();

  const [preferences, setPreferences] = useState<UserPreferencesType>(() => normalizeUserPreferences(user?.preferences));
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const timezones = useMemo(() => getAvailableTimezones(), []);

  useEffect(() => {
    setPreferences(normalizeUserPreferences(user?.preferences));
  }, [user?.preferences]);

  const setUpdatingField = (key: string, value: boolean) => {
    setUpdating((prev) => ({ ...prev, [key]: value }));
  };

  const savePartialPreferences = async (fieldKey: string, patch: UserPreferencesPatch) => {
    if (updating[fieldKey]) return;

    const previous = preferences;
    const next = mergeUserPreferences(previous, patch);

    setPreferences(next);
    updateUserPreferences(patch);
    setUpdatingField(fieldKey, true);

    try {
      const appToken = authService.getToken();
      const response = await fetch(GATEWAY_CONFIG.API.USERS.UPDATE_PREFERENCES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appToken ? { Authorization: `Bearer ${appToken}` } : {}),
        },
        body: JSON.stringify({ preferences: patch }),
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar la preferencia.');
      }
    } catch (error) {
      setPreferences(previous);
      updateUserPreferences(previous);
      setToast({ message: 'No se pudo guardar el cambio. Se restauró el valor anterior.', type: 'error' });
    } finally {
      setUpdatingField(fieldKey, false);
    }
  };

  const handleThemeChange = (theme: UserThemeMode) => {
    savePartialPreferences('general.theme', { general: { theme } });
  };

  const handleTimezoneChange = (timezone: string) => {
    if (!isValidIanaTimezone(timezone)) {
      setToast({ message: 'La zona horaria seleccionada no es valida.', type: 'error' });
      return;
    }

    savePartialPreferences('general.timezone', { general: { timezone } });
  };

  const handleLanguageChange = (language: UserLanguage) => {
    savePartialPreferences('general.language', { general: { language } });
  };

  const handleNotificationToggle = (field: 'deal_updates' | 'marketing_alerts', value: boolean) => {
    savePartialPreferences(`notifications.${field}`, { notifications: { [field]: value } });
  };

  const handleCarteraEnabledToggle = (enabled: boolean) => {
    savePartialPreferences('cartera.internal_alerts_enabled', {
      cartera: { internal_alerts_enabled: enabled },
    });
  };

  const handleCarteraModeChange = (mode: CarteraMode) => {
    savePartialPreferences('cartera.mode', {
      cartera: { mode },
    });
  };

  const handleReminderDaysChange = (value: string) => {
    setPreferences((prev) => ({
      ...prev,
      cartera: {
        ...prev.cartera,
        reminder_days: value === '' ? 0 : Math.max(0, Math.trunc(Number(value) || 0)),
      },
    }));
  };

  const handleReminderDaysBlur = () => {
    const reminderDays = Math.max(0, Math.trunc(Number(preferences.cartera.reminder_days) || 0));
    savePartialPreferences('cartera.reminder_days', {
      cartera: { reminder_days: reminderDays },
    });
  };

  const handleScheduleDayToggle = (day: number) => {
    const currentDays = preferences.cartera.schedule.days;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : [...currentDays, day].sort((a, b) => a - b);

    if (nextDays.length === 0) {
      setToast({ message: 'Debe seleccionar al menos un dia para la programacion.', type: 'error' });
      return;
    }

    savePartialPreferences('cartera.schedule.days', {
      cartera: {
        schedule: {
          days: nextDays,
        },
      },
    });
  };

  const handleScheduleTimeChange = (value: string) => {
    setPreferences((prev) => ({
      ...prev,
      cartera: {
        ...prev.cartera,
        schedule: {
          ...prev.cartera.schedule,
          time: value,
        },
      },
    }));
  };

  const handleScheduleTimeBlur = () => {
    const normalized = normalizeTime24h(preferences.cartera.schedule.time);
    if (!normalized) {
      setToast({ message: 'La hora debe tener formato HH:mm (24h).', type: 'error' });
      setPreferences((prev) => ({
        ...prev,
        cartera: {
          ...prev.cartera,
          schedule: {
            ...prev.cartera.schedule,
            time: normalizeUserPreferences(prev).cartera.schedule.time,
          },
        },
      }));
      return;
    }

    savePartialPreferences('cartera.schedule.time', {
      cartera: {
        schedule: {
          time: normalized,
        },
      },
    });
  };

  if (!user) return null;

  return (
    <div className="w-full md:max-w-4xl space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-2">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Preferencias</h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Cambios en tiempo real. Cada ajuste se guarda automaticamente.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">General</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tema</label>
          <select
            value={preferences.general.theme}
            onChange={(e) => handleThemeChange(e.target.value as UserThemeMode)}
            disabled={updating['general.theme']}
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
            <option value="system">Sistema</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Zona Horaria</label>
          <select
            value={preferences.general.timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            disabled={updating['general.timezone']}
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
          >
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>{timezone}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Idioma</label>
          <select
            value={preferences.general.language}
            onChange={(e) => handleLanguageChange(e.target.value as UserLanguage)}
            disabled={updating['general.language']}
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 space-y-3">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">Notificaciones</h3>

        <PermissionToggle
          id="notifications-deal-updates"
          label="Actualizaciones de tratos"
          description="Recibir avisos cuando existan novedades en tratos asignados."
          checked={preferences.notifications.deal_updates}
          isUpdating={!!updating['notifications.deal_updates']}
          onChange={(checked) => handleNotificationToggle('deal_updates', checked)}
        />

        <PermissionToggle
          id="notifications-marketing-alerts"
          label="Alertas de marketing"
          description="Recibir avisos sobre ejecucion y resultados de campanas."
          checked={preferences.notifications.marketing_alerts}
          isUpdating={!!updating['notifications.marketing_alerts']}
          onChange={(checked) => handleNotificationToggle('marketing_alerts', checked)}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">Cartera</h3>

        <PermissionToggle
          id="cartera-internal-alerts"
          label="Alertas internas"
          description="Si se desactiva, se ocultan las reglas avanzadas de recordatorio."
          checked={preferences.cartera.internal_alerts_enabled}
          isUpdating={!!updating['cartera.internal_alerts_enabled']}
          onChange={handleCarteraEnabledToggle}
        />

        {preferences.cartera.internal_alerts_enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Avisar X dias antes del vencimiento
              </label>
              <input
                type="number"
                min={0}
                value={preferences.cartera.reminder_days}
                onChange={(e) => handleReminderDaysChange(e.target.value)}
                onBlur={handleReminderDaysBlur}
                disabled={!!updating['cartera.reminder_days']}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Modo de gestion</label>
              <select
                value={preferences.cartera.mode}
                onChange={(e) => handleCarteraModeChange(e.target.value as CarteraMode)}
                disabled={!!updating['cartera.mode']}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
              >
                <option value="internal_first">Avisarme a mi primero</option>
                <option value="auto_client">Enviar automatico al cliente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dias de programacion</label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const selected = preferences.cartera.schedule.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleScheduleDayToggle(day.value)}
                      disabled={!!updating['cartera.schedule.days']}
                      className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                          : 'bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hora de ejecucion</label>
              <input
                type="time"
                value={preferences.cartera.schedule.time}
                onChange={(e) => handleScheduleTimeChange(e.target.value)}
                onBlur={handleScheduleTimeBlur}
                disabled={!!updating['cartera.schedule.time']}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPreferences;

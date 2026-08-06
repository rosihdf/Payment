/** Lokale, nicht-sensible Schlüssel für Auto-Updateprüfung und Banner-Snooze. */
export const APP_UPDATE_PREFERENCE_KEYS = {
  lastCheckAt: 'app_update_last_check_at',
  snoozedVersion: 'app_update_snoozed_version',
  snoozedUntil: 'app_update_snoozed_until',
} as const;

export const APP_UPDATE_AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const APP_UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface AppUpdatePreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createLocalStoragePreferenceStore(): AppUpdatePreferenceStore {
  return {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Quota/Private Mode – Auto-Check bleibt ohne Persistenz möglich.
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export function readLastAutomaticCheckAt(store: AppUpdatePreferenceStore): number | null {
  const raw = store.getItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function shouldRunAutomaticCheck(
  store: AppUpdatePreferenceStore,
  nowMs: number,
  intervalMs: number = APP_UPDATE_AUTO_CHECK_INTERVAL_MS,
): boolean {
  const last = readLastAutomaticCheckAt(store);
  if (last == null) {
    return true;
  }
  return nowMs - last >= intervalMs;
}

export function recordAutomaticCheck(store: AppUpdatePreferenceStore, nowMs: number): void {
  store.setItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt, String(nowMs));
}

export function snoozeUpdateVersion(
  store: AppUpdatePreferenceStore,
  versionCode: number,
  nowMs: number,
  snoozeMs: number = APP_UPDATE_SNOOZE_MS,
): void {
  store.setItem(APP_UPDATE_PREFERENCE_KEYS.snoozedVersion, String(versionCode));
  store.setItem(APP_UPDATE_PREFERENCE_KEYS.snoozedUntil, String(nowMs + snoozeMs));
}

export function isUpdateVersionSnoozed(
  store: AppUpdatePreferenceStore,
  versionCode: number,
  nowMs: number,
): boolean {
  const snoozedVersionRaw = store.getItem(APP_UPDATE_PREFERENCE_KEYS.snoozedVersion);
  const snoozedUntilRaw = store.getItem(APP_UPDATE_PREFERENCE_KEYS.snoozedUntil);
  if (!snoozedVersionRaw || !snoozedUntilRaw) {
    return false;
  }
  const snoozedVersion = Number(snoozedVersionRaw);
  const snoozedUntil = Number(snoozedUntilRaw);
  if (!Number.isFinite(snoozedVersion) || !Number.isFinite(snoozedUntil)) {
    return false;
  }
  if (snoozedVersion !== versionCode) {
    return false;
  }
  return nowMs < snoozedUntil;
}

export function clearUpdateSnooze(store: AppUpdatePreferenceStore): void {
  store.removeItem(APP_UPDATE_PREFERENCE_KEYS.snoozedVersion);
  store.removeItem(APP_UPDATE_PREFERENCE_KEYS.snoozedUntil);
}

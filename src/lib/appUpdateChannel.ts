/** Updatekanal und versteckter Entwicklermodus (5×-Tap). */

export type AppUpdateChannel = 'production' | 'test';

export const APP_UPDATE_CHANNEL_KEY = 'app_update_channel';
export const APP_UPDATE_DEVELOPER_MODE_KEY = 'app_update_developer_mode';

export const ANDROID_UPDATE_MANIFEST_URL_PRODUCTION =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json';

export const ANDROID_UPDATE_MANIFEST_URL_TEST =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest-test.json';

export const DEVELOPER_MODE_TAP_COUNT = 5;
export const DEVELOPER_MODE_TAP_WINDOW_MS = 2500;

export function parseAppUpdateChannel(raw: string | null | undefined): AppUpdateChannel {
  return raw === 'test' ? 'test' : 'production';
}

export function readAppUpdateChannel(): AppUpdateChannel {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'production';
  try {
    return parseAppUpdateChannel(localStorage.getItem(APP_UPDATE_CHANNEL_KEY));
  } catch {
    return 'production';
  }
}

export function writeAppUpdateChannel(channel: AppUpdateChannel): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(APP_UPDATE_CHANNEL_KEY, channel);
  } catch {
    /* ignore */
  }
}

export function manifestUrlForChannel(channel: AppUpdateChannel): string {
  return channel === 'test'
    ? ANDROID_UPDATE_MANIFEST_URL_TEST
    : ANDROID_UPDATE_MANIFEST_URL_PRODUCTION;
}

export function readDeveloperModeEnabled(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(APP_UPDATE_DEVELOPER_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeDeveloperModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(APP_UPDATE_DEVELOPER_MODE_KEY, '1');
    } else {
      localStorage.removeItem(APP_UPDATE_DEVELOPER_MODE_KEY);
    }
  } catch {
    /* ignore */
  }
}

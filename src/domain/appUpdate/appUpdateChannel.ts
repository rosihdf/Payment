/** Updatekanal und Entwicklermodus – lokal, nicht sensibel. */
import type { AppUpdatePreferenceStore } from './appUpdatePreferences';

export const APP_UPDATE_CHANNEL_KEY = 'app_update_channel';
export const APP_UPDATE_DEVELOPER_MODE_KEY = 'app_update_developer_mode';

export type AppUpdateChannel = 'production' | 'test';

export const ANDROID_UPDATE_MANIFEST_URL_PRODUCTION =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json';

export const ANDROID_UPDATE_MANIFEST_URL_TEST =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest-test.json';

/** Kompatibilität: bisherige Produktions-URL. */
export const ANDROID_UPDATE_MANIFEST_URL = ANDROID_UPDATE_MANIFEST_URL_PRODUCTION;

export function parseAppUpdateChannel(raw: string | null | undefined): AppUpdateChannel {
  return raw === 'test' ? 'test' : 'production';
}

export function readAppUpdateChannel(store: AppUpdatePreferenceStore): AppUpdateChannel {
  return parseAppUpdateChannel(store.getItem(APP_UPDATE_CHANNEL_KEY));
}

export function writeAppUpdateChannel(
  store: AppUpdatePreferenceStore,
  channel: AppUpdateChannel,
): void {
  store.setItem(APP_UPDATE_CHANNEL_KEY, channel);
}

export function manifestUrlForChannel(channel: AppUpdateChannel): string {
  return channel === 'test'
    ? ANDROID_UPDATE_MANIFEST_URL_TEST
    : ANDROID_UPDATE_MANIFEST_URL_PRODUCTION;
}

export function readDeveloperModeEnabled(store: AppUpdatePreferenceStore): boolean {
  return store.getItem(APP_UPDATE_DEVELOPER_MODE_KEY) === '1';
}

export function writeDeveloperModeEnabled(store: AppUpdatePreferenceStore, enabled: boolean): void {
  if (enabled) {
    store.setItem(APP_UPDATE_DEVELOPER_MODE_KEY, '1');
  } else {
    store.removeItem(APP_UPDATE_DEVELOPER_MODE_KEY);
  }
}

export const DEVELOPER_MODE_TAP_COUNT = 5;
export const DEVELOPER_MODE_TAP_WINDOW_MS = 2500;

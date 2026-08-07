import { describe, expect, it } from 'vitest';
import {
  ANDROID_UPDATE_MANIFEST_URL_PRODUCTION,
  ANDROID_UPDATE_MANIFEST_URL_TEST,
  DEVELOPER_MODE_TAP_COUNT,
} from '../domain/appUpdate/appUpdateChannel';
import type { AppUpdatePreferenceStore } from '../domain/appUpdate/appUpdatePreferences';
import { AppUpdateService } from '../services/appUpdateService';

function memoryStore(): AppUpdatePreferenceStore {
  const data: Record<string, string> = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('AppUpdateChannel', () => {
  it('Produktion nutzt latest.json, Test nutzt latest-test.json', async () => {
    const store = memoryStore();
    const urls: string[] = [];
    const service = new AppUpdateService({
      installedVersionCode: 10009,
      installedVersionName: '1.0.9',
      isNativeAndroidFn: () => true,
      preferenceStore: store,
      log: () => undefined,
      apkInstaller: {
        openFromCache: async () => undefined,
        openUnknownSourcesSettings: async () => undefined,
        getInstalledVersion: async () => ({ versionName: '1.0.9', versionCode: 10009 }),
      },
      fetchImpl: async (input) => {
        urls.push(String(input));
        return new Response(
          JSON.stringify({
            versionName: '1.0.10-ppA',
            versionCode: 10010,
            minimumVersionCode: 10000,
            mandatory: false,
            downloadUrl:
              'https://amrtech-payment-downloads.amrtech.workers.dev/android/play-protect-test/ppA/AMRtech-Payment-ppA.apk',
            sha256: 'a'.repeat(64),
            sizeBytes: 4,
            publishedAt: '2026-08-07T00:00:00.000Z',
            releaseNotes: 'test',
            releaseTag: 'ppA',
            sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          }),
          { status: 200 },
        );
      },
    });

    expect(service.getUpdateChannel()).toBe('production');
    await service.checkForUpdate({ manual: true });
    expect(urls.at(-1)).toBe(ANDROID_UPDATE_MANIFEST_URL_PRODUCTION);

    await service.setUpdateChannel('test');
    expect(store.getItem('app_update_channel')).toBe('test');
    expect(service.getSnapshot().updateChannel).toBe('test');
    expect(service.getSnapshot().manifest).toBeNull();

    await service.checkForUpdate({ manual: true });
    expect(urls.at(-1)).toBe(ANDROID_UPDATE_MANIFEST_URL_TEST);
    expect(service.getSnapshot().status).toBe('available');
  });

  it('Kanal bleibt nach Reload erhalten', () => {
    const store = memoryStore();
    store.setItem('app_update_channel', 'test');
    const service = new AppUpdateService({
      preferenceStore: store,
      isNativeAndroidFn: () => true,
      log: () => undefined,
    });
    expect(service.getUpdateChannel()).toBe('test');
  });

  it('Testkanal deaktivieren setzt Produktion und löscht State', async () => {
    const store = memoryStore();
    const service = new AppUpdateService({
      preferenceStore: store,
      updateChannel: 'test',
      developerModeEnabled: true,
      isNativeAndroidFn: () => true,
      log: () => undefined,
    });
    service.enableDeveloperMode();
    await service.deactivateTestChannel();
    expect(service.getUpdateChannel()).toBe('production');
    expect(service.isDeveloperModeEnabled()).toBe(true);
    expect(store.getItem('app_update_channel')).toBe('production');
  });

  it('Entwicklermodus ist standardmäßig aus', () => {
    const service = new AppUpdateService({
      preferenceStore: memoryStore(),
      isNativeAndroidFn: () => true,
      log: () => undefined,
    });
    expect(service.isDeveloperModeEnabled()).toBe(false);
    service.enableDeveloperMode();
    expect(service.isDeveloperModeEnabled()).toBe(true);
    expect(DEVELOPER_MODE_TAP_COUNT).toBe(5);
  });
});

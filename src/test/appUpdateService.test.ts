import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppUpdatePreferenceStore } from '../domain/appUpdate/appUpdatePreferences';
import {
  deriveUpdateStatus,
  parseUpdateManifest,
} from '../domain/appUpdate/updateManifest';
import type { ApkCacheWriter } from '../native/apkUpdateNative';
import { AppUpdateService } from '../services/appUpdateService';

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: '1.0.7',
    versionCode: 10007,
    minimumVersionCode: 10000,
    mandatory: false,
    downloadUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.7/AMRtech-Payment-1.0.7.apk',
    sha256: 'a'.repeat(64),
    sizeBytes: 4,
    publishedAt: '2026-08-06T17:00:00.000Z',
    releaseNotes: 'Nativer In-App-Update.',
    releaseTag: 'v1.0.7',
    sourceCommit: '6720132bdb8d0b5403c3a0cf29aa8a819b9a0756',
    ...overrides,
  };
}

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

function memoryCache(): ApkCacheWriter & { files: Map<string, ArrayBuffer> } {
  const files = new Map<string, ArrayBuffer>();
  return {
    files,
    async write(path, data) {
      files.set(path, data);
    },
    async delete(path) {
      files.delete(path);
    },
  };
}

function createService(options: ConstructorParameters<typeof AppUpdateService>[0] = {}) {
  return new AppUpdateService({
    installedVersionName: '1.0.6',
    installedVersionCode: 10006,
    isNativeAndroidFn: () => true,
    log: () => undefined,
    preferenceStore: memoryStore(),
    apkCache: memoryCache(),
    apkInstaller: {
      openFromCache: async () => undefined,
      openUnknownSourcesSettings: async () => undefined,
    },
    ...options,
  });
}

describe('AppUpdate Manifest', () => {
  it('leitet optionales, Pflicht- und aktuelles Update korrekt ab', () => {
    const optional = parseUpdateManifest(validManifest());
    expect(optional.ok && deriveUpdateStatus(10006, optional.manifest)).toBe('available');

    const mandatoryFlag = parseUpdateManifest(validManifest({ mandatory: true }));
    expect(mandatoryFlag.ok && deriveUpdateStatus(10006, mandatoryFlag.manifest)).toBe('mandatory');

    const current = parseUpdateManifest(validManifest({ versionCode: 10006 }));
    expect(current.ok && deriveUpdateStatus(10006, current.manifest)).toBe('current');
  });
});

describe('AppUpdateService native install', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('startet idle und prüft manuell auf Update', async () => {
    const service = createService({
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });
    expect(service.getSnapshot().status).toBe('idle');
    const snap = await service.checkForUpdate({ manual: true });
    expect(snap.status).toBe('available');
  });

  it('führt Auto-Check nur wenn Intervall abgelaufen', async () => {
    const store = memoryStore();
    let nowMs = 10_000;
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    );
    const service = createService({
      preferenceStore: store,
      nowMs: () => nowMs,
      fetchImpl,
    });
    await service.checkForUpdate({ automatic: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await service.checkForUpdate({ automatic: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    nowMs += 24 * 60 * 60 * 1000;
    await service.checkForUpdate({ automatic: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('snoozed Banner, lässt App-Info-Status available', async () => {
    const service = createService({
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });
    await service.checkForUpdate();
    expect(service.shouldShowOptionalBanner()).toBe(true);
    service.dismissOptionalUpdate();
    expect(service.shouldShowOptionalBanner()).toBe(false);
    expect(service.getSnapshot().status).toBe('available');
    expect(service.getSnapshot().optionalDismissed).toBe(true);
  });

  it('höhere Version ignoriert alte Snooze-Version', async () => {
    const store = memoryStore();
    const nowMs = 2_000_000;
    store.setItem('app_update_snoozed_version', '10007');
    store.setItem('app_update_snoozed_until', String(nowMs + 86_400_000));
    const service = createService({
      preferenceStore: store,
      nowMs: () => nowMs,
      fetchImpl: async () =>
        new Response(
          JSON.stringify(validManifest({ versionCode: 10008, versionName: '1.0.8' })),
          { status: 200 },
        ),
    });
    await service.checkForUpdate();
    expect(service.shouldShowOptionalBanner()).toBe(true);
  });

  it('lädt nativ herunter, prüft SHA und öffnet Installer – kein Browser', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const openUrl = vi.fn();
    const openFromCache = vi.fn(async () => undefined);
    const cache = memoryCache();
    const service = createService({
      openUrl,
      apkCache: cache,
      apkInstaller: {
        openFromCache,
        openUnknownSourcesSettings: async () => undefined,
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('latest.json')) {
          return new Response(
            JSON.stringify(
              validManifest({
                sha256,
                sizeBytes: bytes.byteLength,
                downloadUrl: 'https://example.com/app.apk',
              }),
            ),
            { status: 200 },
          );
        }
        return new Response(bytes, { status: 200 });
      },
    });

    await service.checkForUpdate();
    const result = await service.startInstall();
    expect(result.ok).toBe(true);
    expect(openUrl).not.toHaveBeenCalled();
    expect(openFromCache).toHaveBeenCalledTimes(1);
    expect([...cache.files.keys()][0]).toContain('AMRtech-Payment-1.0.7.apk');
    expect(service.getSnapshot().status).toBe('readyToInstall');
  });

  it('blockiert Installation bei SHA-Fehler und löscht Datei', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const openFromCache = vi.fn();
    const cache = memoryCache();
    const service = createService({
      apkCache: cache,
      apkInstaller: { openFromCache, openUnknownSourcesSettings: async () => undefined },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('latest.json')) {
          return new Response(
            JSON.stringify(
              validManifest({
                sha256: 'b'.repeat(64),
                sizeBytes: bytes.byteLength,
                downloadUrl: 'https://example.com/app.apk',
              }),
            ),
            { status: 200 },
          );
        }
        return new Response(bytes, { status: 200 });
      },
    });
    await service.checkForUpdate();
    const result = await service.startInstall();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/überprüft/i);
    }
    expect(openFromCache).not.toHaveBeenCalled();
    expect(cache.files.size).toBe(0);
    expect(service.getSnapshot().status).toBe('error');
  });

  it('verhindert parallele Installationen', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    let inflight = 0;
    let max = 0;
    const service = createService({
      apkInstaller: {
        openFromCache: async () => {
          inflight += 1;
          max = Math.max(max, inflight);
          await new Promise((r) => setTimeout(r, 30));
          inflight -= 1;
        },
        openUnknownSourcesSettings: async () => undefined,
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('latest.json')) {
          return new Response(
            JSON.stringify(
              validManifest({
                sha256,
                sizeBytes: bytes.byteLength,
                downloadUrl: 'https://example.com/app.apk',
              }),
            ),
            { status: 200 },
          );
        }
        await new Promise((r) => setTimeout(r, 20));
        return new Response(bytes, { status: 200 });
      },
    });
    await service.checkForUpdate();
    await Promise.all([service.startInstall(), service.startInstall()]);
    expect(max).toBe(1);
  });

  it('ruft Browser-Fallback nur explizit auf', async () => {
    const openUrl = vi.fn();
    const service = createService({
      openUrl,
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });
    await service.checkForUpdate();
    expect(openUrl).not.toHaveBeenCalled();
    service.openBrowserFallback();
    expect(openUrl).toHaveBeenCalledTimes(1);
  });

  it('Web/PWA: kein Fetch und kein Banner', async () => {
    const fetchImpl = vi.fn();
    const service = createService({
      isNativeAndroidFn: () => false,
      fetchImpl,
    });
    expect(service.shouldAutoCheck()).toBe(false);
    await service.checkForUpdate({ automatic: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(service.shouldShowOptionalBanner()).toBe(false);
  });

  it('Installer-Abbruch lässt readyToInstall bestehen', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const openFromCache = vi.fn(async () => undefined);
    const service = createService({
      apkInstaller: {
        openFromCache,
        openUnknownSourcesSettings: async () => undefined,
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('latest.json')) {
          return new Response(
            JSON.stringify(
              validManifest({
                sha256,
                sizeBytes: bytes.byteLength,
                downloadUrl: 'https://example.com/app.apk',
              }),
            ),
            { status: 200 },
          );
        }
        return new Response(bytes, { status: 200 });
      },
    });
    await service.checkForUpdate();
    await service.startInstall();
    expect(service.getSnapshot().status).toBe('readyToInstall');
    const again = await service.openInstaller();
    expect(again.ok).toBe(true);
    expect(service.getSnapshot().status).toBe('readyToInstall');
    expect(openFromCache).toHaveBeenCalledTimes(2);
  });
});

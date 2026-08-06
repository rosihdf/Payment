import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deriveUpdateStatus,
  parseUpdateManifest,
} from '../domain/appUpdate/updateManifest';
import { AppUpdateService } from '../services/appUpdateService';

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    versionName: '1.0.1',
    versionCode: 10001,
    minimumVersionCode: 10000,
    mandatory: false,
    downloadUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.1/AMRtech-Payment-1.0.1.apk',
    sha256: 'a'.repeat(64),
    sizeBytes: 11166182,
    publishedAt: '2026-08-02T20:00:00.000Z',
    releaseNotes: 'Native Updateprüfung und Downloadhinweis.',
    releaseTag: 'android-1.0.1',
    sourceCommit: '4a8d369a8245592b7d74cab481e3872289cc0f54',
    ...overrides,
  };
}

function createService(options: ConstructorParameters<typeof AppUpdateService>[0] = {}) {
  return new AppUpdateService({
    installedVersionName: '1.0.0',
    installedVersionCode: 10000,
    isNativeAndroidFn: () => true,
    log: () => undefined,
    ...options,
  });
}

describe('AppUpdate Manifest', () => {
  it('akzeptiert vollständige HTTPS-Manifeste', () => {
    const parsed = parseUpdateManifest(validManifest());
    expect(parsed.ok).toBe(true);
  });

  it('akzeptiert Produktionsform mit tag statt releaseTag und ohne publishedAt', () => {
    const { releaseTag: _ignored, publishedAt: _p, ...rest } = validManifest();
    const parsed = parseUpdateManifest({ ...rest, tag: 'v1.0.4' });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.manifest.releaseTag).toBe('v1.0.4');
      expect(parsed.manifest.publishedAt).toBeTruthy();
    }
  });

  it('lehnt unvollständige Manifeste ab', () => {
    const parsed = parseUpdateManifest({ versionName: '1.0.1' });
    expect(parsed.ok).toBe(false);
  });

  it('blockiert HTTP-Download-URLs', () => {
    const parsed = parseUpdateManifest(
      validManifest({ downloadUrl: 'http://example.com/app.apk' }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.some((issue) => /HTTPS/i.test(issue))).toBe(true);
    }
  });

  it('leitet optionales, Pflicht- und aktuelles Update korrekt ab', () => {
    const optional = parseUpdateManifest(validManifest());
    expect(optional.ok && deriveUpdateStatus(10000, optional.manifest)).toBe('available');

    const mandatoryFlag = parseUpdateManifest(validManifest({ mandatory: true }));
    expect(mandatoryFlag.ok && deriveUpdateStatus(10000, mandatoryFlag.manifest)).toBe('mandatory');

    const minCode = parseUpdateManifest(
      validManifest({ mandatory: false, minimumVersionCode: 10001, versionCode: 10001 }),
    );
    expect(minCode.ok && deriveUpdateStatus(10000, minCode.manifest)).toBe('mandatory');

    const older = parseUpdateManifest(validManifest({ versionCode: 9999, minimumVersionCode: 1 }));
    expect(older.ok && deriveUpdateStatus(10000, older.manifest)).toBe('current');

    const current = parseUpdateManifest(validManifest({ versionCode: 10000 }));
    expect(current.ok && deriveUpdateStatus(10000, current.manifest)).toBe('current');
  });
});

describe('AppUpdateService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('meldet aktuelle Version', async () => {
    const service = createService({
      installedVersionCode: 10001,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ versionCode: 10001 })), { status: 200 }),
    });
    const snapshot = await service.checkForUpdate();
    expect(snapshot.status).toBe('current');
  });

  it('erkennt optionale neue Version', async () => {
    const service = createService({
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });
    const snapshot = await service.checkForUpdate();
    expect(snapshot.status).toBe('available');
    expect(snapshot.manifest?.versionName).toBe('1.0.1');
  });

  it('erzwingt Pflichtupdate per mandatory und minimumVersionCode', async () => {
    const byFlag = createService({
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });
    expect((await byFlag.checkForUpdate()).status).toBe('mandatory');

    const byMin = createService({
      fetchImpl: async () =>
        new Response(
          JSON.stringify(validManifest({ mandatory: false, minimumVersionCode: 10001 })),
          { status: 200 },
        ),
    });
    expect((await byMin.checkForUpdate()).status).toBe('mandatory');
  });

  it('ignoriert ältere Remote-Versionen', async () => {
    const service = createService({
      installedVersionCode: 10001,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ versionCode: 10000, minimumVersionCode: 1 })), {
          status: 200,
        }),
    });
    expect((await service.checkForUpdate()).status).toBe('current');
  });

  it('setzt error bei ungültigem Manifest und Timeout', async () => {
    const invalid = createService({
      fetchImpl: async () => new Response(JSON.stringify({ versionName: 'x' }), { status: 200 }),
    });
    const invalidSnapshot = await invalid.checkForUpdate();
    expect(invalidSnapshot.status).toBe('error');
    expect(invalidSnapshot.errorMessage).toMatch(/ungültig/i);

    const timeout = createService({
      timeoutMs: 5,
      fetchImpl: () =>
        new Promise((_, reject) => {
          const error = new DOMException('Aborted', 'AbortError');
          setTimeout(() => reject(error), 1);
        }),
    });
    const timeoutSnapshot = await timeout.checkForUpdate();
    expect(timeoutSnapshot.status).toBe('error');
    expect(timeoutSnapshot.errorMessage).toMatch(/Zeitüberschreitung/i);
  });

  it('setzt offline nur bei explizit fehlender Verbindung', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const offline = createService({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const offlineSnapshot = await offline.checkForUpdate();
    expect(offlineSnapshot.status).toBe('offline');
    expect(offlineSnapshot.errorMessage).toMatch(/Internetverbindung/i);

    vi.stubGlobal('navigator', { onLine: true });
    const corsOrNetwork = createService({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const errorSnapshot = await corsOrNetwork.checkForUpdate();
    expect(errorSnapshot.status).toBe('error');
    expect(errorSnapshot.errorMessage).toMatch(/konnten nicht geladen werden/i);
    expect(errorSnapshot.errorMessage).not.toMatch(/^Offline/i);
  });

  it('versucht Fetch auch wenn navigator.onLine false ist und akzeptiert Erfolg', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const service = createService({
      installedVersionCode: 10001,
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ versionCode: 10001 })), { status: 200 }),
    });
    const snapshot = await service.checkForUpdate();
    expect(snapshot.status).toBe('current');
    expect(snapshot.errorMessage).toBeNull();
  });

  it('meldet HTTP- und JSON-Fehler verständlich', async () => {
    const http404 = createService({
      fetchImpl: async () => new Response('nope', { status: 404 }),
    });
    expect((await http404.checkForUpdate()).errorMessage).toMatch(/Update-Server nicht erreichbar/i);

    const http500 = createService({
      fetchImpl: async () => new Response('nope', { status: 500 }),
    });
    expect((await http500.checkForUpdate()).errorMessage).toMatch(/Update-Server nicht erreichbar/i);

    const badJson = createService({
      fetchImpl: async () =>
        new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    expect((await badJson.checkForUpdate()).errorMessage).toMatch(/ungültig/i);

    const missingCode = createService({
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ versionCode: undefined })), { status: 200 }),
    });
    expect((await missingCode.checkForUpdate()).errorMessage).toMatch(/ungültig/i);

    const missingUrl = createService({
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ downloadUrl: '' })), { status: 200 }),
    });
    expect((await missingUrl.checkForUpdate()).errorMessage).toMatch(/ungültig/i);
  });

  it('beendet busy/checkPromise immer und erlaubt erneute Prüfung', async () => {
    let calls = 0;
    const service = createService({
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          throw new TypeError('Failed to fetch');
        }
        return new Response(JSON.stringify(validManifest({ versionCode: 10000 })), { status: 200 });
      },
    });
    vi.stubGlobal('navigator', { onLine: true });
    const first = await service.checkForUpdate();
    expect(first.status).toBe('error');
    const second = await service.checkForUpdate();
    expect(second.status).toBe('current');
    expect(calls).toBe(2);
  });

  it('prüft nur native Android automatisch; Web/PWA nicht', async () => {
    const web = createService({
      isNativeAndroidFn: () => false,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(validManifest()), { status: 200 })),
    });
    expect(web.shouldAutoCheck()).toBe(false);
    const webSnapshot = await web.checkForUpdate();
    expect(webSnapshot.status).toBe('current');
    expect(webSnapshot.isNativeAndroid).toBe(false);

    const native = createService({
      isNativeAndroidFn: () => true,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(validManifest()), { status: 200 })),
    });
    expect(native.shouldAutoCheck()).toBe(true);
    await native.checkForUpdate();
    expect(native.getSnapshot().status).toBe('available');
  });

  it('öffnet Download nur nach erfolgreicher Hashprüfung', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const openUrl = vi.fn();
    const service = createService({
      openUrl,
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
    const result = await service.openVerifiedDownload();
    expect(result.ok).toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://example.com/app.apk');
  });

  it('erlaubt Später nur bei optionalem Update', async () => {
    const optional = createService({
      fetchImpl: async () => new Response(JSON.stringify(validManifest()), { status: 200 }),
    });
    await optional.checkForUpdate();
    optional.dismissOptionalUpdate();
    expect(optional.getSnapshot().optionalDismissed).toBe(true);

    const mandatory = createService({
      fetchImpl: async () =>
        new Response(JSON.stringify(validManifest({ mandatory: true })), { status: 200 }),
    });
    await mandatory.checkForUpdate();
    mandatory.dismissOptionalUpdate();
    expect(mandatory.getSnapshot().optionalDismissed).toBe(false);
  });
});

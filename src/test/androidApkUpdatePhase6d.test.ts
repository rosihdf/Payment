import { Buffer } from 'node:buffer';

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

vi.mock('../lib/appUpdateInstaller', () => ({
  AppUpdateInstaller: {
    canInstallPackages: vi.fn(async () => ({ canInstall: true })),
    openInstallPermissionSettings: vi.fn(async () => undefined),
    openApkFromCacheRelativePath: vi.fn(),
  },
}));

{
  type GWithBtoa = typeof globalThis & { btoa?: (bin: string) => string };
  const g = globalThis as GWithBtoa;
  if (typeof g.btoa !== 'function') {
    g.btoa = (data: string) => Buffer.from(data, 'latin1').toString('base64');
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import {
  ANDROID_APK_INTERNAL_SUBDIR,
  ANDROID_FALLBACK_APK_URL,
  ANDROID_UPDATE_MANIFEST_DEFAULT_URL,
  appendManifestFetchCacheBuster,
  compareAndroidInstallToManifest,
  downloadAndroidApkToCache,
  isUnsafeAndroidCacheRelativePath,
  parseAndroidLatestManifest,
  resetAndroidApkDownloadInFlightForTests,
  resolveAndroidInternalApkRelativePath,
  resolveAndroidUpdateManifestUrl,
  shouldOfferAndroidNativeApkInstall,
  validateDownloadedApkBuffer,
  validateParsedAndroidLatestManifest,
} from '../lib/androidApkUpdate';
import {
  resetAndroidInstallFlowInFlightForTests,
  runAndroidNativeApkInstallFlow,
} from '../lib/androidApkInstallFlow';
import { AppUpdateInstaller } from '../lib/appUpdateInstaller';
import { evaluateAndroidApkUpdateBannerVisibility } from '../lib/androidApkUpdateBanner';
import { shouldRunAndroidApkUpdateCheck } from '../lib/androidApkUpdateCheckPolicy';

const installed = () => ({
  bundleSemver: '1.0.27',
  nativeVersionCode: 10043 as number | null,
  nativeVersionName: '1.0.27',
});

const pkApkBuffer = (size = 600 * 1024): ArrayBuffer => {
  const buf = new Uint8Array(size);
  buf[0] = 0x50;
  buf[1] = 0x4b;
  buf[2] = 0x03;
  buf[3] = 0x04;
  return buf.buffer;
};

afterEach(() => {
  resetAndroidApkDownloadInFlightForTests();
  resetAndroidInstallFlowInFlightForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Phase 6A Android updater U1–U12', () => {
  it('U1: remote versionCode <= installed → kein natives Update', () => {
    expect(shouldOfferAndroidNativeApkInstall(installed(), { versionCode: 10043 })).toBe(false);
    expect(shouldOfferAndroidNativeApkInstall(installed(), { versionCode: 10000 })).toBe(false);
    expect(compareAndroidInstallToManifest(installed(), { versionCode: 10043 }).kind).toBe('current');
  });

  it('U2: remote > installed → Update verfügbar', () => {
    expect(shouldOfferAndroidNativeApkInstall(installed(), { versionCode: 10044 })).toBe(true);
    expect(compareAndroidInstallToManifest(installed(), { versionCode: 10044 }).kind).toBe('newer');
  });

  it('U3: fetch erfolgreich → Cache Write → genau 1 Installer-Aufruf', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'writeFile').mockResolvedValue(undefined as never);
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pkApkBuffer(), {
        status: 200,
        headers: { 'content-type': 'application/vnd.android.package-archive' },
      }),
    );
    const openInstaller = vi.spyOn(AppUpdateInstaller, 'openApkFromCacheRelativePath').mockResolvedValue();

    const manifest = { versionCode: 20000, apkUrl: 'https://example.test/app.apk' };
    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(true);
    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(openInstaller).toHaveBeenCalledTimes(1);
  });

  it('U4: SHA mismatch → kein Installer', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pkApkBuffer(), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const openInstaller = vi.spyOn(AppUpdateInstaller, 'openApkFromCacheRelativePath').mockResolvedValue();

    const manifest = {
      versionCode: 20000,
      apkUrl: 'https://example.test/app.apk',
      sha256: 'a'.repeat(64),
    };
    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/Prüfsumme/i);
    expect(openInstaller).not.toHaveBeenCalled();
  });

  it('U5: HTTP Fehler → kein Installer', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const openInstaller = vi.spyOn(AppUpdateInstaller, 'openApkFromCacheRelativePath').mockResolvedValue();

    const res = await runAndroidNativeApkInstallFlow({ versionCode: 20000, apkUrl: 'https://example.test/x.apk' });
    expect(res.ok).toBe(false);
    expect(openInstaller).not.toHaveBeenCalled();
  });

  it('U6: Download Doppelklick → ein paralleler Download', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(Filesystem, 'writeFile').mockResolvedValue(undefined as never);

    let resolveFetch!: () => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = () =>
        resolve(
          new Response(pkApkBuffer(), {
            status: 200,
            headers: { 'content-type': 'application/octet-stream' },
          }),
        );
    });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(fetchPromise as Promise<Response>);

    const manifest = { versionCode: 20000, apkUrl: 'https://example.test/app.apk' };
    const p1 = downloadAndroidApkToCache({ apkUrl: manifest.apkUrl!, manifest });
    const p2 = downloadAndroidApkToCache({ apkUrl: manifest.apkUrl!, manifest });
    await expect(p2).rejects.toMatchObject({ code: 'download_in_progress' });
    resolveFetch();
    await p1;
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('U7: Unknown Sources false → Permission-Flow-Meldung', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(Filesystem, 'writeFile').mockResolvedValue(undefined as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pkApkBuffer(), { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
    );
    vi.spyOn(AppUpdateInstaller, 'openApkFromCacheRelativePath').mockRejectedValue(
      new Error(
        'install_source_blocked: Erlaube Installation aus dieser Quelle für AMRtech Payment in den Einstellungen.',
      ),
    );

    const res = await runAndroidNativeApkInstallFlow({ versionCode: 20000, apkUrl: 'https://example.test/a.apk' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/Einstellungen/i);
  });

  it('U8: Unknown Sources true → Installer wird aufgerufen', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(Filesystem, 'readFile').mockRejectedValue(new Error('missing'));
    vi.spyOn(Filesystem, 'writeFile').mockResolvedValue(undefined as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pkApkBuffer(), { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
    );
    const openInstaller = vi.spyOn(AppUpdateInstaller, 'openApkFromCacheRelativePath').mockResolvedValue();

    const res = await runAndroidNativeApkInstallFlow({ versionCode: 20000, apkUrl: 'https://example.test/a.apk' });
    expect(res.ok).toBe(true);
    expect(openInstaller).toHaveBeenCalledTimes(1);
  });

  it('U9: FileProvider path traversal → blockiert', () => {
    expect(isUnsafeAndroidCacheRelativePath('../etc/passwd')).toBe(true);
    expect(isUnsafeAndroidCacheRelativePath('/abs.apk')).toBe(true);
    expect(
      isUnsafeAndroidCacheRelativePath(`${ANDROID_APK_INTERNAL_SUBDIR}/amrtech-payment-update-7.apk`),
    ).toBe(false);
  });

  it('U10: keine DownloadManager-/Receiver-Klassen im Quellcode', async () => {
    const { execSync } = await import('node:child_process');
    const androidOut = execSync(
      'rg -l "DownloadManager|AppUpdateDownloadCompleteReceiver|AppUpdateInstallCoordinator|ACTION_DOWNLOAD_COMPLETE" android/app/src || true',
      { cwd: process.cwd(), encoding: 'utf8' },
    ).trim();
    const srcOut = execSync(
      'rg -l "AppUpdateDownloadCompleteReceiver|AppUpdateInstallCoordinator|ACTION_DOWNLOAD_COMPLETE" src --glob "!**/*.test.*" --glob "!**/androidApkUpdate.ts" || true',
      { cwd: process.cwd(), encoding: 'utf8' },
    ).trim();
    expect(androidOut).toBe('');
    expect(srcOut).toBe('');
  });

  it('U11: REQUEST_INSTALL_PACKAGES im AndroidManifest', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toContain('android.permission.REQUEST_INSTALL_PACKAGES');
  });

  it('U12: FileProvider korrekt im Manifest', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toContain('androidx.core.content.FileProvider');
    expect(manifest).toContain('android:grantUriPermissions="true"');
    expect(manifest).toContain('android:exported="false"');
    expect(readFileSync('android/app/src/main/res/xml/file_paths.xml', 'utf8')).toContain('<cache-path');
  });
});

describe('Payment manifest parsing & validation', () => {
  it('parst versionName/downloadUrl/sha256 Aliase', () => {
    expect(
      parseAndroidLatestManifest({
        versionName: '1.0.28',
        versionCode: 10044,
        downloadUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
        sha256: 'A'.repeat(64),
        mandatory: true,
        sourceCommit: 'abc123',
      }),
    ).toMatchObject({
      latestVersion: '1.0.28',
      versionCode: 10044,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
      sha256: 'a'.repeat(64),
      mandatory: true,
      sourceCommit: 'abc123',
    });
  });

  it('lehnt ungültiges Manifest ab', () => {
    expect(
      validateParsedAndroidLatestManifest(
        { versionCode: 1, apkUrl: 'http://insecure.test/x.apk' },
        { expectedHost: null },
      ),
    ).toBe(false);
    expect(
      validateParsedAndroidLatestManifest(
        {
          versionCode: 10044,
          apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
          sha256: 'not-a-hash',
        },
        { expectedHost: 'amrtech-payment-downloads.amrtech.workers.dev' },
      ),
    ).toBe(false);
  });

  it('Standard-Manifest-URL ist Payment-Host', () => {
    expect(resolveAndroidUpdateManifestUrl()).toBe(ANDROID_UPDATE_MANIFEST_DEFAULT_URL);
    expect(ANDROID_FALLBACK_APK_URL).toContain('amrtech-payment-downloads.amrtech.workers.dev');
  });

  it('interner Cache-Pfad nutzt Payment-Präfix', () => {
    expect(resolveAndroidInternalApkRelativePath({ versionCode: 19100 }).relativePath).toBe(
      `${ANDROID_APK_INTERNAL_SUBDIR}/amrtech-payment-update-19100.apk`,
    );
  });
});

describe('validateDownloadedApkBuffer', () => {
  it('wirft sha_mismatch bei falscher Prüfsumme', async () => {
    await expect(validateDownloadedApkBuffer(pkApkBuffer(), 'b'.repeat(64))).rejects.toMatchObject({
      code: 'sha_mismatch',
    });
  });
});

describe('androidApkUpdateCheckPolicy', () => {
  it('manual umgeht Cooldown', () => {
    const now = Date.now();
    expect(shouldRunAndroidApkUpdateCheck(now - 1000, now, 'manual')).toBe(true);
    expect(shouldRunAndroidApkUpdateCheck(now - 1000, now, 'interval')).toBe(false);
  });
});

describe('banner visibility', () => {
  it('zeigt Banner nur bei höherem versionCode und ohne Snooze', () => {
    const base = {
      installKind: 'android' as const,
      online: true,
      checking: false,
      manifestLoadFailed: false,
      manifest: { versionCode: 20000, latestVersion: '2.0.0' },
      installed: installed(),
      snoozedVersionCode: null as number | null,
      installBusy: false,
    };
    expect(evaluateAndroidApkUpdateBannerVisibility(base).shouldShow).toBe(true);
    expect(
      evaluateAndroidApkUpdateBannerVisibility({ ...base, snoozedVersionCode: 20000 }).shouldShow,
    ).toBe(false);
  });
});

describe('appendManifestFetchCacheBuster', () => {
  it('fügt _cb Query hinzu', () => {
    expect(appendManifestFetchCacheBuster('https://x.test/latest.json', 123)).toBe(
      'https://x.test/latest.json?_cb=123',
    );
  });
});

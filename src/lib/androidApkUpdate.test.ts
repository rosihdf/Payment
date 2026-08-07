import { Buffer } from 'node:buffer';

{
  type GWithBtoa = typeof globalThis & { btoa?: (bin: string) => string };
  const g = globalThis as GWithBtoa;
  if (typeof g.btoa !== 'function') {
    g.btoa = (data: string) => Buffer.from(data, 'latin1').toString('base64');
  }
}

import { describe, expect, it, vi } from 'vitest';

import {
  ANDROID_APK_INTERNAL_SUBDIR,
  ANDROID_UPDATE_MANIFEST_URL,
  AndroidApkUpdateFlowError,
  appendManifestFetchCacheBuster,
  apkBufferLooksLikeZipPackage,
  arrayBufferToBase64Latin1,
  compareAndroidInstallToManifest,
  deriveAndroidUpdateApkVersionTag,
  parseAndroidLatestManifest,
  resolveAndroidInternalApkRelativePath,
  resolveAndroidUpdateManifestUrl,
  sanitizeAndroidApkFilenameTag,
  shouldOfferAndroidNativeApkInstall,
  validateAndroidApkContentTypeHeader,
} from './androidApkUpdate';

describe('parseAndroidLatestManifest', () => {
  it('parst Wartungs-Kernfelder', () => {
    expect(
      parseAndroidLatestManifest({
        platform: 'android',
        latestVersion: '1.2.4',
        versionCode: 42,
        apkUrl: 'https://example.dev/a.apk',
        releaseNotes: 'Fix',
        publishedAt: '2026-01-01',
      }),
    ).toMatchObject({
      latestVersion: '1.2.4',
      versionCode: 42,
      apkUrl: 'https://example.dev/a.apk',
    });
  });

  it('mapped Payment-Manifestfelder versionName/downloadUrl', () => {
    expect(
      parseAndroidLatestManifest({
        versionName: '1.0.12',
        versionCode: 10028,
        downloadUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.12/a.apk',
        sha256: 'ignored',
        sizeBytes: 1,
      }),
    ).toMatchObject({
      latestVersion: '1.0.12',
      versionCode: 10028,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.12/a.apk',
    });
  });
});

describe('compareAndroidInstallToManifest', () => {
  const baseInstalled = () => ({
    bundleSemver: '1.2.3',
    nativeVersionCode: 10 as number | null,
    nativeVersionName: '1.2.3',
  });

  it('bevorzugt versionCode', () => {
    expect(
      compareAndroidInstallToManifest(baseInstalled(), {
        versionCode: 11,
        latestVersion: '1.0.0',
      }),
    ).toEqual({ kind: 'newer', basis: 'versionCode', serverLabel: '11' });
  });

  it('nutzt SemVer wenn kein installierter Code', () => {
    expect(
      compareAndroidInstallToManifest(
        { ...baseInstalled(), nativeVersionCode: null },
        { latestVersion: '1.2.4' },
      ),
    ).toEqual({ kind: 'newer', basis: 'semver', serverLabel: '1.2.4' });
  });

  it('current bei gleichem Code und SemVer', () => {
    expect(
      compareAndroidInstallToManifest(baseInstalled(), {
        versionCode: 10,
        latestVersion: '1.2.3',
      }),
    ).toEqual({ kind: 'current' });
  });

  it('uncertain bei nicht vergleichbarem latestVersion', () => {
    const r = compareAndroidInstallToManifest(baseInstalled(), { latestVersion: 'edge' });
    expect(r.kind).toBe('uncertain');
  });

  it('SemVer-neuer bei gleichem versionCode — Vergleich „newer“, nativer Installer nicht angeboten', () => {
    const manifest = { versionCode: 10, latestVersion: '1.2.5' };
    expect(compareAndroidInstallToManifest(baseInstalled(), manifest)).toEqual({
      kind: 'newer',
      basis: 'semver',
      serverLabel: '1.2.5',
    });
    expect(shouldOfferAndroidNativeApkInstall(baseInstalled(), manifest)).toBe(false);
  });
});

describe('resolveAndroidUpdateManifestUrl', () => {
  it('liefert Payment-Produktions-URL ohne Override', () => {
    vi.stubEnv('VITE_ANDROID_UPDATE_MANIFEST_URL', '');
    expect(resolveAndroidUpdateManifestUrl()).toBe(ANDROID_UPDATE_MANIFEST_URL);
    vi.unstubAllEnvs();
  });

  it('respektiert expliziten Override', () => {
    vi.stubEnv('VITE_ANDROID_UPDATE_MANIFEST_URL', 'https://example.dev/android/latest.json');
    expect(resolveAndroidUpdateManifestUrl()).toBe('https://example.dev/android/latest.json');
    vi.unstubAllEnvs();
  });
});

describe('shouldOfferAndroidNativeApkInstall', () => {
  const snap = (): Parameters<typeof shouldOfferAndroidNativeApkInstall>[0] => ({
    bundleSemver: '1.0.0',
    nativeVersionCode: 100,
    nativeVersionName: '1.0.0',
  });

  it('true nur wenn remote versionCode strikt höher', () => {
    expect(shouldOfferAndroidNativeApkInstall(snap(), { versionCode: 101 })).toBe(true);
  });

  it('false bei gleichem oder niedrigerem remote versionCode', () => {
    expect(shouldOfferAndroidNativeApkInstall(snap(), { versionCode: 100 })).toBe(false);
    expect(shouldOfferAndroidNativeApkInstall(snap(), { versionCode: 99 })).toBe(false);
  });

  it('false ohne Manifest oder ohne numerischen Code auf einer Seite', () => {
    expect(shouldOfferAndroidNativeApkInstall(snap(), null)).toBe(false);
    expect(shouldOfferAndroidNativeApkInstall(snap(), {})).toBe(false);
    expect(
      shouldOfferAndroidNativeApkInstall({ ...snap(), nativeVersionCode: null }, { versionCode: 200 }),
    ).toBe(false);
  });
});

describe('appendManifestFetchCacheBuster', () => {
  it('fügt Timestamp-Query ohne bestehendes ? hinzu', () => {
    expect(appendManifestFetchCacheBuster('https://x.example/dev/android/latest.json', 170000)).toBe(
      'https://x.example/dev/android/latest.json?_cb=170000',
    );
  });

  it('hängt mit & an wenn bereits Query', () => {
    expect(appendManifestFetchCacheBuster('https://x.example/dev/latest.json?t=1', 42)).toBe(
      'https://x.example/dev/latest.json?t=1&_cb=42',
    );
  });
});

describe('install-Flow Helpers (offline fähiges Validieren)', () => {
  it('validateAndroidApkContentTypeHeader: leer tolerant', () => {
    expect(() => validateAndroidApkContentTypeHeader(null)).not.toThrow();
    expect(() => validateAndroidApkContentTypeHeader('')).not.toThrow();
  });

  it('validateAndroidApkContentTypeHeader: erlaubt octet-stream inkl. Parameter', () => {
    expect(() =>
      validateAndroidApkContentTypeHeader('application/octet-stream; charset=UTF-8'),
    ).not.toThrow();
  });

  it('validateAndroidApkContentTypeHeader: wirft bei HTML', () => {
    expect(() => validateAndroidApkContentTypeHeader('text/html')).toThrowError(AndroidApkUpdateFlowError);
  });

  it('apkBufferLooksLikeZipPackage erkennt Local-File PK-Header', () => {
    const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]).buffer;
    expect(apkBufferLooksLikeZipPackage(buf)).toBe(true);
    expect(apkBufferLooksLikeZipPackage(new ArrayBuffer(0))).toBe(false);
  });

  it('sanitize + Pfad konsistent zur Payment-Subdir-Vorgabe', () => {
    expect(sanitizeAndroidApkFilenameTag('  beta/42 ')).toBe('beta_42');
    expect(deriveAndroidUpdateApkVersionTag({ latestVersion: '1.9.9', versionCode: undefined })).toBe(
      '1.9.9',
    );
    expect(deriveAndroidUpdateApkVersionTag({ versionCode: 7 })).toBe('7');
    expect(resolveAndroidInternalApkRelativePath({ versionCode: 7 }).relativePath).toBe(
      `${ANDROID_APK_INTERNAL_SUBDIR}/AMRtech-Payment-update-7.apk`,
    );
  });

  it('arrayBufferToBase64Latin1 entspricht Buffer base64(latin1)', () => {
    const bytes = new Uint8Array([0xe4, 0xf6, 0xfc]);
    const raw = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(arrayBufferToBase64Latin1(raw)).toBe(Buffer.from(new Uint8Array(raw)).toString('base64'));
  });
});

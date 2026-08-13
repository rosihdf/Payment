import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  ANDROID_UPDATE_EXPECTED_HOST,
  compareAndroidInstallToManifest,
  fetchAndroidLatestManifest,
  parseAndroidLatestManifest,
  shouldOfferAndroidApkUpdate,
  validateAllowedApkDownloadUrl,
  validateParsedAndroidLatestManifest,
} from '../lib/androidApkUpdate';
import { evaluateAndroidApkUpdateBannerVisibility } from '../lib/androidApkUpdateBanner';
import { ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME } from '../lib/androidApkSystemHandoffFlow';

const installed = () => ({
  bundleSemver: '1.0.28',
  nativeVersionCode: 10044 as number | null,
  nativeVersionName: '1.0.28',
});

const allowedApkUrl =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.28/AMRtech-Payment-1.0.28.apk';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Android updatecheck & production handoff path', () => {
  it('kein Update bei gleichem versionCode', () => {
    expect(shouldOfferAndroidApkUpdate(installed(), { versionCode: 10044, apkUrl: allowedApkUrl })).toBe(
      false,
    );
    const evalResult = evaluateAndroidApkUpdateBannerVisibility({
      installKind: 'android',
      online: true,
      checking: false,
      manifestLoadFailed: false,
      manifest: { versionCode: 10044, apkUrl: allowedApkUrl },
      installed: installed(),
      snoozedVersionCode: null,
      installBusy: false,
    });
    expect(evalResult.shouldShow).toBe(false);
  });

  it('Update bei höherem versionCode', () => {
    const older = {
      bundleSemver: '1.0.27',
      nativeVersionCode: 10043 as number | null,
      nativeVersionName: '1.0.27',
    };
    expect(shouldOfferAndroidApkUpdate(older, { versionCode: 10044, apkUrl: allowedApkUrl })).toBe(true);
  });

  it('HTTPS + Host-Allowlist: gültige URL', () => {
    expect(validateAllowedApkDownloadUrl(allowedApkUrl)).toBe(true);
  });

  it('HTTP statt HTTPS → blockiert', () => {
    expect(
      validateAllowedApkDownloadUrl('http://amrtech-payment-downloads.amrtech.workers.dev/x.apk'),
    ).toBe(false);
  });

  it('falscher Host → blockiert', () => {
    expect(validateAllowedApkDownloadUrl('https://evil.example.test/x.apk')).toBe(false);
  });

  it('Subdomain/Host-Manipulation → blockiert', () => {
    expect(
      validateAllowedApkDownloadUrl(
        'https://amrtech-payment-downloads.amrtech.workers.dev.evil.test/x.apk',
      ),
    ).toBe(false);
  });

  it('@capacitor/filesystem vorhanden', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('@capacitor/filesystem');
  });

  it('fester lokaler Update-Dateiname', () => {
    expect(ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME).toBe('AMRtech-Payment-Update.apk');
  });

  it('kein REQUEST_INSTALL_PACKAGES / FileProvider im Manifest', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).not.toContain('REQUEST_INSTALL_PACKAGES');
    expect(manifest).not.toContain('FileProvider');
    expect(manifest).not.toContain('WRITE_EXTERNAL_STORAGE');
  });

  it('SystemHandoff-Plugin vorhanden, Installer-Plugin nicht im Runtime-Pfad', () => {
    expect(
      existsSync('android/app/src/main/java/de/amrtech/paymentleads/AppUpdateSystemHandoffPlugin.java'),
    ).toBe(true);
    expect(
      existsSync('android/app/src/main/java/de/amrtech/paymentleads/AppUpdateInstallerPlugin.java'),
    ).toBe(false);
    expect(existsSync('src/lib/appUpdateInstaller.ts')).toBe(false);
    expect(existsSync('src/lib/androidApkUpdateHandoff.ts')).toBe(false);
    expect(existsSync('src/lib/androidApkInstallFlow.ts')).toBe(false);
    expect(existsSync('src/lib/androidApkSystemHandoffFlow.ts')).toBe(true);
  });

  it('versionCode bleibt primäre Updateentscheidung', () => {
    const older = {
      bundleSemver: '1.0.27',
      nativeVersionCode: 10043 as number | null,
      nativeVersionName: '1.0.27',
    };
    expect(compareAndroidInstallToManifest(older, { versionCode: 10044 }).kind).toBe('newer');
    expect(compareAndroidInstallToManifest(installed(), { versionCode: 10044 }).kind).toBe('current');
  });

  it('Manifestfehler werden abgefangen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
    const result = await fetchAndroidLatestManifest({
      manifestUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json',
    });
    expect(result).toBeNull();
  });

  it('Source-Version 1.0.28 / 10044', () => {
    const gradle = readFileSync('android/app/build.gradle', 'utf8');
    expect(gradle).toMatch(/versionName\s+"1\.0\.28"/);
    expect(gradle).toMatch(/versionCode\s+10044/);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(pkg.version).toBe('1.0.28');
  });
});

describe('Manifest validation & host allowlist', () => {
  it('parst Payment-Manifest und prüft SHA-Feldformat', () => {
    const parsed = parseAndroidLatestManifest({
      versionName: '1.0.28',
      versionCode: 10044,
      downloadUrl: allowedApkUrl,
      sha256: 'a'.repeat(64),
    });
    expect(parsed).not.toBeNull();
    expect(validateParsedAndroidLatestManifest(parsed!, { expectedHost: ANDROID_UPDATE_EXPECTED_HOST })).toBe(
      true,
    );
  });

  it('blockiert Manifest mit ungültigem Host', () => {
    expect(
      validateParsedAndroidLatestManifest(
        { versionCode: 10044, apkUrl: 'https://evil.test/x.apk' },
        { expectedHost: ANDROID_UPDATE_EXPECTED_HOST },
      ),
    ).toBe(false);
  });

  it('Manifest-URL-Host wird beim Fetch geprüft', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await fetchAndroidLatestManifest({
      manifestUrl: 'https://evil.test/latest.json',
    });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
  ANDROID_FALLBACK_APK_URL,
  ANDROID_UPDATE_EXPECTED_HOST,
  appendManifestFetchCacheBuster,
  compareAndroidInstallToManifest,
  fetchAndroidLatestManifest,
  isHttpsUrlOnExpectedHost,
  parseAndroidLatestManifest,
  shouldOfferAndroidApkUpdate,
  validateAllowedApkDownloadUrl,
  validateParsedAndroidLatestManifest,
} from '../lib/androidApkUpdate';
import { openAndroidUpdateDownloadExternally } from '../lib/androidApkUpdateHandoff';
import { evaluateAndroidApkUpdateBannerVisibility } from '../lib/androidApkUpdateBanner';
import { shouldRunAndroidApkUpdateCheck } from '../lib/androidApkUpdateCheckPolicy';

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn(),
  },
}));

const installed = () => ({
  bundleSemver: '1.0.27',
  nativeVersionCode: 10043 as number | null,
  nativeVersionName: '1.0.27',
});

const allowedApkUrl =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.28/AMRtech-Payment-1.0.28.apk';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Phase 6B browser updater U1–U14', () => {
  it('U1: kein Update → kein Handoff-Angebot', () => {
    expect(shouldOfferAndroidApkUpdate(installed(), { versionCode: 10043, apkUrl: allowedApkUrl })).toBe(
      false,
    );
    const evalResult = evaluateAndroidApkUpdateBannerVisibility({
      installKind: 'android',
      online: true,
      checking: false,
      manifestLoadFailed: false,
      manifest: { versionCode: 10043, apkUrl: allowedApkUrl },
      installed: installed(),
      snoozedVersionCode: null,
      installBusy: false,
    });
    expect(evalResult.shouldShow).toBe(false);
  });

  it('U2: Update verfügbar → Button/Handoff möglich', () => {
    expect(shouldOfferAndroidApkUpdate(installed(), { versionCode: 10044, apkUrl: allowedApkUrl })).toBe(true);
  });

  it('U3: Klick → exakt erlaubte APK-URL extern geöffnet', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const browserOpen = vi.spyOn(Browser, 'open').mockResolvedValue();
    const manifest = { versionCode: 10044, apkUrl: allowedApkUrl };

    const res = await openAndroidUpdateDownloadExternally(manifest);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url).toBe(allowedApkUrl);
    expect(browserOpen).toHaveBeenCalledTimes(1);
    expect(browserOpen).toHaveBeenCalledWith({ url: allowedApkUrl });
  });

  it('U4: HTTP statt HTTPS → blockiert', async () => {
    const res = await openAndroidUpdateDownloadExternally({
      versionCode: 10044,
      apkUrl: 'http://amrtech-payment-downloads.amrtech.workers.dev/x.apk',
    });
    expect(res.ok).toBe(false);
  });

  it('U5: falscher Host → blockiert', async () => {
    const res = await openAndroidUpdateDownloadExternally({
      versionCode: 10044,
      apkUrl: 'https://evil.example.test/x.apk',
    });
    expect(res.ok).toBe(false);
  });

  it('U6: Subdomain/Host-Manipulation → blockiert', () => {
    expect(
      validateAllowedApkDownloadUrl(
        'https://amrtech-payment-downloads.amrtech.workers.dev.evil.test/x.apk',
      ),
    ).toBe(false);
    expect(
      validateAllowedApkDownloadUrl('https://not-amrtech-payment-downloads.amrtech.workers.dev/x.apk'),
    ).toBe(false);
  });

  it('U7: kein interner APK-fetch im Handoff-Modul', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Browser, 'open').mockResolvedValue();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await openAndroidUpdateDownloadExternally({ versionCode: 10044, apkUrl: allowedApkUrl });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('U8: kein Filesystem in package.json', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).not.toContain('@capacitor/filesystem');
  });

  it('U9: kein nativer Installer-Bridge-Modul', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync('src/lib/appUpdateInstaller.ts')).toBe(false);
  });

  it('U10: REQUEST_INSTALL_PACKAGES nicht im Manifest', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).not.toContain('REQUEST_INSTALL_PACKAGES');
  });

  it('U11: FileProvider nicht im Manifest', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).not.toContain('FileProvider');
  });

  it('U12: AppUpdateInstallerPlugin nicht vorhanden', async () => {
    const { existsSync } = await import('node:fs');
    expect(
      existsSync('android/app/src/main/java/de/amrtech/paymentleads/AppUpdateInstallerPlugin.java'),
    ).toBe(false);
  });

  it('U13: versionCode bleibt primäre Updateentscheidung', () => {
    expect(compareAndroidInstallToManifest(installed(), { versionCode: 10044 }).kind).toBe('newer');
    expect(compareAndroidInstallToManifest(installed(), { versionCode: 10043 }).kind).toBe('current');
  });

  it('U14: Manifestfehler werden abgefangen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
    const result = await fetchAndroidLatestManifest({
      manifestUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json',
    });
    expect(result).toBeNull();
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

  it('Fallback-APK-URL ist auf erlaubtem Host', () => {
    expect(isHttpsUrlOnExpectedHost(ANDROID_FALLBACK_APK_URL, ANDROID_UPDATE_EXPECTED_HOST)).toBe(true);
  });
});

describe('Update check policy', () => {
  it('manual umgeht Cooldown', () => {
    const now = Date.now();
    expect(shouldRunAndroidApkUpdateCheck(now - 1000, now, 'manual')).toBe(true);
  });
});

describe('appendManifestFetchCacheBuster', () => {
  it('fügt _cb Query hinzu', () => {
    expect(appendManifestFetchCacheBuster('https://x.test/latest.json', 99)).toBe(
      'https://x.test/latest.json?_cb=99',
    );
  });
});

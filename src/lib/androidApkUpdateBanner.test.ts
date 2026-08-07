import { describe, expect, it } from 'vitest';

import {
  ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY,
  evaluateAndroidApkUpdateBannerVisibility,
  readSnoozedAndroidApkVersionCode,
  shouldShowAndroidApkUpdateBanner,
  writeSnoozedAndroidApkVersionCode,
} from './androidApkUpdateBanner';

const baseInstalled = (): Parameters<typeof shouldShowAndroidApkUpdateBanner>[0]['installed'] => ({
  bundleSemver: '1.2.3',
  nativeVersionCode: 10,
  nativeVersionName: '1.2.3',
});

const baseManifest = (): NonNullable<
  Parameters<typeof shouldShowAndroidApkUpdateBanner>[0]['manifest']
> => ({
  latestVersion: '1.3.0',
  versionCode: 11,
  apkUrl: 'https://example.com/app.apk',
  platform: 'android',
  releaseNotes: '',
  publishedAt: '',
});

describe('shouldShowAndroidApkUpdateBanner', () => {
  const openInput = () => ({
    installKind: 'android' as const,
    online: true,
    checking: false,
    manifestLoadFailed: false,
    manifest: baseManifest(),
    installed: baseInstalled(),
    snoozedVersionCode: null as number | null,
    installBusy: false,
  });

  it('zeigt bei Web/PWA/iOS nicht', () => {
    const m = baseManifest();
    const i = baseInstalled();
    expect(shouldShowAndroidApkUpdateBanner({ ...openInput(), installKind: 'web', manifest: m, installed: i })).toBe(
      false,
    );
    expect(shouldShowAndroidApkUpdateBanner({ ...openInput(), installKind: 'pwa', manifest: m, installed: i })).toBe(
      false,
    );
    expect(shouldShowAndroidApkUpdateBanner({ ...openInput(), installKind: 'ios', manifest: m, installed: i })).toBe(
      false,
    );
  });

  it('zeigt bei Android + höherem versionCode', () => {
    expect(shouldShowAndroidApkUpdateBanner(openInput())).toBe(true);
  });

  it('zeigt bei aktueller versionCode-Version nicht', () => {
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...openInput(),
        manifest: { ...baseManifest(), versionCode: 10, latestVersion: '1.2.3' },
      }),
    ).toBe(false);
  });

  it('zeigt nicht bei nur SemVer-neu, gleichem versionCode (Installer-Regel)', () => {
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...openInput(),
        manifest: { ...baseManifest(), versionCode: 10, latestVersion: '1.9.0' },
      }),
    ).toBe(false);
  });

  it('zeigt nicht bei fehlendem nativeVersionCode auch wenn SemVer neuer wäre', () => {
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...openInput(),
        installed: { ...baseInstalled(), nativeVersionCode: null },
        manifest: { ...baseManifest(), versionCode: 10, latestVersion: '9.0.0' },
      }),
    ).toBe(false);
  });

  it('zeigt nicht offline, bei Fehler oder während Check/Busy', () => {
    const o = openInput();
    expect(shouldShowAndroidApkUpdateBanner({ ...o, online: false })).toBe(false);
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...o,
        manifest: null,
        manifestLoadFailed: true,
        checking: false,
      }),
    ).toBe(false);
    expect(shouldShowAndroidApkUpdateBanner({ ...o, checking: true })).toBe(false);
    expect(
      shouldShowAndroidApkUpdateBanner({ ...o, manifest: null, manifestLoadFailed: false }),
    ).toBe(false);
    expect(shouldShowAndroidApkUpdateBanner({ ...o, installBusy: true })).toBe(false);
  });

  it('evaluateAndroidApkUpdateBannerVisibility: liefert snoozed_same_version_code', () => {
    const m = baseManifest();
    expect(
      evaluateAndroidApkUpdateBannerVisibility({
        ...openInput(),
        manifest: m,
        snoozedVersionCode: 11,
      }).reasonIfHidden,
    ).toBe('snoozed_same_version_code');
    expect(
      evaluateAndroidApkUpdateBannerVisibility({
        ...openInput(),
        manifest: m,
        snoozedVersionCode: 9,
      }).shouldShow,
    ).toBe(true);
  });

  it('Später: gleiche versionCode blendet aus, höhere zeigt wieder', () => {
    const m = baseManifest();
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...openInput(),
        manifest: m,
        snoozedVersionCode: 11,
      }),
    ).toBe(false);
    expect(
      shouldShowAndroidApkUpdateBanner({
        ...openInput(),
        manifest: { ...m, versionCode: 12, latestVersion: '1.4.0' },
        snoozedVersionCode: 11,
      }),
    ).toBe(true);
  });
});

describe('snooze storage helpers', () => {
  it('liest und schreibt Payment-localStorage-Schlüssel', () => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY);
    expect(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY).toBe(
      'amrtech_payment_android_update_snoozed_version_code',
    );
    expect(readSnoozedAndroidApkVersionCode()).toBe(null);
    writeSnoozedAndroidApkVersionCode(42);
    expect(localStorage.getItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY)).toBe('42');
    expect(readSnoozedAndroidApkVersionCode()).toBe(42);
    localStorage.removeItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY);
  });
});

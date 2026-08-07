import {
  shouldOfferAndroidNativeApkInstall,
  type AndroidInstalledSnapshot,
  type AndroidLatestManifest,
} from './androidApkUpdate';

export const ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY = 'amrtech_payment_android_update_snoozed_version_code';

export const ANDROID_APK_SNOOZE_RESET_EVENT = 'amrtech_payment_android_apk_snooze_reset';

export function notifyAndroidApkSnoozeReset(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ANDROID_APK_SNOOZE_RESET_EVENT));
}

export function readSnoozedAndroidApkVersionCode(): number | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY)?.trim();
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeSnoozedAndroidApkVersionCode(versionCode: number): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ANDROID_APK_UPDATE_SNOOZE_STORAGE_KEY, String(Math.trunc(versionCode)));
  } catch {
    /* Quota oder Private Mode — Banner bleibt sichtbar */
  }
}

export type AndroidApkUpdateBannerGateInput = {
  installKind: 'android' | 'ios' | 'pwa' | 'web';
  online: boolean;
  checking: boolean;
  manifestLoadFailed: boolean;
  manifest: AndroidLatestManifest | null;
  installed: AndroidInstalledSnapshot;
  snoozedVersionCode: number | null;
  installBusy: boolean;
};

export type AndroidApkBannerHiddenReason =
  | 'not_android_surface'
  | 'offline'
  | 'checking'
  | 'install_busy'
  | 'manifest_load_failed'
  | 'manifest_missing'
  | 'no_native_update_offer'
  | 'manifest_version_code_invalid'
  | 'snoozed_same_version_code';

export function evaluateAndroidApkUpdateBannerVisibility(
  i: AndroidApkUpdateBannerGateInput,
): { shouldShow: boolean; reasonIfHidden: AndroidApkBannerHiddenReason | null } {
  if (i.installKind !== 'android') {
    return { shouldShow: false, reasonIfHidden: 'not_android_surface' };
  }
  if (!i.online) {
    return { shouldShow: false, reasonIfHidden: 'offline' };
  }
  if (i.checking) {
    return { shouldShow: false, reasonIfHidden: 'checking' };
  }
  if (i.installBusy) {
    return { shouldShow: false, reasonIfHidden: 'install_busy' };
  }
  if (i.manifestLoadFailed) {
    return { shouldShow: false, reasonIfHidden: 'manifest_load_failed' };
  }
  if (i.manifest == null) {
    return { shouldShow: false, reasonIfHidden: 'manifest_missing' };
  }
  if (!shouldOfferAndroidNativeApkInstall(i.installed, i.manifest)) {
    return { shouldShow: false, reasonIfHidden: 'no_native_update_offer' };
  }

  const mc = i.manifest.versionCode;
  if (typeof mc !== 'number' || !Number.isFinite(mc)) {
    return { shouldShow: false, reasonIfHidden: 'manifest_version_code_invalid' };
  }

  if (i.snoozedVersionCode != null && i.snoozedVersionCode === Math.trunc(mc)) {
    return { shouldShow: false, reasonIfHidden: 'snoozed_same_version_code' };
  }

  return { shouldShow: true, reasonIfHidden: null };
}

export function shouldShowAndroidApkUpdateBanner(i: AndroidApkUpdateBannerGateInput): boolean {
  return evaluateAndroidApkUpdateBannerVisibility(i).shouldShow;
}

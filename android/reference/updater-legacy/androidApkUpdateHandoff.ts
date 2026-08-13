import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
  ANDROID_APK_UPDATE_LOG_TAG,
  resolveValidatedApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';

export const ANDROID_UPDATE_BROWSER_HANDOFF_NOTICE =
  'Der Download wird im Browser geöffnet. Nach dem Download bitte die Installation bestätigen.';

export type AndroidUpdateHandoffResult =
  | { ok: true; notice: string; url: string }
  | { ok: false; message: string };

/**
 * Öffnet die versionierte APK-URL extern im Systembrowser.
 * Payment lädt die APK nicht selbst herunter und installiert nicht.
 */
export const openAndroidUpdateDownloadExternally = async (
  manifest: AndroidLatestManifest,
): Promise<AndroidUpdateHandoffResult> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Gerät offline — Update kann nicht geöffnet werden.' };
  }

  const apkUrl = resolveValidatedApkDownloadUrl(manifest);
  if (apkUrl == null) {
    console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'apk_url_blocked', { manifestApkUrl: manifest.apkUrl ?? null });
    return { ok: false, message: 'Die Download-Adresse ist nicht zulässig.' };
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: apkUrl });
    } else if (typeof window !== 'undefined') {
      window.open(apkUrl, '_blank', 'noopener,noreferrer');
    } else {
      return { ok: false, message: 'Update konnte nicht geöffnet werden.' };
    }

    console.info(ANDROID_APK_UPDATE_LOG_TAG, 'external_handoff', { apkUrl });
    return {
      ok: true,
      url: apkUrl,
      notice: ANDROID_UPDATE_BROWSER_HANDOFF_NOTICE,
    };
  } catch (e) {
    console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'external_handoff_failed', e);
    return {
      ok: false,
      message: 'Update konnte nicht im Browser geöffnet werden. Bitte erneut versuchen.',
    };
  }
};

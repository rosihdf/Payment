import {
  AndroidApkUpdateFlowError,
  INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX,
  downloadAndroidApkToCache,
  resolveApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateInstaller } from './appUpdateInstaller';

/** Nutzer-/UI-Text zu Fehler aus APK-Download oder Paketinstaller. */
export const formatAndroidApkInstallFailureUserMessage = (e: unknown): string => {
  if (e instanceof AndroidApkUpdateFlowError) {
    return e.message;
  }
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = String((e as { message?: unknown }).message ?? '');
    if (msg.includes(INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX)) {
      const cleaned = msg.split(':').slice(1).join(':').trim();
      return cleaned.length > 0
        ? cleaned
        : 'Falls Android blockiert, erlaube Installation aus dieser Quelle für AMRtech Payment in den Android-Einstellungen. Danach „Update installieren“ erneut tippen.';
    }
    if (msg.trim().length > 0) return msg.trim();
  }
  return 'Update konnte nicht gestartet werden. Bitte erneut versuchen.';
};

export type NativeApkInstallFlowResult =
  | { ok: true; notice: string }
  | { ok: false; message: string };

/**
 * Golden Reference (Wartung): APK laden → App-Cache → Paketinstaller.
 * Permission-Check erfolgt erst im nativen Installer nach dem Download.
 */
export const runAndroidNativeApkInstallFlow = async (
  manifest: AndroidLatestManifest,
): Promise<NativeApkInstallFlowResult> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Gerät offline — Update kann nicht heruntergeladen werden.' };
  }

  try {
    const apkUrl = resolveApkDownloadUrl(manifest);
    const { relativePath } = await downloadAndroidApkToCache({ apkUrl, manifest });
    await AppUpdateInstaller.openApkFromCacheRelativePath({ relativePath });
    return {
      ok: true,
      notice:
        'Android-Paketinstaller geöffnet. Bitte bestätige dort die Installation — ohne deine Freigabe findet keine Installation statt.',
    };
  } catch (e) {
    return { ok: false, message: formatAndroidApkInstallFailureUserMessage(e) };
  }
};

import {
  AndroidApkUpdateFlowError,
  downloadAndroidApkToCache,
  resolveApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateInstaller } from './appUpdateInstaller';

/** Nutzer-/UI-Text zu Fehler aus APK-Download oder Paketinstaller. */
export function formatAndroidApkInstallFailureUserMessage(e: unknown): string {
  if (e instanceof AndroidApkUpdateFlowError) {
    return e.message;
  }
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = String((e as { message?: unknown }).message ?? '').trim();
    if (msg.length > 0) return msg;
  }
  return 'Update konnte nicht gestartet werden. Bitte erneut versuchen.';
}

export type NativeApkInstallFlowResult =
  | { ok: true; notice: string }
  | { ok: false; message: string };

/**
 * Wartungs-Pfad: APK per fetch in den App-Cache → FileProvider → Systeminstaller.
 * Ein Nutzerklick: Download + Installer. Kein DownloadManager.
 */
export async function runAndroidNativeApkInstallFlow(
  manifest: AndroidLatestManifest,
): Promise<NativeApkInstallFlowResult> {
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
}

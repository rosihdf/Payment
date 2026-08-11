import {
  AndroidApkUpdateFlowError,
  downloadAndroidApkToCache,
  resolveApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateSystemHandoff } from './appUpdateSystemHandoff';

export const FILEMANAGER_HANDOFF_BLOCKED_MESSAGE_PREFIX = 'filemanager_handoff_blocked:';

/** Nutzer-/UI-Text zu Fehler aus APK-Download oder Dateimanager-Handoff. */
export const formatAndroidApkSystemHandoffFailureUserMessage = (e: unknown): string => {
  if (e instanceof AndroidApkUpdateFlowError) {
    return e.message;
  }
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = String((e as { message?: unknown }).message ?? '');
    if (msg.includes(FILEMANAGER_HANDOFF_BLOCKED_MESSAGE_PREFIX)) {
      const cleaned = msg.split(':').slice(1).join(':').trim();
      return cleaned.length > 0
        ? cleaned
        : 'Das Update wurde heruntergeladen. Öffne bitte Downloads und tippe auf die AMRtech-Payment-APK.';
    }
    if (msg.trim().length > 0) return msg.trim();
  }
  return 'Update konnte nicht gestartet werden. Bitte erneut versuchen.';
};

export type NativeApkSystemHandoffFlowResult =
  | {
      ok: true;
      notice: string;
      contentUri: string;
      displayName: string;
      strategy?: string;
      targetPackage?: string;
    }
  | { ok: false; message: string };

/**
 * Phase-6H Final: fetch→Cache→SHA → MediaStore Downloads (flach) → Dateimanager öffnen.
 * Payment startet keinen APK-Installer. Nutzer tippt die Datei in „Eigene Dateien“ an.
 */
export const runAndroidNativeApkSystemHandoffFlow = async (
  manifest: AndroidLatestManifest,
): Promise<NativeApkSystemHandoffFlowResult> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Gerät offline — Update kann nicht heruntergeladen werden.' };
  }

  try {
    const apkUrl = resolveApkDownloadUrl(manifest);
    const { relativePath } = await downloadAndroidApkToCache({ apkUrl, manifest });
    const tag =
      (manifest.latestVersion ?? '').trim() ||
      (typeof manifest.versionCode === 'number' ? String(manifest.versionCode) : 'update');
    const displayName = `AMRtech-Payment-${tag}.apk`;

    const saved = await AppUpdateSystemHandoff.saveCacheApkToPublicDownloads({
      relativePath,
      displayName,
    });

    const handoff = await AppUpdateSystemHandoff.openDownloadsFileManager({
      displayName: saved.displayName,
      contentUri: saved.contentUri,
    });

    return {
      ok: true,
      contentUri: saved.contentUri,
      displayName: saved.displayName,
      strategy: handoff.strategy,
      targetPackage: handoff.targetPackage,
      notice: `Tippe in „Eigene Dateien“ auf ${saved.displayName} und anschließend auf „Aktualisieren“.`,
    };
  } catch (e) {
    return { ok: false, message: formatAndroidApkSystemHandoffFailureUserMessage(e) };
  }
};

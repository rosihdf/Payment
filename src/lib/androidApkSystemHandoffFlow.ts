import {
  AndroidApkUpdateFlowError,
  downloadAndroidApkToCache,
  resolveApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateSystemHandoff } from './appUpdateSystemHandoff';

/** Fest verdrahteter lokaler Dateiname in Downloads (unabhängig von Remote-Version). */
export const ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME = 'AMRtech-Payment-Update.apk';

export const FILEMANAGER_HANDOFF_BLOCKED_MESSAGE_PREFIX = 'filemanager_handoff_blocked:';

export const ANDROID_UPDATE_DOWNLOADED_HEADLINE = 'Update heruntergeladen';

export const formatAndroidUpdateTapHint = (
  displayName: string = ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME,
): string =>
  `Tippe jetzt auf „${displayName}“ und anschließend auf „Aktualisieren“.`;

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
        : `Das Update wurde heruntergeladen. Öffne bitte Downloads und tippe auf „${ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME}“.`;
    }
    if (msg.trim().length > 0) return msg.trim();
  }
  return 'Update konnte nicht gestartet werden. Bitte erneut versuchen.';
};

export type NativeApkSystemHandoffFlowResult =
  | {
      ok: true;
      notice: string;
      headline: string;
      contentUri: string;
      displayName: string;
      fileManagerOpened: boolean;
      strategy?: string;
      targetPackage?: string;
    }
  | { ok: false; message: string };

/**
 * Finaler Updateflow: fetch→Cache→SHA → MediaStore Downloads → Dateimanager.
 * Payment startet keinen APK-Installer.
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

    const saved = await AppUpdateSystemHandoff.saveCacheApkToPublicDownloads({
      relativePath,
      displayName: ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME,
    });

    const displayName = saved.displayName || ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME;
    const tapHint = formatAndroidUpdateTapHint(displayName);
    const notice = `${ANDROID_UPDATE_DOWNLOADED_HEADLINE}. ${tapHint}`;

    try {
      const handoff = await AppUpdateSystemHandoff.openDownloadsFileManager({
        displayName,
        contentUri: saved.contentUri,
      });
      return {
        ok: true,
        contentUri: saved.contentUri,
        displayName,
        fileManagerOpened: true,
        strategy: handoff.strategy,
        targetPackage: handoff.targetPackage,
        headline: ANDROID_UPDATE_DOWNLOADED_HEADLINE,
        notice,
      };
    } catch {
      return {
        ok: true,
        contentUri: saved.contentUri,
        displayName,
        fileManagerOpened: false,
        headline: ANDROID_UPDATE_DOWNLOADED_HEADLINE,
        notice: `${notice} Falls „Eigene Dateien“ nicht geöffnet wurde: Downloads öffnen.`,
      };
    }
  } catch (e) {
    return { ok: false, message: formatAndroidApkSystemHandoffFailureUserMessage(e) };
  }
};

/** Erneuter Versuch, Downloads/Dateimanager zu öffnen (nach erfolgreichem Speichern). */
export const openAndroidDownloadsFileManagerAgain = async (
  displayName: string = ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  try {
    await AppUpdateSystemHandoff.openDownloadsFileManager({ displayName });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: formatAndroidApkSystemHandoffFailureUserMessage(e) };
  }
};

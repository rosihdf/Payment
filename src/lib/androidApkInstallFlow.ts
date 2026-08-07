import { Capacitor } from '@capacitor/core';
import {
  isBlockingDownloadStatus,
  clearAndroidApkDownloadState,
  readAndroidApkDownloadState,
  writeAndroidApkDownloadState,
} from './androidApkDownloadState';
import {
  deriveAndroidUpdateApkVersionTag,
  resolveApkDownloadUrl,
  sanitizeAndroidApkFilenameTag,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateDownload } from './appUpdateDownload';
import { APP_DISPLAY_NAME } from '../utils/appInfo';

export type AndroidApkSystemDownloadResult =
  | { ok: true; notice: string; downloadId: number; skippedDuplicate: boolean }
  | { ok: false; message: string };

export function buildAndroidUpdateApkFilename(manifest: AndroidLatestManifest | null): string {
  const tag = sanitizeAndroidApkFilenameTag(deriveAndroidUpdateApkVersionTag(manifest));
  const semver = manifest?.latestVersion?.trim();
  if (semver && /^\d+\.\d+\.\d+/.test(semver)) {
    return `AMRtech-Payment-${sanitizeAndroidApkFilenameTag(semver)}.apk`;
  }
  return `AMRtech-Payment-update-${tag}.apk`;
}

export function buildAndroidUpdateDownloadTitle(manifest: AndroidLatestManifest | null): string {
  const semver = manifest?.latestVersion?.trim();
  if (semver) return `${APP_DISPLAY_NAME} ${semver}`;
  const code = manifest?.versionCode;
  if (typeof code === 'number') return `${APP_DISPLAY_NAME} Build ${code}`;
  return `${APP_DISPLAY_NAME} Update`;
}

/**
 * Startet den System-DownloadManager für die Manifest-APK.
 * Payment öffnet keinen Paketinstaller.
 */
export async function runAndroidSystemApkDownloadFlow(
  manifest: AndroidLatestManifest,
): Promise<AndroidApkSystemDownloadResult> {
  if (Capacitor.getPlatform() !== 'android') {
    return { ok: false, message: 'Dieser Ablauf ist nur in der Android-App verfügbar.' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Gerät offline — Update kann nicht heruntergeladen werden.' };
  }

  const versionCode = manifest.versionCode;
  if (typeof versionCode !== 'number' || !Number.isFinite(versionCode)) {
    return { ok: false, message: 'Manifest ohne gültige Build-Nummer — Download nicht gestartet.' };
  }

  const existing = readAndroidApkDownloadState();
  if (existing != null && existing.versionCode === Math.trunc(versionCode)) {
    try {
      const st = await AppUpdateDownload.getDownloadStatus({ downloadId: existing.downloadId });
      if (isBlockingDownloadStatus(st.status)) {
        return {
          ok: true,
          downloadId: existing.downloadId,
          skippedDuplicate: true,
          notice:
            st.status === 'successful'
              ? 'Download bereits abgeschlossen. Tippe in der Android-Benachrichtigung oder unter Downloads auf die APK.'
              : 'Download läuft bereits. Android informiert dich, sobald das Update bereit zur Installation ist.',
        };
      }
      clearAndroidApkDownloadState();
    } catch {
      clearAndroidApkDownloadState();
    }
  }

  const apkUrl = resolveApkDownloadUrl(manifest);
  if (!apkUrl.startsWith('https://')) {
    return { ok: false, message: 'Ungültige Download-Adresse für die APK.' };
  }

  const filename = buildAndroidUpdateApkFilename(manifest);
  const title = buildAndroidUpdateDownloadTitle(manifest);

  try {
    const { downloadId } = await AppUpdateDownload.enqueueApkDownload({
      url: apkUrl,
      filename,
      title,
      description: 'Update wird heruntergeladen',
    });
    writeAndroidApkDownloadState({
      versionCode: Math.trunc(versionCode),
      downloadId,
      filename,
      enqueuedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      downloadId,
      skippedDuplicate: false,
      notice:
        'Download gestartet. Android informiert dich, sobald das Update bereit zur Installation ist.',
    };
  } catch (e) {
    const msg =
      typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message?: unknown }).message ?? '').trim()
        : '';
    return {
      ok: false,
      message:
        msg.length > 0
          ? msg
          : 'Update-Download konnte nicht gestartet werden. Bitte erneut versuchen.',
    };
  }
}

/** Nach erfolgreichem Upgrade: Download-State verwerfen. */
export function clearAndroidApkDownloadStateIfCurrent(installedVersionCode: number | null): void {
  if (installedVersionCode == null) return;
  const state = readAndroidApkDownloadState();
  if (state != null && state.versionCode <= installedVersionCode) {
    clearAndroidApkDownloadState();
  }
}

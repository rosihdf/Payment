import {
  clearAndroidApkDownloadState,
  isBlockingDownloadStatus,
  mapDownloadManagerStatusToUiPhase,
  readAndroidApkDownloadState,
  type AndroidApkDownloadUiPhase,
} from './androidApkDownloadState';
import {
  AppUpdateDownload,
  type AndroidDownloadManagerStatus,
} from './appUpdateDownload';

export const ANDROID_APK_DOWNLOAD_POLL_INTERVAL_MS = 1500;

export type AndroidApkDownloadProgressSnapshot = {
  phase: AndroidApkDownloadUiPhase;
  downloadId: number | null;
  versionCode: number | null;
  status: AndroidDownloadManagerStatus | null;
};

/**
 * Liest lokalen Download-State + DownloadManager-Status.
 * Löscht State, wenn installierte Version den Download überholt hat oder der Eintrag fehlt.
 */
export async function resolveAndroidApkDownloadProgress(opts: {
  offeredVersionCode: number | null | undefined;
  installedVersionCode: number | null | undefined;
}): Promise<AndroidApkDownloadProgressSnapshot> {
  const offered =
    typeof opts.offeredVersionCode === 'number' && Number.isFinite(opts.offeredVersionCode)
      ? Math.trunc(opts.offeredVersionCode)
      : null;
  const installed =
    typeof opts.installedVersionCode === 'number' && Number.isFinite(opts.installedVersionCode)
      ? Math.trunc(opts.installedVersionCode)
      : null;

  const state = readAndroidApkDownloadState();
  if (state == null) {
    return { phase: 'idle', downloadId: null, versionCode: null, status: null };
  }

  if (installed != null && state.versionCode <= installed) {
    clearAndroidApkDownloadState();
    return { phase: 'idle', downloadId: null, versionCode: null, status: null };
  }

  if (offered != null && state.versionCode !== offered) {
    return { phase: 'idle', downloadId: null, versionCode: state.versionCode, status: null };
  }

  try {
    const st = await AppUpdateDownload.getDownloadStatus({ downloadId: state.downloadId });
    if (st.status === 'not_found' || st.status === 'unknown') {
      clearAndroidApkDownloadState();
      return { phase: 'idle', downloadId: null, versionCode: null, status: st.status };
    }
    return {
      phase: mapDownloadManagerStatusToUiPhase(st.status),
      downloadId: state.downloadId,
      versionCode: state.versionCode,
      status: st.status,
    };
  } catch {
    return {
      phase: 'idle',
      downloadId: state.downloadId,
      versionCode: state.versionCode,
      status: null,
    };
  }
}

export function shouldPollAndroidApkDownload(phase: AndroidApkDownloadUiPhase): boolean {
  return phase === 'downloading';
}

export function shouldBlockNewAndroidApkDownload(
  status: AndroidDownloadManagerStatus | string | null | undefined,
): boolean {
  return typeof status === 'string' && isBlockingDownloadStatus(status);
}

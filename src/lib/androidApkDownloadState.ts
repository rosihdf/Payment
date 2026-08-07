/** Lokaler Zustand für DownloadManager-Deduplizierung (kein Installer-State). */

export const ANDROID_APK_DOWNLOAD_STATE_KEY = 'amrtech_payment_android_apk_download_state';

export type AndroidApkDownloadState = {
  versionCode: number;
  downloadId: number;
  filename: string;
  enqueuedAt: string;
};

export function readAndroidApkDownloadState(): AndroidApkDownloadState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<AndroidApkDownloadState>;
    if (
      typeof o.versionCode !== 'number' ||
      !Number.isFinite(o.versionCode) ||
      typeof o.downloadId !== 'number' ||
      !Number.isFinite(o.downloadId) ||
      typeof o.filename !== 'string' ||
      typeof o.enqueuedAt !== 'string'
    ) {
      return null;
    }
    return {
      versionCode: Math.trunc(o.versionCode),
      downloadId: Math.trunc(o.downloadId),
      filename: o.filename,
      enqueuedAt: o.enqueuedAt,
    };
  } catch {
    return null;
  }
}

export function writeAndroidApkDownloadState(state: AndroidApkDownloadState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ANDROID_APK_DOWNLOAD_STATE_KEY, JSON.stringify(state));
  } catch {
    /* Quota / Private Mode */
  }
}

export function clearAndroidApkDownloadState(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
  } catch {
    /* ignore */
  }
}

/** Status, bei dem kein zweiter Download für denselben versionCode gestartet wird. */
export function isBlockingDownloadStatus(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'running' ||
    status === 'paused' ||
    status === 'successful'
  );
}

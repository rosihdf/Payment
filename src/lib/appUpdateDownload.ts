import { registerPlugin } from '@capacitor/core';

export type EnqueueApkDownloadOptions = {
  url: string;
  filename: string;
  title: string;
  description?: string;
};

export type EnqueueApkDownloadResult = {
  downloadId: number;
};

export type GetDownloadStatusOptions = {
  downloadId: number;
};

export type AndroidDownloadManagerStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'successful'
  | 'failed'
  | 'unknown'
  | 'not_found';

export type GetDownloadStatusResult = {
  downloadId: number;
  status: AndroidDownloadManagerStatus;
  reason?: number;
};

/** Natives Bridge: APK über Android DownloadManager in den öffentlichen Download-Ordner. */
export interface AppUpdateDownloadPlugin {
  enqueueApkDownload: (opts: EnqueueApkDownloadOptions) => Promise<EnqueueApkDownloadResult>;
  getDownloadStatus: (opts: GetDownloadStatusOptions) => Promise<GetDownloadStatusResult>;
}

export const AppUpdateDownload = registerPlugin<AppUpdateDownloadPlugin>('AppUpdateDownload');

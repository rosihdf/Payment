import { registerPlugin } from '@capacitor/core';

export type SaveCacheApkToPublicDownloadsOptions = {
  relativePath: string;
  /** Ignoriert nativ — Speicherung immer als ArioSales-Update.apk */
  displayName?: string;
};

export type SaveCacheApkToPublicDownloadsResult = {
  contentUri: string;
  displayName: string;
  storage: string;
  relativePath?: string;
};

export type OpenDownloadsFileManagerOptions = {
  displayName?: string;
  contentUri?: string;
};

export type OpenDownloadsFileManagerResult = {
  started: boolean;
  strategy: string;
  action: string;
  folderPath?: string;
  targetPackage?: string;
  displayName?: string;
  opensInstaller: boolean;
};

/** MediaStore-Downloads + Dateimanager-Handoff — ohne Installationsrecht / ohne APK-Installer-Intent. */
export interface AppUpdateSystemHandoffPlugin {
  saveCacheApkToPublicDownloads: (
    opts: SaveCacheApkToPublicDownloadsOptions,
  ) => Promise<SaveCacheApkToPublicDownloadsResult>;
  openDownloadsFileManager: (
    opts?: OpenDownloadsFileManagerOptions,
  ) => Promise<OpenDownloadsFileManagerResult>;
}

export const AppUpdateSystemHandoff = registerPlugin<AppUpdateSystemHandoffPlugin>('AppUpdateSystemHandoff');

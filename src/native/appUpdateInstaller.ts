import { registerPlugin } from '@capacitor/core';

export interface InstalledAppVersion {
  versionName: string;
  versionCode: number;
}

export interface AppUpdateInstallerPlugin {
  openApkFromCacheRelativePath: (opts: { relativePath: string }) => Promise<void>;
  getInstalledVersion: () => Promise<InstalledAppVersion>;
}

export const AppUpdateInstaller = registerPlugin<AppUpdateInstallerPlugin>('AppUpdateInstaller');

/** Präfix aus dem nativen Plugin (wie ArioVan Wartung). */
export const INSTALL_SOURCE_BLOCKED = 'install_source_blocked';

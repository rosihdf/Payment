import { registerPlugin } from '@capacitor/core';

export interface InstalledAppVersion {
  versionName: string;
  versionCode: number;
}

export interface AppUpdateInstallerPlugin {
  openApkFromCacheRelativePath: (opts: { relativePath: string }) => Promise<void>;
  openUnknownSourcesSettings: () => Promise<void>;
  canRequestPackageInstalls: () => Promise<{ allowed: boolean }>;
  getInstalledVersion: () => Promise<InstalledAppVersion>;
}

export const AppUpdateInstaller = registerPlugin<AppUpdateInstallerPlugin>('AppUpdateInstaller');

export const INSTALL_SOURCE_BLOCKED = 'install_source_blocked';

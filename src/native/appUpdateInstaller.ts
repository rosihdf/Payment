import { registerPlugin } from '@capacitor/core';

export interface AppUpdateInstallerPlugin {
  openApkFromCacheRelativePath: (opts: { relativePath: string }) => Promise<void>;
  openUnknownSourcesSettings: () => Promise<void>;
  canRequestPackageInstalls: () => Promise<{ allowed: boolean }>;
}

export const AppUpdateInstaller = registerPlugin<AppUpdateInstallerPlugin>('AppUpdateInstaller');

export const INSTALL_SOURCE_BLOCKED = 'install_source_blocked';

import { registerPlugin } from '@capacitor/core';

export type OpenApkFromCacheRelativePathOptions = {
  relativePath: string;
};

export type CanInstallPackagesResult = {
  canInstall: boolean;
};

/** Natives Bridge-Plugin: Berechtigung, Cache-APK und Paketinstaller. */
export interface AppUpdateInstallerPlugin {
  canInstallPackages: () => Promise<CanInstallPackagesResult>;
  openInstallPermissionSettings: () => Promise<void>;
  openApkFromCacheRelativePath: (opts: OpenApkFromCacheRelativePathOptions) => Promise<void>;
}

export const AppUpdateInstaller = registerPlugin<AppUpdateInstallerPlugin>('AppUpdateInstaller');

import { registerPlugin } from '@capacitor/core';

export type OpenApkFromCacheRelativePathOptions = {
  relativePath: string;
};

export type CanInstallPackagesResult = {
  canInstall: boolean;
};

/** Erweiterte Bridge inkl. Permission-first (inaktiv für Golden-Reference-P1). */
export interface AppUpdateInstallerPermissionFirstPlugin {
  canInstallPackages: () => Promise<CanInstallPackagesResult>;
  openInstallPermissionSettings: () => Promise<void>;
  openApkFromCacheRelativePath: (opts: OpenApkFromCacheRelativePathOptions) => Promise<void>;
}

export const AppUpdateInstallerPermissionFirst = registerPlugin<AppUpdateInstallerPermissionFirstPlugin>(
  'AppUpdateInstaller',
);

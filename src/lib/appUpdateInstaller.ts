import { registerPlugin } from '@capacitor/core';

export type OpenApkFromCacheRelativePathOptions = {
  relativePath: string;
};

/** Natives Bridge-Plugin: APK aus App-Cache per FileProvider an den Paketinstaller übergeben. */
export interface AppUpdateInstallerPlugin {
  openApkFromCacheRelativePath: (opts: OpenApkFromCacheRelativePathOptions) => Promise<void>;
}

export const AppUpdateInstaller = registerPlugin<AppUpdateInstallerPlugin>('AppUpdateInstaller');

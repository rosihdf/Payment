import { Directory, Filesystem } from '@capacitor/filesystem';
import { AppUpdateInstaller, type InstalledAppVersion } from './appUpdateInstaller';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/appInfo';

export const APP_UPDATE_CACHE_DIR = 'amrtech-updates';

export function apkRelativePathForVersion(versionName: string): string {
  const safe = versionName.replace(/[^0-9A-Za-z._-]/g, '_');
  return `${APP_UPDATE_CACHE_DIR}/AMRtech-Payment-${safe}.apk`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export interface ApkCacheWriter {
  write(relativePath: string, data: ArrayBuffer): Promise<void>;
  delete(relativePath: string): Promise<void>;
}

export interface ApkInstallerBridge {
  openFromCache(relativePath: string): Promise<void>;
  /** PackageManager – Wahrheit nach Upgrade. Fallback: Build-Konstanten. */
  getInstalledVersion(): Promise<InstalledAppVersion>;
}

export function createFilesystemApkCacheWriter(): ApkCacheWriter {
  return {
    async write(relativePath, data) {
      await Filesystem.writeFile({
        path: relativePath,
        data: arrayBufferToBase64(data),
        directory: Directory.Cache,
        recursive: true,
      });
    },
    async delete(relativePath) {
      try {
        await Filesystem.deleteFile({
          path: relativePath,
          directory: Directory.Cache,
        });
      } catch {
        // Datei fehlt oder Cache nicht erreichbar – unkritisch.
      }
    },
  };
}

export function createNativeApkInstallerBridge(): ApkInstallerBridge {
  return {
    async openFromCache(relativePath) {
      await AppUpdateInstaller.openApkFromCacheRelativePath({ relativePath });
    },
    async getInstalledVersion() {
      try {
        const result = await AppUpdateInstaller.getInstalledVersion();
        const versionCode = Number(result.versionCode);
        if (!Number.isFinite(versionCode) || versionCode < 1) {
          throw new Error('invalid versionCode');
        }
        return {
          versionName: result.versionName?.trim() || APP_VERSION,
          versionCode: Math.trunc(versionCode),
        };
      } catch {
        return { versionName: APP_VERSION, versionCode: APP_VERSION_CODE };
      }
    },
  };
}

export type { InstalledAppVersion };

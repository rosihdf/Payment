import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  registerPlugin: () => ({
    saveCacheApkToPublicDownloads: vi.fn(),
    openDownloadsFileManager: vi.fn(),
  }),
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

import { AppUpdateSystemHandoff } from '../lib/appUpdateSystemHandoff';
import {
  ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME,
  runAndroidNativeApkSystemHandoffFlow,
} from '../lib/androidApkSystemHandoffFlow';
import * as androidApkUpdate from '../lib/androidApkUpdate';

describe('Final download-folder update flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockResolvedValue({
      relativePath: 'amrtech-payment-updates/amrtech-payment-update-10044.apk',
    });
    vi.mocked(AppUpdateSystemHandoff.saveCacheApkToPublicDownloads).mockResolvedValue({
      contentUri: 'content://media/external/downloads/42',
      displayName: ANDROID_LOCAL_UPDATE_APK_DISPLAY_NAME,
      storage: 'mediastore_downloads',
      relativePath: 'Download/',
    });
    vi.mocked(AppUpdateSystemHandoff.openDownloadsFileManager).mockResolvedValue({
      started: true,
      strategy: 'samsung_launch_my_files',
      action: 'samsung.myfiles.intent.action.LAUNCH_MY_FILES',
      targetPackage: 'com.sec.android.app.myfiles',
      opensInstaller: false,
      folderPath: '/storage/emulated/0/Download',
    });
  });

  it('Download → fester Dateiname → Dateimanager', async () => {
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 10044,
      latestVersion: '1.0.28',
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
      sha256: 'a'.repeat(64),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.displayName).toBe('AMRtech-Payment-Update.apk');
      expect(res.fileManagerOpened).toBe(true);
      expect(res.headline).toBe('Update heruntergeladen');
      expect(res.notice).toContain('AMRtech-Payment-Update.apk');
      expect(res.notice).toMatch(/Aktualisieren/);
    }
    expect(AppUpdateSystemHandoff.saveCacheApkToPublicDownloads).toHaveBeenCalledWith({
      relativePath: 'amrtech-payment-updates/amrtech-payment-update-10044.apk',
      displayName: 'AMRtech-Payment-Update.apk',
    });
  });

  it('SHA-Fehler → kein Speichern/Handoff', async () => {
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockRejectedValue(
      new androidApkUpdate.AndroidApkUpdateFlowError('sha_mismatch'),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 10044,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(false);
    expect(AppUpdateSystemHandoff.saveCacheApkToPublicDownloads).not.toHaveBeenCalled();
    expect(AppUpdateSystemHandoff.openDownloadsFileManager).not.toHaveBeenCalled();
  });

  it('Dateimanager-Fehler nach Speichern → Downloads-öffnen-Hinweis', async () => {
    vi.mocked(AppUpdateSystemHandoff.openDownloadsFileManager).mockRejectedValue(
      new Error('filemanager_handoff_blocked: …'),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 10044,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.fileManagerOpened).toBe(false);
      expect(res.notice).toMatch(/Downloads öffnen|heruntergeladen/i);
    }
  });

  it('Doppelklick — download_in_progress', async () => {
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockRejectedValue(
      new androidApkUpdate.AndroidApkUpdateFlowError('download_in_progress'),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 10044,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/läuft bereits/i);
  });

  it('Forensik Source: kein Installer-Pfad', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).not.toContain('REQUEST_INSTALL_PACKAGES');
    expect(manifest).not.toContain('FileProvider');

    const plugin = readFileSync(
      'android/app/src/main/java/de/amrtech/paymentleads/AppUpdateSystemHandoffPlugin.java',
      'utf8',
    );
    expect(plugin).toContain('LOCAL_UPDATE_APK_DISPLAY_NAME');
    expect(plugin).toContain('AMRtech-Payment-Update.apk');
    expect(plugin).toContain('deleteOwnAmrtechPaymentApks');
    expect(plugin).not.toContain('canRequestPackageInstalls');
    expect(plugin).not.toContain('PackageInstaller');
    expect(plugin).not.toContain('DownloadManager');
    expect(plugin).not.toMatch(/setDataAndType\([^)]*MIME_APK/);

    const main = readFileSync('android/app/src/main/java/de/amrtech/paymentleads/MainActivity.java', 'utf8');
    expect(main).toContain('AppUpdateSystemHandoffPlugin');
    expect(main).not.toContain('AppUpdateInstallerPlugin');

    const hit = execSync(
      'rg -l "DownloadManager|ACTION_DOWNLOAD_COMPLETE|PackageInstaller\\.Session|canRequestPackageInstalls|MANAGE_UNKNOWN_APP_SOURCES" android/app/src/main || true',
      { encoding: 'utf8' },
    ).trim();
    expect(hit).toBe('');
    expect(existsSync('src/lib/androidApkInstallFlow.ts')).toBe(false);
    expect(existsSync('src/lib/androidApkUpdateHandoff.ts')).toBe(false);
  });
});

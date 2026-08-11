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
import { runAndroidNativeApkSystemHandoffFlow } from '../lib/androidApkSystemHandoffFlow';
import * as androidApkUpdate from '../lib/androidApkUpdate';

describe('Phase 6H Final file-manager handoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockResolvedValue({
      relativePath: 'amrtech-payment-updates/amrtech-payment-update-20000.apk',
    });
    vi.mocked(AppUpdateSystemHandoff.saveCacheApkToPublicDownloads).mockResolvedValue({
      contentUri: 'content://media/external/downloads/42',
      displayName: 'AMRtech-Payment-1.0.28.apk',
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

  it('H2: Download → MediaStore Downloads → Dateimanager', async () => {
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 20000,
      latestVersion: '1.0.28',
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
      sha256: 'a'.repeat(64),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.displayName).toBe('AMRtech-Payment-1.0.28.apk');
      expect(res.notice).toMatch(/Eigene Dateien/i);
      expect(res.notice).toContain('AMRtech-Payment-1.0.28.apk');
      expect(res.notice).toMatch(/Aktualisieren/);
    }
    expect(AppUpdateSystemHandoff.saveCacheApkToPublicDownloads).toHaveBeenCalledWith({
      relativePath: 'amrtech-payment-updates/amrtech-payment-update-20000.apk',
      displayName: 'AMRtech-Payment-1.0.28.apk',
    });
    expect(AppUpdateSystemHandoff.openDownloadsFileManager).toHaveBeenCalled();
  });

  it('H2: SHA-Fehler → kein Dateimanager', async () => {
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockRejectedValue(
      new androidApkUpdate.AndroidApkUpdateFlowError('sha_mismatch'),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 20000,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(false);
    expect(AppUpdateSystemHandoff.openDownloadsFileManager).not.toHaveBeenCalled();
  });

  it('H2: Dateimanager blockiert → verständliche Meldung', async () => {
    vi.mocked(AppUpdateSystemHandoff.openDownloadsFileManager).mockRejectedValue(
      new Error(
        'filemanager_handoff_blocked: Das Update wurde heruntergeladen. Öffne bitte Downloads und tippe auf AMRtech-Payment-1.0.28.apk.',
      ),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 20000,
      latestVersion: '1.0.28',
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message.toLowerCase()).toMatch(/downloads|heruntergeladen/);
    }
  });

  it('H2: doppelter Klick — download_in_progress', async () => {
    vi.spyOn(androidApkUpdate, 'downloadAndroidApkToCache').mockRejectedValue(
      new androidApkUpdate.AndroidApkUpdateFlowError('download_in_progress'),
    );
    const res = await runAndroidNativeApkSystemHandoffFlow({
      versionCode: 20000,
      apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/läuft bereits/i);
  });

  it('H2-Forensik Source: flache Downloads, kein Installer-Pfad', async () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).not.toContain('REQUEST_INSTALL_PACKAGES');
    expect(manifest).not.toContain('FileProvider');
    expect(manifest).not.toContain('MANAGE_UNKNOWN_APP_SOURCES');
    expect(manifest).not.toContain('WRITE_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('READ_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('MANAGE_EXTERNAL_STORAGE');
    expect(manifest).toContain('com.sec.android.app.myfiles');

    const plugin = readFileSync(
      'android/app/src/main/java/de/amrtech/paymentleads/AppUpdateSystemHandoffPlugin.java',
      'utf8',
    );
    expect(plugin).not.toContain('canRequestPackageInstalls');
    expect(plugin).not.toContain('PackageInstaller');
    expect(plugin).not.toContain('DownloadManager');
    expect(plugin).not.toContain('ACTION_DOWNLOAD_COMPLETE');
    expect(plugin).not.toContain('FileProvider');
    expect(plugin).toContain('MediaStore');
    expect(plugin).toContain('openDownloadsFileManager');
    expect(plugin).toContain('deleteOwnAmrtechPaymentApks');
    expect(plugin).toContain('RELATIVE_DOWNLOADS');
    expect(plugin).not.toContain('AMRtech Payment');
    expect(plugin).not.toMatch(/setDataAndType\([^)]*MIME_APK/);

    const main = readFileSync('android/app/src/main/java/de/amrtech/paymentleads/MainActivity.java', 'utf8');
    expect(main).toContain('AppUpdateSystemHandoffPlugin');
    expect(main).not.toContain('AppUpdateInstallerPlugin');

    const hit = execSync(
      'rg -l "DownloadManager|ACTION_DOWNLOAD_COMPLETE|PackageInstaller\\.Session|canRequestPackageInstalls|MANAGE_UNKNOWN_APP_SOURCES" android/app/src/main || true',
      { encoding: 'utf8' },
    ).trim();
    expect(hit).toBe('');

    expect(existsSync('android/app/src/main/java/de/amrtech/paymentleads/AppUpdateInstallerPlugin.java')).toBe(
      false,
    );
  });
});

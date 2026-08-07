import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ANDROID_APK_DOWNLOAD_STATE_KEY,
  clearAndroidApkDownloadState,
  isBlockingDownloadStatus,
  readAndroidApkDownloadState,
  writeAndroidApkDownloadState,
} from './androidApkDownloadState';
import {
  buildAndroidUpdateApkFilename,
  buildAndroidUpdateDownloadTitle,
  isAndroidApkSystemDownloadActive,
  runAndroidSystemApkDownloadFlow,
} from './androidApkInstallFlow';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
  },
  registerPlugin: () => ({}),
}));

const enqueueApkDownload = vi.fn();
const getDownloadStatus = vi.fn();

vi.mock('./appUpdateDownload', () => ({
  AppUpdateDownload: {
    enqueueApkDownload: (...args: unknown[]) => enqueueApkDownload(...args),
    getDownloadStatus: (...args: unknown[]) => getDownloadStatus(...args),
  },
}));

describe('androidApkDownloadState', () => {
  afterEach(() => {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
  });

  it('schreibt und liest Download-State', () => {
    writeAndroidApkDownloadState({
      versionCode: 10030,
      downloadId: 42,
      filename: 'AMRtech-Payment-1.0.14.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    expect(readAndroidApkDownloadState()).toEqual({
      versionCode: 10030,
      downloadId: 42,
      filename: 'AMRtech-Payment-1.0.14.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    clearAndroidApkDownloadState();
    expect(readAndroidApkDownloadState()).toBeNull();
  });

  it('blockiert pending/running/paused/successful gegen Doppel-enqueue', () => {
    expect(isBlockingDownloadStatus('pending')).toBe(true);
    expect(isBlockingDownloadStatus('running')).toBe(true);
    expect(isBlockingDownloadStatus('paused')).toBe(true);
    expect(isBlockingDownloadStatus('successful')).toBe(true);
    expect(isBlockingDownloadStatus('failed')).toBe(false);
    expect(isBlockingDownloadStatus('not_found')).toBe(false);
  });
});

describe('runAndroidSystemApkDownloadFlow', () => {
  afterEach(() => {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
    enqueueApkDownload.mockReset();
    getDownloadStatus.mockReset();
  });

  const manifest = {
    latestVersion: '1.0.17',
    versionCode: 10033,
    apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.17/AMRtech-Payment-1.0.17.apk',
  };

  it('startet DownloadManager einmal mit MIME-relevanten Feldern', async () => {
    enqueueApkDownload.mockResolvedValue({ downloadId: 99 });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('enqueued');
      expect(res.downloadId).toBe(99);
      expect(res.notice).toContain('heruntergeladen');
    }
    expect(enqueueApkDownload).toHaveBeenCalledWith({
      url: manifest.apkUrl,
      filename: 'AMRtech-Payment-1.0.17.apk',
      title: 'AMRtech Payment 1.0.17',
      description: 'Update wird heruntergeladen',
    });
    expect(readAndroidApkDownloadState()?.downloadId).toBe(99);
  });

  it('verhindert zweiten Job bei laufendem Download', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10033,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.17.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 7, status: 'running' });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('in_progress');
      expect(res.downloadId).toBe(7);
    }
    expect(enqueueApkDownload).not.toHaveBeenCalled();
  });

  it('verhindert zweiten Job nach SUCCESSFUL (Android-Notification zuständig)', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10033,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.17.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 7, status: 'successful' });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('already_downloaded');
    }
    expect(enqueueApkDownload).not.toHaveBeenCalled();
  });

  it('erlaubt erneuten Start nach failed', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10033,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.17.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 7, status: 'failed' });
    enqueueApkDownload.mockResolvedValue({ downloadId: 11 });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    expect(enqueueApkDownload).toHaveBeenCalledOnce();
    expect(readAndroidApkDownloadState()?.downloadId).toBe(11);
  });
});

describe('isAndroidApkSystemDownloadActive', () => {
  afterEach(() => {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
    getDownloadStatus.mockReset();
  });

  it('ist true bei RUNNING', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10033,
      downloadId: 3,
      filename: 'AMRtech-Payment-1.0.17.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 3, status: 'running' });
    expect(await isAndroidApkSystemDownloadActive(10033)).toBe(true);
  });

  it('ist true bei SUCCESSFUL (kein Payment-Installationsbutton nötig)', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10033,
      downloadId: 3,
      filename: 'AMRtech-Payment-1.0.17.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 3, status: 'successful' });
    expect(await isAndroidApkSystemDownloadActive(10033)).toBe(true);
  });

  it('ist false ohne State', async () => {
    expect(await isAndroidApkSystemDownloadActive(10033)).toBe(false);
    expect(getDownloadStatus).not.toHaveBeenCalled();
  });
});

describe('filename/title helpers', () => {
  it('baut Dateiname und Titel aus Manifest', () => {
    expect(buildAndroidUpdateApkFilename({ latestVersion: '1.0.17', versionCode: 10033 })).toBe(
      'AMRtech-Payment-1.0.17.apk',
    );
    expect(buildAndroidUpdateDownloadTitle({ latestVersion: '1.0.17' })).toBe(
      'AMRtech Payment 1.0.17',
    );
  });
});

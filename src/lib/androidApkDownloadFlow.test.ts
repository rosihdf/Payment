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

  it('blockiert pending/running/paused/successful', () => {
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
    latestVersion: '1.0.14',
    versionCode: 10030,
    apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.14/AMRtech-Payment-1.0.14.apk',
  };

  it('startet DownloadManager mit MIME-relevanten Feldern', async () => {
    enqueueApkDownload.mockResolvedValue({ downloadId: 99 });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.skippedDuplicate).toBe(false);
      expect(res.downloadId).toBe(99);
      expect(res.notice).toContain('Download gestartet');
    }
    expect(enqueueApkDownload).toHaveBeenCalledWith({
      url: manifest.apkUrl,
      filename: 'AMRtech-Payment-1.0.14.apk',
      title: 'AMRtech Payment 1.0.14',
      description: 'Update wird heruntergeladen',
    });
    expect(readAndroidApkDownloadState()?.downloadId).toBe(99);
  });

  it('verhindert Doppelstart bei laufendem Download', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10030,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.14.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 7, status: 'running' });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.skippedDuplicate).toBe(true);
      expect(res.downloadId).toBe(7);
    }
    expect(enqueueApkDownload).not.toHaveBeenCalled();
  });

  it('erlaubt erneuten Start nach failed', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10030,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.14.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 7, status: 'failed' });
    enqueueApkDownload.mockResolvedValue({ downloadId: 11 });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    expect(enqueueApkDownload).toHaveBeenCalledOnce();
    expect(readAndroidApkDownloadState()?.downloadId).toBe(11);
  });

  it('erlaubt Download für höhere versionCode', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10029,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.13.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    enqueueApkDownload.mockResolvedValue({ downloadId: 12 });
    const res = await runAndroidSystemApkDownloadFlow(manifest);
    expect(res.ok).toBe(true);
    expect(getDownloadStatus).not.toHaveBeenCalled();
    expect(enqueueApkDownload).toHaveBeenCalledOnce();
  });
});

describe('filename/title helpers', () => {
  it('baut Dateiname und Titel aus Manifest', () => {
    expect(buildAndroidUpdateApkFilename({ latestVersion: '1.0.14', versionCode: 10030 })).toBe(
      'AMRtech-Payment-1.0.14.apk',
    );
    expect(buildAndroidUpdateDownloadTitle({ latestVersion: '1.0.14' })).toBe(
      'AMRtech Payment 1.0.14',
    );
  });
});

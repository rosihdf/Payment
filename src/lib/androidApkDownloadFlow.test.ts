import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ANDROID_APK_DOWNLOAD_STATE_KEY,
  clearAndroidApkDownloadState,
  isBlockingDownloadStatus,
  isInProgressDownloadStatus,
  isSuccessfulDownloadStatus,
  mapDownloadManagerStatusToUiPhase,
  readAndroidApkDownloadState,
  writeAndroidApkDownloadState,
} from './androidApkDownloadState';
import {
  resolveAndroidApkDownloadProgress,
  shouldPollAndroidApkDownload,
} from './androidApkDownloadProgress';
import {
  buildAndroidUpdateApkFilename,
  buildAndroidUpdateDownloadTitle,
  openAndroidDownloadedApk,
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
const openDownloadedApk = vi.fn();

vi.mock('./appUpdateDownload', () => ({
  AppUpdateDownload: {
    enqueueApkDownload: (...args: unknown[]) => enqueueApkDownload(...args),
    getDownloadStatus: (...args: unknown[]) => getDownloadStatus(...args),
    openDownloadedApk: (...args: unknown[]) => openDownloadedApk(...args),
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

  it('unterscheidet Progress vs Successful für UI', () => {
    expect(isInProgressDownloadStatus('running')).toBe(true);
    expect(isInProgressDownloadStatus('successful')).toBe(false);
    expect(isSuccessfulDownloadStatus('successful')).toBe(true);
    expect(isBlockingDownloadStatus('successful')).toBe(true);
    expect(mapDownloadManagerStatusToUiPhase('running')).toBe('downloading');
    expect(mapDownloadManagerStatusToUiPhase('successful')).toBe('downloaded');
    expect(mapDownloadManagerStatusToUiPhase('failed')).toBe('failed');
    expect(shouldPollAndroidApkDownload('downloading')).toBe(true);
    expect(shouldPollAndroidApkDownload('downloaded')).toBe(false);
  });
});

describe('resolveAndroidApkDownloadProgress', () => {
  afterEach(() => {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
    getDownloadStatus.mockReset();
  });

  it('mappt RUNNING auf downloading', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10031,
      downloadId: 9,
      filename: 'AMRtech-Payment-1.0.15.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 9, status: 'running' });
    const snap = await resolveAndroidApkDownloadProgress({
      offeredVersionCode: 10031,
      installedVersionCode: 10030,
    });
    expect(snap.phase).toBe('downloading');
    expect(snap.downloadId).toBe(9);
  });

  it('mappt SUCCESSFUL auf downloaded', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10031,
      downloadId: 9,
      filename: 'AMRtech-Payment-1.0.15.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 9, status: 'successful' });
    const snap = await resolveAndroidApkDownloadProgress({
      offeredVersionCode: 10031,
      installedVersionCode: 10030,
    });
    expect(snap.phase).toBe('downloaded');
  });

  it('mappt FAILED auf failed', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10031,
      downloadId: 9,
      filename: 'AMRtech-Payment-1.0.15.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 9, status: 'failed' });
    const snap = await resolveAndroidApkDownloadProgress({
      offeredVersionCode: 10031,
      installedVersionCode: 10030,
    });
    expect(snap.phase).toBe('failed');
  });

  it('stellt downloaded nach Reload mit gespeicherter downloadId wieder her', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10031,
      downloadId: 44,
      filename: 'AMRtech-Payment-1.0.15.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    getDownloadStatus.mockResolvedValue({ downloadId: 44, status: 'successful' });
    const snap = await resolveAndroidApkDownloadProgress({
      offeredVersionCode: 10031,
      installedVersionCode: 10030,
    });
    expect(snap).toMatchObject({ phase: 'downloaded', downloadId: 44 });
  });

  it('löscht State wenn installierte Version bereits aktuell', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10031,
      downloadId: 9,
      filename: 'AMRtech-Payment-1.0.15.apk',
      enqueuedAt: '2026-08-07T00:00:00.000Z',
    });
    const snap = await resolveAndroidApkDownloadProgress({
      offeredVersionCode: 10031,
      installedVersionCode: 10031,
    });
    expect(snap.phase).toBe('idle');
    expect(readAndroidApkDownloadState()).toBeNull();
    expect(getDownloadStatus).not.toHaveBeenCalled();
  });
});

describe('runAndroidSystemApkDownloadFlow', () => {
  afterEach(() => {
    localStorage.removeItem(ANDROID_APK_DOWNLOAD_STATE_KEY);
    enqueueApkDownload.mockReset();
    getDownloadStatus.mockReset();
    openDownloadedApk.mockReset();
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
      expect(res.outcome).toBe('enqueued');
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
      expect(res.outcome).toBe('in_progress');
      expect(res.downloadId).toBe(7);
    }
    expect(enqueueApkDownload).not.toHaveBeenCalled();
  });

  it('liefert already_downloaded ohne zweiten enqueue', async () => {
    writeAndroidApkDownloadState({
      versionCode: 10030,
      downloadId: 7,
      filename: 'AMRtech-Payment-1.0.14.apk',
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

describe('openAndroidDownloadedApk', () => {
  afterEach(() => {
    openDownloadedApk.mockReset();
  });

  it('öffnet über downloadId ohne enqueue', async () => {
    openDownloadedApk.mockResolvedValue({ opened: true, via: 'download_uri' });
    const res = await openAndroidDownloadedApk(55);
    expect(res.ok).toBe(true);
    expect(openDownloadedApk).toHaveBeenCalledWith({ downloadId: 55 });
    expect(enqueueApkDownload).not.toHaveBeenCalled();
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

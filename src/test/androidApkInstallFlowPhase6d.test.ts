import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AndroidLatestManifest } from '../lib/androidApkUpdate';
import {
  resetAndroidInstallFlowInFlightForTests,
  runAndroidNativeApkInstallFlow,
  tryResumePendingAndroidInstallFlow,
  getPendingAndroidInstallManifestForTests,
} from '../lib/androidApkInstallFlow.permissionFirst';

const manifest: AndroidLatestManifest = {
  versionCode: 10044,
  latestVersion: '1.0.28',
  apkUrl: 'https://amrtech-payment-downloads.amrtech.workers.dev/android/e2e-browser-update/v10044/AMRtech-Payment-1.0.28.apk',
  sha256: 'cf3a31fb509b1f9b1d2efe826e26958f78ff440bdd57966a3a0c109990e4cf7c',
};

vi.mock('../lib/appUpdateInstaller.permissionFirst', () => ({
  AppUpdateInstallerPermissionFirst: {
    canInstallPackages: vi.fn(),
    openInstallPermissionSettings: vi.fn(),
    openApkFromCacheRelativePath: vi.fn(),
  },
}));

vi.mock('../lib/androidApkUpdate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/androidApkUpdate')>();
  return {
    ...actual,
    downloadAndroidApkToCache: vi.fn(async () => ({ relativePath: 'amrtech-payment-updates/amrtech-payment-update-10044.apk' })),
    resolveApkDownloadUrl: vi.fn(() => manifest.apkUrl!),
  };
});

import { AppUpdateInstallerPermissionFirst } from '../lib/appUpdateInstaller.permissionFirst';
import { downloadAndroidApkToCache } from '../lib/androidApkUpdate';

describe('androidApkInstallFlow permission-first (Phase 6D, inaktiv)', () => {
  beforeEach(() => {
    resetAndroidInstallFlowInFlightForTests();
    vi.mocked(AppUpdateInstallerPermissionFirst.canInstallPackages).mockResolvedValue({ canInstall: true });
    vi.mocked(AppUpdateInstallerPermissionFirst.openInstallPermissionSettings).mockResolvedValue(undefined);
    vi.mocked(AppUpdateInstallerPermissionFirst.openApkFromCacheRelativePath).mockResolvedValue(undefined);
    vi.mocked(downloadAndroidApkToCache).mockClear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAndroidInstallFlowInFlightForTests();
  });

  it('G1: startet Download nicht vor erteilter Installationsberechtigung', async () => {
    vi.mocked(AppUpdateInstallerPermissionFirst.canInstallPackages).mockResolvedValue({ canInstall: false });

    const res = await runAndroidNativeApkInstallFlow(manifest);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.awaitingPermission).toBe(true);
    }
    expect(AppUpdateInstallerPermissionFirst.openInstallPermissionSettings).toHaveBeenCalledTimes(1);
    expect(downloadAndroidApkToCache).not.toHaveBeenCalled();
    expect(AppUpdateInstallerPermissionFirst.openApkFromCacheRelativePath).not.toHaveBeenCalled();
  });

  it('G2: bei erteilter Berechtigung Download und Installer', async () => {
    const res = await runAndroidNativeApkInstallFlow(manifest);

    expect(res.ok).toBe(true);
    expect(downloadAndroidApkToCache).toHaveBeenCalledTimes(1);
    expect(AppUpdateInstallerPermissionFirst.openApkFromCacheRelativePath).toHaveBeenCalledTimes(1);
  });

  it('G3: Resume setzt pending Flow nach Permission-Freigabe fort', async () => {
    vi.mocked(AppUpdateInstallerPermissionFirst.canInstallPackages)
      .mockResolvedValueOnce({ canInstall: false })
      .mockResolvedValueOnce({ canInstall: true });

    const blocked = await runAndroidNativeApkInstallFlow(manifest);
    expect(blocked.ok).toBe(false);
    expect(getPendingAndroidInstallManifestForTests()?.versionCode).toBe(10044);

    const resumed = await tryResumePendingAndroidInstallFlow();
    expect(resumed?.ok).toBe(true);
    expect(downloadAndroidApkToCache).toHaveBeenCalledTimes(1);
    expect(getPendingAndroidInstallManifestForTests()).toBeNull();
  });
});

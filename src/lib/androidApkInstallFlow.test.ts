import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AndroidApkUpdateFlowError,
  apkBufferLooksLikeZipPackage,
  downloadAndroidApkToCache,
} from './androidApkUpdate';
import { runAndroidNativeApkInstallFlow } from './androidApkInstallFlow';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
  },
  registerPlugin: () => ({}),
}));

const writeFile = vi.fn();
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: (...args: unknown[]) => writeFile(...args),
  },
}));

const openApkFromCacheRelativePath = vi.fn();
vi.mock('./appUpdateInstaller', () => ({
  AppUpdateInstaller: {
    openApkFromCacheRelativePath: (...args: unknown[]) => openApkFromCacheRelativePath(...args),
  },
}));

function zipApkBuffer(): ArrayBuffer {
  const b = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  return b.buffer;
}

describe('runAndroidNativeApkInstallFlow', () => {
  afterEach(() => {
    writeFile.mockReset();
    openApkFromCacheRelativePath.mockReset();
    vi.unstubAllGlobals();
  });

  const manifest = {
    latestVersion: '1.0.25',
    versionCode: 10041,
    apkUrl:
      'https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.25/AMRtech-Payment-1.0.25.apk',
  };

  it('ein erfolgreicher Ablauf: fetch → Cache → genau ein Installer-Aufruf', async () => {
    writeFile.mockResolvedValue(undefined);
    openApkFromCacheRelativePath.mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/vnd.android.package-archive' },
        arrayBuffer: async () => zipApkBuffer(),
      }),
    );

    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledOnce();
    expect(openApkFromCacheRelativePath).toHaveBeenCalledOnce();
    expect(openApkFromCacheRelativePath).toHaveBeenCalledWith({
      relativePath: 'amrtech-payment-updates/AMRtech-Payment-update-10041.apk',
    });
  });

  it('Downloadfehler → kein Installer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        arrayBuffer: async () => zipApkBuffer(),
      }),
    );

    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
    expect(openApkFromCacheRelativePath).not.toHaveBeenCalled();
  });

  it('ungültige APK → kein Installer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/octet-stream' },
        arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
      }),
    );

    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
    expect(openApkFromCacheRelativePath).not.toHaveBeenCalled();
  });

  it('Speicherfehler → kein Installer', async () => {
    writeFile.mockRejectedValue(new Error('disk full'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/octet-stream' },
        arrayBuffer: async () => zipApkBuffer(),
      }),
    );

    const res = await runAndroidNativeApkInstallFlow(manifest);
    expect(res.ok).toBe(false);
    expect(openApkFromCacheRelativePath).not.toHaveBeenCalled();
  });
});

describe('downloadAndroidApkToCache helpers', () => {
  it('erkennt ZIP/APK-Header', () => {
    expect(apkBufferLooksLikeZipPackage(zipApkBuffer())).toBe(true);
    expect(apkBufferLooksLikeZipPackage(new Uint8Array([1, 2, 3, 4]).buffer)).toBe(false);
  });

  it('wirft invalid_apk bei kaputtem Buffer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => new Uint8Array([9, 9, 9, 9]).buffer,
      }),
    );
    await expect(
      downloadAndroidApkToCache({
        apkUrl: 'https://example.com/a.apk',
        manifest: { versionCode: 1 },
      }),
    ).rejects.toBeInstanceOf(AndroidApkUpdateFlowError);
  });
});

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNewerVersion, isSemverComparable } from './versionUtils';

/** Produktiv-Manifest Payment (einzige Update-URL). */
export const ANDROID_UPDATE_MANIFEST_URL =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json';

export const ANDROID_FALLBACK_APK_URL =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk';

/** Bekanntes JSON-Format (Wartung) + Payment-Feldnamen als Alias. */
export type AndroidLatestManifest = {
  platform?: string;
  latestVersion?: string;
  versionCode?: number;
  apkUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
};

export type AndroidInstalledSnapshot = {
  bundleSemver: string;
  nativeVersionCode: number | null;
  nativeVersionName: string;
};

export type AndroidUpdateVerdict =
  | { kind: 'newer'; basis: 'versionCode' | 'semver'; serverLabel: string }
  | { kind: 'current' }
  | { kind: 'uncertain'; reason: string };

function pickString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function pickNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return undefined;
}

export function parseAndroidLatestManifest(raw: unknown): AndroidLatestManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    platform: pickString(o.platform),
    latestVersion: pickString(o.latestVersion) ?? pickString(o.versionName),
    versionCode: pickNumber(o.versionCode),
    apkUrl: pickString(o.apkUrl) ?? pickString(o.downloadUrl),
    releaseNotes: pickString(o.releaseNotes),
    publishedAt: pickString(o.publishedAt),
  };
}

export function resolveAndroidUpdateManifestUrl(): string {
  const explicit = import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_URL?.trim();
  if (explicit) return explicit;
  return ANDROID_UPDATE_MANIFEST_URL;
}

export function resolveApkDownloadUrl(manifest: AndroidLatestManifest | null): string {
  const u = manifest?.apkUrl?.trim();
  if (u && u.startsWith('https://')) return u;
  return ANDROID_FALLBACK_APK_URL;
}

export function appendManifestFetchCacheBuster(manifestUrl: string, nonceMs: number): string {
  const trimmed = manifestUrl.trim();
  const disable =
    typeof import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_NO_CACHE_BUST === 'string' &&
    ['1', 'true', 'yes'].includes(
      import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_NO_CACHE_BUST.trim().toLowerCase(),
    );
  if (disable) return trimmed;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}_cb=${nonceMs}`;
}

export function compareAndroidInstallToManifest(
  installed: AndroidInstalledSnapshot,
  manifest: AndroidLatestManifest,
): AndroidUpdateVerdict {
  const mc = manifest.versionCode;
  const ic = installed.nativeVersionCode;
  if (typeof mc === 'number' && ic != null) {
    if (mc > ic) {
      return { kind: 'newer', basis: 'versionCode', serverLabel: String(mc) };
    }
    if (mc < ic) {
      return { kind: 'current' };
    }
    const lv = manifest.latestVersion?.trim();
    const bv = installed.bundleSemver.trim();
    if (lv && isSemverComparable(lv) && isSemverComparable(bv) && isNewerVersion(bv, lv)) {
      return { kind: 'newer', basis: 'semver', serverLabel: lv };
    }
    return { kind: 'current' };
  }

  const lv = manifest.latestVersion?.trim();
  const bv = installed.bundleSemver.trim();
  if (lv && isSemverComparable(lv) && isSemverComparable(bv)) {
    if (isNewerVersion(bv, lv)) {
      return { kind: 'newer', basis: 'semver', serverLabel: lv };
    }
    return { kind: 'current' };
  }

  if (lv != null && lv.length > 0) {
    return {
      kind: 'uncertain',
      reason:
        'Die gemeldete Version lässt sich nicht sicher mit dieser Installation vergleichen. Du kannst die APK trotzdem herunterladen und prüfen.',
    };
  }

  if (typeof mc === 'number') {
    return {
      kind: 'uncertain',
      reason:
        'Manifest enthält nur eine Build-Nummer ohne lokale Referenz. Du kannst die APK trotzdem herunterladen.',
    };
  }

  return {
    kind: 'uncertain',
    reason: 'Keine verwertbare Versionsangabe im Manifest — manueller Download möglich.',
  };
}

export function shouldOfferAndroidNativeApkInstall(
  installed: AndroidInstalledSnapshot,
  manifest: AndroidLatestManifest | null,
): boolean {
  const mc = manifest?.versionCode;
  const ic = installed.nativeVersionCode;
  return typeof mc === 'number' && typeof ic === 'number' && mc > ic;
}

export async function fetchAndroidLatestManifest(opts?: {
  manifestUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<AndroidLatestManifest | null> {
  const url = (opts?.manifestUrl ?? resolveAndroidUpdateManifestUrl()).trim();
  if (!url.startsWith('https://')) {
    return null;
  }
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const outer = opts?.signal;
  if (outer) {
    if (outer.aborted) {
      controller.abort();
    } else {
      outer.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  const fetchUrl = appendManifestFetchCacheBuster(url, Date.now());

  try {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const json: unknown = await res.json();
    return parseAndroidLatestManifest(json);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Relativ zu Directory.Cache — Wartungsmuster, Payment-Dateiname. */
export const ANDROID_APK_INTERNAL_SUBDIR = 'amrtech-updates';

export type AndroidApkUpdateFlowErrorCode =
  | 'wrong_platform'
  | 'offline'
  | 'invalid_url'
  | 'download_http'
  | 'download_network'
  | 'invalid_apk'
  | 'storage_failed';

export const INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX = 'install_source_blocked:';

const defaultFlowErrorMessages: Record<AndroidApkUpdateFlowErrorCode, string> = {
  wrong_platform: 'Dieser Ablauf ist nur in der Android-App verfügbar.',
  offline: 'Gerät offline — Update kann nicht heruntergeladen werden.',
  invalid_url: 'Ungültige Download-Adresse für die APK.',
  download_http: 'Download der APK fehlgeschlagen.',
  download_network: 'Netzwerkfehler beim Download.',
  invalid_apk: 'Die heruntergeladene APK-Datei ist ungültig.',
  storage_failed: 'Die APK konnte im App‑Speicher nicht gespeichert werden.',
};

export class AndroidApkUpdateFlowError extends Error {
  public readonly code: AndroidApkUpdateFlowErrorCode;

  constructor(code: AndroidApkUpdateFlowErrorCode, message?: string) {
    const m = typeof message === 'string' ? message.trim() : '';
    super(m.length > 0 ? m : defaultFlowErrorMessages[code]);
    this.name = 'AndroidApkUpdateFlowError';
    this.code = code;
  }
}

export function sanitizeAndroidApkFilenameTag(tag: string): string {
  const t = tag.trim();
  const collapsed = t.replace(/[^a-zA-Z0-9._+-]+/g, '_').replace(/^[_]+|[_]+$/g, '');
  return collapsed.slice(0, 64) || 'unknown';
}

export function deriveAndroidUpdateApkVersionTag(manifest: AndroidLatestManifest | null): string {
  const mc = manifest?.versionCode;
  if (typeof mc === 'number' && Number.isFinite(mc)) return String(Math.trunc(mc));
  const lv = manifest?.latestVersion?.trim();
  if (lv?.length) return lv;
  return 'latest';
}

export function resolveAndroidInternalApkRelativePath(
  manifest: AndroidLatestManifest | null,
): { relativePath: string; tag: string } {
  const tag = sanitizeAndroidApkFilenameTag(deriveAndroidUpdateApkVersionTag(manifest));
  return {
    tag,
    relativePath: `${ANDROID_APK_INTERNAL_SUBDIR}/AMRtech-Payment-update-${tag}.apk`,
  };
}

export function validateAndroidApkContentTypeHeader(raw: string | null | undefined): void {
  if (raw == null || typeof raw !== 'string') return;
  const part0 = raw.split(';')[0];
  const main = typeof part0 === 'string' ? part0.trim().toLowerCase() : '';
  if (!main?.length) return;
  const allowed = new Set([
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'binary/octet-stream',
    'application/binary',
    'application/x-binary',
  ]);
  if (allowed.has(main)) return;
  throw new AndroidApkUpdateFlowError('invalid_apk');
}

export function apkBufferLooksLikeZipPackage(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

export function arrayBufferToBase64Latin1(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let off = 0; off < bytes.byteLength; off += chunk) {
    const slice = bytes.subarray(off, off + chunk);
    for (let i = 0; i < slice.length; i++) {
      binary += String.fromCharCode(slice[i]!);
    }
  }
  const g = globalThis as typeof globalThis & { btoa?: (bin: string) => string };
  if (typeof g.btoa !== 'function') {
    throw new Error('Binary-Codierung: btoa fehlt (erwartete Web/Capacitor-Umgebung).');
  }
  return g.btoa(binary);
}

export async function downloadAndroidApkToCache(opts: {
  apkUrl: string;
  manifest: AndroidLatestManifest | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{ relativePath: string }> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new AndroidApkUpdateFlowError('wrong_platform');
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AndroidApkUpdateFlowError('offline');
  }

  const apkUrlRaw = opts.apkUrl.trim();
  if (!apkUrlRaw.startsWith('https://')) {
    throw new AndroidApkUpdateFlowError('invalid_url');
  }

  const timeoutMs = opts.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const outer = opts.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(apkUrlRaw, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    validateAndroidApkContentTypeHeader(res.headers.get('content-type'));
    if (!res.ok) {
      throw new AndroidApkUpdateFlowError('download_http', `HTTP ${String(res.status)}`);
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await res.arrayBuffer();
    } catch {
      throw new AndroidApkUpdateFlowError('download_network');
    }

    if (!apkBufferLooksLikeZipPackage(buffer)) {
      throw new AndroidApkUpdateFlowError('invalid_apk');
    }

    const { relativePath } = resolveAndroidInternalApkRelativePath(opts.manifest);
    const base64 = arrayBufferToBase64Latin1(buffer);

    try {
      await Filesystem.writeFile({
        path: relativePath,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
    } catch {
      throw new AndroidApkUpdateFlowError('storage_failed');
    }

    return { relativePath };
  } catch (e) {
    if (e instanceof AndroidApkUpdateFlowError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AndroidApkUpdateFlowError('download_network', 'Zeitüberschreitung oder Abbruch.');
    }
    throw new AndroidApkUpdateFlowError('download_network');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

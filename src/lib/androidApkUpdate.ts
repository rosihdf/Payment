import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNewerVersion, isSemverComparable } from './versionUtils';

/** Bekanntes JSON-Format unter `…/android/latest.json` (Cloudflare Worker/R2). */
export type AndroidLatestManifest = {
  platform?: string;
  latestVersion?: string;
  versionCode?: number;
  apkUrl?: string;
  sha256?: string;
  mandatory?: boolean;
  sourceCommit?: string;
  releaseNotes?: string;
  publishedAt?: string;
};

export const ANDROID_UPDATE_MANIFEST_DEFAULT_URL =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json';

export const ANDROID_FALLBACK_APK_URL =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk';

export const ANDROID_UPDATE_EXPECTED_HOST = 'amrtech-payment-downloads.amrtech.workers.dev';

export const ANDROID_APK_UPDATE_LOG_TAG = 'AmrPayUpdate';

/** Installierter Stand für den Vergleich (Web-Bundle + Gradle versionCode). */
export type AndroidInstalledSnapshot = {
  bundleSemver: string;
  nativeVersionCode: number | null;
  nativeVersionName: string;
};

export type AndroidUpdateVerdict =
  | { kind: 'newer'; basis: 'versionCode' | 'semver'; serverLabel: string }
  | { kind: 'current' }
  | { kind: 'uncertain'; reason: string };

const pickString = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

const pickNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return undefined;
};

const pickBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  return undefined;
};

export const parseAndroidLatestManifest = (raw: unknown): AndroidLatestManifest | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const sha = pickString(o.sha256);
  return {
    platform: pickString(o.platform),
    latestVersion: pickString(o.latestVersion) ?? pickString(o.versionName),
    versionCode: pickNumber(o.versionCode),
    apkUrl: pickString(o.apkUrl) ?? pickString(o.downloadUrl),
    sha256: sha ? sha.toLowerCase() : undefined,
    mandatory: pickBool(o.mandatory),
    sourceCommit: pickString(o.sourceCommit),
    releaseNotes: pickString(o.releaseNotes),
    publishedAt: pickString(o.publishedAt),
  };
};

export const resolveAndroidUpdateManifestUrl = (): string => {
  const explicit = import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_URL?.trim();
  if (explicit) return explicit;
  return ANDROID_UPDATE_MANIFEST_DEFAULT_URL;
};

export const resolveApkDownloadUrl = (manifest: AndroidLatestManifest | null): string => {
  const u = manifest?.apkUrl?.trim();
  if (u && u.startsWith('https://')) return u;
  return ANDROID_FALLBACK_APK_URL;
};

/** Wie {@link resolveApkDownloadUrl}, aber `null` wenn URL nicht HTTPS/Allowlist-konform ist. */
export const resolveValidatedApkDownloadUrl = (manifest: AndroidLatestManifest | null): string | null => {
  const fromManifest = manifest?.apkUrl?.trim();
  if (fromManifest) {
    return validateAllowedApkDownloadUrl(fromManifest) ? fromManifest : null;
  }
  return validateAllowedApkDownloadUrl(ANDROID_FALLBACK_APK_URL) ? ANDROID_FALLBACK_APK_URL : null;
};

/** Query-Only Cache-Buster für Manifest-Fetch. */
export const appendManifestFetchCacheBuster = (manifestUrl: string, nonceMs: number): string => {
  const trimmed = manifestUrl.trim();
  const disable =
    typeof import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_NO_CACHE_BUST === 'string' &&
    ['1', 'true', 'yes'].includes(
      import.meta.env.VITE_ANDROID_UPDATE_MANIFEST_NO_CACHE_BUST.trim().toLowerCase(),
    );
  if (disable) return trimmed;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}_cb=${nonceMs}`;
};

export const isValidSha256Hex = (value: string): boolean => /^[a-f0-9]{64}$/i.test(value.trim());

export const isHttpsUrlOnExpectedHost = (url: string, expectedHost?: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (expectedHost && parsed.hostname !== expectedHost) return false;
    return true;
  } catch {
    return false;
  }
};

export const validateAllowedApkDownloadUrl = (
  url: string,
  expectedHost: string = ANDROID_UPDATE_EXPECTED_HOST,
): boolean => isHttpsUrlOnExpectedHost(url.trim(), expectedHost);

/**
 * Validiert geparstes Manifest (HTTP-Response bereits OK angenommen).
 * `expectedHost` optional — leer lässt Host-Prüfung weg (Tests).
 */
export const validateParsedAndroidLatestManifest = (
  manifest: AndroidLatestManifest,
  opts?: { expectedHost?: string | null },
): boolean => {
  const mc = manifest.versionCode;
  if (typeof mc !== 'number' || !Number.isFinite(mc)) return false;
  const apkUrl = manifest.apkUrl?.trim();
  if (!apkUrl?.startsWith('https://')) return false;
  const host = opts?.expectedHost?.trim();
  if (host && !isHttpsUrlOnExpectedHost(apkUrl, host)) return false;
  if (manifest.sha256 != null && !isValidSha256Hex(manifest.sha256)) return false;
  return true;
};

export const compareAndroidInstallToManifest = (
  installed: AndroidInstalledSnapshot,
  manifest: AndroidLatestManifest,
): AndroidUpdateVerdict => {
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
};

export const shouldOfferAndroidNativeApkInstall = (
  installed: AndroidInstalledSnapshot,
  manifest: AndroidLatestManifest | null,
): boolean => {
  const mc = manifest?.versionCode;
  const ic = installed.nativeVersionCode;
  return typeof mc === 'number' && typeof ic === 'number' && mc > ic;
};

/** @deprecated Alias — bevorzugt {@link shouldOfferAndroidNativeApkInstall}. */
export const shouldOfferAndroidApkUpdate = shouldOfferAndroidNativeApkInstall;

export const fetchAndroidLatestManifest = async (opts?: {
  manifestUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  expectedHost?: string | null;
}): Promise<AndroidLatestManifest | null> => {
  const url = (opts?.manifestUrl ?? resolveAndroidUpdateManifestUrl()).trim();
  if (!url.startsWith('https://')) {
    console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'manifest_url_invalid', { url });
    return null;
  }
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const outer = opts?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const fetchUrl = appendManifestFetchCacheBuster(url, Date.now());
  const expectedHost =
    opts?.expectedHost === undefined ? ANDROID_UPDATE_EXPECTED_HOST : opts.expectedHost;

  if (expectedHost && !isHttpsUrlOnExpectedHost(url, expectedHost)) {
    console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'manifest_host_blocked', { url });
    return null;
  }

  try {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'manifest_http_error', { status: res.status });
      return null;
    }
    const json: unknown = await res.json();
    const parsed = parseAndroidLatestManifest(json);
    if (parsed == null || !validateParsedAndroidLatestManifest(parsed, { expectedHost })) {
      console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'manifest_invalid');
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn(ANDROID_APK_UPDATE_LOG_TAG, 'manifest_fetch_failed', e);
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/** Relativ zu {@link Directory.Cache} (Android native / FileProvider-Cache). */
export const ANDROID_APK_INTERNAL_SUBDIR = 'amrtech-payment-updates';

export const MIN_ANDROID_APK_BYTES = 512 * 1024;

export type AndroidApkUpdateFlowErrorCode =
  | 'wrong_platform'
  | 'offline'
  | 'invalid_url'
  | 'download_http'
  | 'download_network'
  | 'invalid_apk'
  | 'sha_mismatch'
  | 'storage_failed'
  | 'download_in_progress';

export const INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX = 'install_source_blocked:';

const defaultFlowErrorMessages: Record<AndroidApkUpdateFlowErrorCode, string> = {
  wrong_platform: 'Dieser Ablauf ist nur in der Android-App verfügbar.',
  offline: 'Gerät offline — Update kann nicht heruntergeladen werden.',
  invalid_url: 'Ungültige Download-Adresse für die APK.',
  download_http: 'Download der APK fehlgeschlagen.',
  download_network: 'Netzwerkfehler beim Download.',
  invalid_apk: 'Die heruntergeladene APK-Datei ist ungültig.',
  sha_mismatch: 'Prüfsumme der APK stimmt nicht mit dem Manifest überein.',
  storage_failed: 'Die APK konnte im App-Speicher nicht gespeichert werden.',
  download_in_progress: 'Download läuft bereits — bitte warten.',
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

export const sanitizeAndroidApkFilenameTag = (tag: string): string => {
  const t = tag.trim();
  const collapsed = t.replace(/[^a-zA-Z0-9._+-]+/g, '_').replace(/^[_]+|[_]+$/g, '');
  return collapsed.slice(0, 64) || 'unknown';
};

export const deriveAndroidUpdateApkVersionTag = (manifest: AndroidLatestManifest | null): string => {
  const mc = manifest?.versionCode;
  if (typeof mc === 'number' && Number.isFinite(mc)) return String(Math.trunc(mc));
  const lv = manifest?.latestVersion?.trim();
  if (lv?.length) return lv;
  return 'latest';
};

export const resolveAndroidInternalApkRelativePath = (
  manifest: AndroidLatestManifest | null,
): { relativePath: string; tag: string } => {
  const tag = sanitizeAndroidApkFilenameTag(deriveAndroidUpdateApkVersionTag(manifest));
  return {
    tag,
    relativePath: `${ANDROID_APK_INTERNAL_SUBDIR}/amrtech-payment-update-${tag}.apk`,
  };
};

/** Spiegelt die native Pfad-Traversal-Prüfung (Tests U9). */
export const isUnsafeAndroidCacheRelativePath = (rel: string): boolean => {
  const trimmed = rel.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.charAt(0) === '/' || trimmed.charAt(0) === '\\') return true;
  const unified = trimmed.replace(/\\/g, '/');
  return unified.split('/').some((seg) => seg === '..');
};

export const validateAndroidApkContentTypeHeader = (raw: string | null | undefined): void => {
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
};

export const apkBufferLooksLikeZipPackage = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
};

export const sha256HexFromBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const arrayBufferToBase64Latin1 = (buffer: ArrayBuffer): string => {
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
};

let downloadInFlight: Promise<{ relativePath: string }> | null = null;

export const resetAndroidApkDownloadInFlightForTests = (): void => {
  downloadInFlight = null;
};

export const validateDownloadedApkBuffer = async (
  buffer: ArrayBuffer,
  expectedSha256?: string,
): Promise<void> => {
  if (buffer.byteLength < MIN_ANDROID_APK_BYTES) {
    throw new AndroidApkUpdateFlowError('invalid_apk');
  }
  if (!apkBufferLooksLikeZipPackage(buffer)) {
    throw new AndroidApkUpdateFlowError('invalid_apk');
  }
  if (expectedSha256) {
    const hex = await sha256HexFromBuffer(buffer);
    if (hex.toLowerCase() !== expectedSha256.trim().toLowerCase()) {
      throw new AndroidApkUpdateFlowError('sha_mismatch');
    }
  }
};

export const readCachedApkBase64 = async (relativePath: string): Promise<string | null> => {
  if (isUnsafeAndroidCacheRelativePath(relativePath)) return null;
  try {
    const res = await Filesystem.readFile({
      path: relativePath,
      directory: Directory.Cache,
    });
    const data = typeof res.data === 'string' ? res.data : null;
    return data && data.length > 0 ? data : null;
  } catch {
    return null;
  }
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const g = globalThis as typeof globalThis & { atob?: (bin: string) => string };
  if (typeof g.atob !== 'function') {
    throw new Error('atob fehlt');
  }
  const binary = g.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const cachedApkMatchesManifest = async (
  relativePath: string,
  expectedSha256?: string,
): Promise<boolean> => {
  const b64 = await readCachedApkBase64(relativePath);
  if (b64 == null) return false;
  try {
    const buf = base64ToArrayBuffer(b64);
    await validateDownloadedApkBuffer(buf, expectedSha256);
    return true;
  } catch {
    try {
      await Filesystem.deleteFile({ path: relativePath, directory: Directory.Cache });
    } catch {
      /* ignore */
    }
    return false;
  }
};

/**
 * APK per `fetch` laden und per Filesystem im App-Cache halten — kein DownloadManager.
 * Nur für Capacitor Android.
 */
export const downloadAndroidApkToCache = async (opts: {
  apkUrl: string;
  manifest: AndroidLatestManifest | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{ relativePath: string }> => {
  if (downloadInFlight) {
    throw new AndroidApkUpdateFlowError('download_in_progress');
  }

  const run = async (): Promise<{ relativePath: string }> => {
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

    const { relativePath } = resolveAndroidInternalApkRelativePath(opts.manifest);
    const expectedSha = opts.manifest?.sha256;

    if (await cachedApkMatchesManifest(relativePath, expectedSha)) {
      console.info(ANDROID_APK_UPDATE_LOG_TAG, 'reuse_cached_apk', { relativePath });
      return { relativePath };
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

      await validateDownloadedApkBuffer(buffer, expectedSha);

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

      console.info(ANDROID_APK_UPDATE_LOG_TAG, 'apk_cached', { relativePath, bytes: buffer.byteLength });
      return { relativePath };
    } catch (e) {
      if (e instanceof AndroidApkUpdateFlowError) throw e;
      const dom = e;
      if (dom instanceof DOMException && dom.name === 'AbortError') {
        throw new AndroidApkUpdateFlowError('download_network', 'Zeitüberschreitung oder Abbruch.');
      }
      throw new AndroidApkUpdateFlowError('download_network');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  downloadInFlight = run();
  try {
    return await downloadInFlight;
  } finally {
    downloadInFlight = null;
  }
};

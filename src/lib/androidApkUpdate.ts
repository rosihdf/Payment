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

/** Exakter Host-Vergleich — keine Subdomain-Tricks. */
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
 * SHA im Manifest wird nur formatiert geprüft — keine lokale APK-Verifikation.
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
        'Die gemeldete Version lässt sich nicht sicher mit dieser Installation vergleichen. Du kannst die APK trotzdem im Browser laden und prüfen.',
    };
  }

  if (typeof mc === 'number') {
    return {
      kind: 'uncertain',
      reason:
        'Manifest enthält nur eine Build-Nummer ohne lokale Referenz. Du kannst die APK trotzdem im Browser laden.',
    };
  }

  return {
    kind: 'uncertain',
    reason: 'Keine verwertbare Versionsangabe im Manifest — manueller Download möglich.',
  };
};

/** Update anbieten nur bei höherem serverseitigen versionCode. */
export const shouldOfferAndroidApkUpdate = (
  installed: AndroidInstalledSnapshot,
  manifest: AndroidLatestManifest | null,
): boolean => {
  const mc = manifest?.versionCode;
  const ic = installed.nativeVersionCode;
  return typeof mc === 'number' && typeof ic === 'number' && mc > ic;
};

/** @deprecated Alias für ältere Aufrufer — bevorzugt {@link shouldOfferAndroidApkUpdate}. */
export const shouldOfferAndroidNativeApkInstall = shouldOfferAndroidApkUpdate;

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

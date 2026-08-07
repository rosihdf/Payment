export const ANDROID_UPDATE_MANIFEST_URL =
  'https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json';

export {
  ANDROID_UPDATE_MANIFEST_URL_PRODUCTION,
  ANDROID_UPDATE_MANIFEST_URL_TEST,
  type AppUpdateChannel,
} from './appUpdateChannel';

export const APP_UPDATE_FETCH_TIMEOUT_MS = 12_000;
export const APP_UPDATE_DOWNLOAD_TIMEOUT_MS = 180_000;

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'mandatory'
  | 'downloading'
  | 'verifying'
  | 'readyToInstall'
  | 'installing'
  | 'offline'
  | 'error';

export interface UpdateManifest {
  versionName: string;
  versionCode: number;
  minimumVersionCode: number;
  mandatory: boolean;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  releaseNotes: string;
  releaseTag: string;
  sourceCommit: string;
}

export interface AppUpdateSnapshot {
  status: AppUpdateStatus;
  installedVersionName: string;
  installedVersionCode: number;
  manifest: UpdateManifest | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  isNativeAndroid: boolean;
  /** Banner-Snooze für optionale Updates (App-Info bleibt verfügbar). */
  optionalDismissed: boolean;
  downloadProgress: number | null;
  downloadBytesReceived: number | null;
  downloadBytesTotal: number | null;
  localApkRelativePath: string | null;
  needsUnknownSourcesPermission: boolean;
  /** production | test – steuert Manifest-URL. */
  updateChannel: 'production' | 'test';
  developerModeEnabled: boolean;
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown, field: string, issues: string[]): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(`Feld "${field}" fehlt oder ist leer.`);
    return null;
  }
  return value.trim();
}

function asPositiveInt(value: unknown, field: string, issues: string[]): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    issues.push(`Feld "${field}" muss eine positive Ganzzahl sein.`);
    return null;
  }
  return value;
}

function assertHttpsUrl(value: string, field: string, issues: string[]): void {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      issues.push(`Feld "${field}" muss HTTPS verwenden.`);
    }
  } catch {
    issues.push(`Feld "${field}" ist keine gültige URL.`);
  }
}

/** Validiert und normalisiert ein Remote-Manifest. Ungültige Manifeste werden abgelehnt. */
export function parseUpdateManifest(raw: unknown):
  | { ok: true; manifest: UpdateManifest }
  | { ok: false; issues: string[] } {
  const record = asRecord(raw);
  if (!record) {
    return { ok: false, issues: ['Manifest ist kein JSON-Objekt.'] };
  }

  const issues: string[] = [];
  const versionName = asNonEmptyString(record.versionName, 'versionName', issues);
  const versionCode = asPositiveInt(record.versionCode, 'versionCode', issues);
  const minimumVersionCode = asPositiveInt(
    record.minimumVersionCode,
    'minimumVersionCode',
    issues,
  );
  const downloadUrl = asNonEmptyString(record.downloadUrl, 'downloadUrl', issues);
  const sha256 = asNonEmptyString(record.sha256, 'sha256', issues);
  const releaseNotes = asNonEmptyString(record.releaseNotes, 'releaseNotes', issues);
  const sourceCommit = asNonEmptyString(record.sourceCommit, 'sourceCommit', issues);
  let releaseTag =
    asNonEmptyString(record.releaseTag, 'releaseTag', []) ??
    asNonEmptyString(record.tag, 'tag', []);
  if (!releaseTag) {
    issues.push('Feld "releaseTag" fehlt oder ist leer.');
  }
  let publishedAt = asNonEmptyString(record.publishedAt, 'publishedAt', []);
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) {
    issues.push('Feld "publishedAt" ist kein gültiger Zeitstempel.');
    publishedAt = null;
  }
  if (!publishedAt) {
    publishedAt = '1970-01-01T00:00:00.000Z';
  }

  if (typeof record.mandatory !== 'boolean') {
    issues.push('Feld "mandatory" muss boolean sein.');
  }
  if (typeof record.sizeBytes !== 'number' || !Number.isInteger(record.sizeBytes) || record.sizeBytes < 1) {
    issues.push('Feld "sizeBytes" muss eine positive Ganzzahl sein.');
  }
  if (sha256 && !SHA256_HEX.test(sha256)) {
    issues.push('Feld "sha256" muss 64 hexadezimale Zeichen enthalten.');
  }
  if (downloadUrl) {
    assertHttpsUrl(downloadUrl, 'downloadUrl', issues);
  }

  if (
    issues.length > 0 ||
    !versionName ||
    versionCode == null ||
    minimumVersionCode == null ||
    !downloadUrl ||
    !sha256 ||
    !releaseNotes ||
    !releaseTag ||
    !sourceCommit
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    manifest: {
      versionName,
      versionCode,
      minimumVersionCode,
      mandatory: record.mandatory === true,
      downloadUrl,
      sha256: sha256.toLowerCase(),
      sizeBytes: record.sizeBytes as number,
      publishedAt,
      releaseNotes,
      releaseTag,
      sourceCommit,
    },
  };
}

export function deriveUpdateStatus(
  installedVersionCode: number,
  manifest: UpdateManifest,
): Extract<AppUpdateStatus, 'current' | 'available' | 'mandatory'> {
  const remoteNewer = manifest.versionCode > installedVersionCode;
  const belowMinimum = installedVersionCode < manifest.minimumVersionCode;

  if (!remoteNewer && !belowMinimum) {
    return 'current';
  }

  if (remoteNewer && (manifest.mandatory || belowMinimum)) {
    return 'mandatory';
  }

  if (belowMinimum) {
    return 'mandatory';
  }

  return 'available';
}

export function isUpdateOfferStatus(status: AppUpdateStatus): boolean {
  return (
    status === 'available' ||
    status === 'mandatory' ||
    status === 'downloading' ||
    status === 'verifying' ||
    status === 'readyToInstall' ||
    status === 'installing'
  );
}

export function createInitialAppUpdateSnapshot(
  installedVersionName: string,
  installedVersionCode: number,
  isNativeAndroid: boolean,
  updateChannel: 'production' | 'test' = 'production',
  developerModeEnabled = false,
): AppUpdateSnapshot {
  return {
    status: isNativeAndroid ? 'idle' : 'current',
    installedVersionName,
    installedVersionCode,
    manifest: null,
    lastCheckedAt: null,
    errorMessage: isNativeAndroid ? null : 'Updateprüfung nur in der nativen Android-App.',
    isNativeAndroid,
    optionalDismissed: false,
    downloadProgress: null,
    downloadBytesReceived: null,
    downloadBytesTotal: null,
    localApkRelativePath: null,
    needsUnknownSourcesPermission: false,
    updateChannel,
    developerModeEnabled,
  };
}

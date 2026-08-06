import {
  ANDROID_UPDATE_MANIFEST_URL,
  APP_UPDATE_FETCH_TIMEOUT_MS,
  type AppUpdateSnapshot,
  type AppUpdateStatus,
  type UpdateManifest,
  deriveUpdateStatus,
  parseUpdateManifest,
} from '../domain/appUpdate/updateManifest';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/appInfo';
import { isNativeAndroid } from '../utils/nativePlatform';

export type AppUpdateFetch = typeof fetch;

export interface AppUpdateServiceOptions {
  fetchImpl?: AppUpdateFetch;
  manifestUrl?: string;
  timeoutMs?: number;
  installedVersionName?: string;
  installedVersionCode?: number;
  isNativeAndroidFn?: () => boolean;
  now?: () => string;
  openUrl?: (url: string) => void;
  /** Diagnoseausgaben für Logcat/WebView – keine Secrets. */
  log?: (event: string, details?: Record<string, string | number | boolean | null>) => void;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function defaultOpenUrl(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function defaultLog(event: string, details: Record<string, string | number | boolean | null> = {}): void {
  if (import.meta.env.MODE === 'test') {
    return;
  }
  // Capacitor/WebView: sichtbar in logcat (chromium console).
  console.info(`[AppUpdate] ${event}`, details);
}

function manifestHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

export class AppUpdateService {
  private readonly fetchImpl: AppUpdateFetch;
  private readonly manifestUrl: string;
  private readonly timeoutMs: number;
  private readonly installedVersionName: string;
  private readonly installedVersionCode: number;
  private readonly isNativeAndroidFn: () => boolean;
  private readonly now: () => string;
  private readonly openUrl: (url: string) => void;
  private readonly log: (
    event: string,
    details?: Record<string, string | number | boolean | null>,
  ) => void;

  private snapshot: AppUpdateSnapshot;
  private checkPromise: Promise<AppUpdateSnapshot> | null = null;

  constructor(options: AppUpdateServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.manifestUrl = options.manifestUrl ?? ANDROID_UPDATE_MANIFEST_URL;
    this.timeoutMs = options.timeoutMs ?? APP_UPDATE_FETCH_TIMEOUT_MS;
    this.installedVersionName = options.installedVersionName ?? APP_VERSION;
    this.installedVersionCode = options.installedVersionCode ?? APP_VERSION_CODE;
    this.isNativeAndroidFn = options.isNativeAndroidFn ?? isNativeAndroid;
    this.now = options.now ?? (() => new Date().toISOString());
    this.openUrl = options.openUrl ?? defaultOpenUrl;
    this.log = options.log ?? defaultLog;

    const native = this.isNativeAndroidFn();
    this.snapshot = {
      status: native ? 'checking' : 'current',
      installedVersionName: this.installedVersionName,
      installedVersionCode: this.installedVersionCode,
      manifest: null,
      lastCheckedAt: null,
      errorMessage: native ? null : 'Updateprüfung nur in der nativen Android-App.',
      isNativeAndroid: native,
      optionalDismissed: false,
    };
  }

  getSnapshot(): AppUpdateSnapshot {
    return { ...this.snapshot, manifest: this.snapshot.manifest };
  }

  /** Web/PWA: keine native APK-Updateprüfung. */
  shouldAutoCheck(): boolean {
    return this.isNativeAndroidFn();
  }

  async checkForUpdate(options: { manual?: boolean } = {}): Promise<AppUpdateSnapshot> {
    if (!this.isNativeAndroidFn() && !options.manual) {
      this.snapshot = {
        ...this.snapshot,
        status: 'current',
        isNativeAndroid: false,
        errorMessage: 'Updateprüfung nur in der nativen Android-App.',
      };
      return this.getSnapshot();
    }

    if (!this.isNativeAndroidFn() && options.manual) {
      this.snapshot = {
        ...this.snapshot,
        status: 'current',
        isNativeAndroid: false,
        lastCheckedAt: this.now(),
        errorMessage: 'Im Browser/PWA prüft der Service Worker Updates – keine APK-Updateprüfung.',
      };
      return this.getSnapshot();
    }

    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.snapshot = {
      ...this.snapshot,
      status: 'checking',
      errorMessage: null,
      isNativeAndroid: true,
    };

    this.checkPromise = this.runCheck().finally(() => {
      this.checkPromise = null;
    });
    return this.checkPromise;
  }

  dismissOptionalUpdate(): void {
    if (this.snapshot.status === 'available') {
      this.snapshot = { ...this.snapshot, optionalDismissed: true };
    }
  }

  clearOptionalDismissal(): void {
    this.snapshot = { ...this.snapshot, optionalDismissed: false };
  }

  /**
   * Lädt die HTTPS-APK, prüft SHA-256 soweit möglich und öffnet danach die finale Download-URL.
   * Die Android-Paketsignatur bleibt die entscheidende Installationsprüfung.
   */
  async openVerifiedDownload(): Promise<{ ok: true } | { ok: false; error: string }> {
    const manifest = this.snapshot.manifest;
    if (!manifest) {
      return { ok: false, error: 'Kein Update-Manifest vorhanden.' };
    }
    if (!manifest.downloadUrl.startsWith('https://')) {
      return { ok: false, error: 'Download-URL muss HTTPS verwenden.' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(this.timeoutMs, 60_000));
      const response = await this.fetchImpl(manifest.downloadUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (!response.ok) {
        return { ok: false, error: `Download fehlgeschlagen (HTTP ${response.status}).` };
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== manifest.sizeBytes) {
        return {
          ok: false,
          error: `Dateigröße weicht ab (erwartet ${manifest.sizeBytes}, erhalten ${buffer.byteLength}).`,
        };
      }
      const hash = await sha256Hex(buffer);
      if (hash !== manifest.sha256) {
        return { ok: false, error: 'SHA-256 des Downloads stimmt nicht mit dem Manifest überein.' };
      }
      this.openUrl(manifest.downloadUrl);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Download-Zeitüberschreitung.'
          : 'Download oder Hashprüfung fehlgeschlagen.';
      return { ok: false, error: message };
    }
  }

  private async runCheck(): Promise<AppUpdateSnapshot> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const host = manifestHost(this.manifestUrl);
    const navigatorOnline =
      typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : null;

    this.log('check_start', {
      host,
      timeoutMs: this.timeoutMs,
      navigatorOnline,
      installedVersionCode: this.installedVersionCode,
    });

    try {
      // navigator.onLine bewusst nicht als Vorab-Abbruch – WebView meldet oft falsch.
      const response = await this.fetchImpl(this.manifestUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      this.log('check_http', {
        host,
        status: response.status,
        contentType: response.headers.get('content-type'),
        aborted: false,
      });

      if (!response.ok) {
        return this.setError('Update-Server nicht erreichbar.', 'error', {
          host,
          httpStatus: response.status,
          errorClass: 'http',
        });
      }

      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        return this.setError('Update-Informationen sind ungültig.', 'error', {
          host,
          httpStatus: response.status,
          errorClass: 'json_parse',
          jsonValid: false,
        });
      }

      const parsed = parseUpdateManifest(raw);
      if (!parsed.ok) {
        return this.setError('Update-Informationen sind ungültig.', 'error', {
          host,
          httpStatus: response.status,
          errorClass: 'schema',
          jsonValid: false,
          issues: parsed.issues.slice(0, 3).join('; '),
        });
      }

      const status = deriveUpdateStatus(this.installedVersionCode, parsed.manifest);
      this.snapshot = {
        status,
        installedVersionName: this.installedVersionName,
        installedVersionCode: this.installedVersionCode,
        manifest: parsed.manifest,
        lastCheckedAt: this.now(),
        errorMessage: null,
        isNativeAndroid: true,
        optionalDismissed: status === 'available' ? this.snapshot.optionalDismissed : false,
      };
      this.log('check_ok', {
        host,
        status,
        remoteVersionCode: parsed.manifest.versionCode,
        jsonValid: true,
      });
      return this.getSnapshot();
    } catch (error) {
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String((error as { name: unknown }).name)
          : 'Unknown';
      const message = error instanceof Error ? error.message : String(error);
      const aborted = name === 'AbortError';

      if (aborted) {
        return this.setError('Zeitüberschreitung bei der Updateprüfung.', 'error', {
          host,
          errorClass: 'timeout',
          errorName: name,
          aborted: true,
        });
      }

      // Nur wenn OS/Browser explizit offline meldet – sonst kein sicherer Offline-Nachweis.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return this.setError('Keine Internetverbindung.', 'offline', {
          host,
          errorClass: 'offline',
          errorName: name,
          navigatorOnline: false,
        });
      }

      // Typisch CORS/DNS/TLS bei ansonsten bestehender Verbindung (Capacitor https://localhost).
      return this.setError('Update-Informationen konnten nicht geladen werden.', 'error', {
        host,
        errorClass: 'network_or_cors',
        errorName: name,
        errorMessage: message.slice(0, 160),
        navigatorOnline,
      });
    } finally {
      clearTimeout(timer);
      this.log('check_end', { host });
    }
  }

  private setError(
    message: string,
    status: Extract<AppUpdateStatus, 'error' | 'offline'> = 'error',
    details: Record<string, string | number | boolean | null> = {},
  ): AppUpdateSnapshot {
    this.log('check_error', { status, userMessage: message, ...details });
    this.snapshot = {
      ...this.snapshot,
      status,
      errorMessage: message,
      lastCheckedAt: this.now(),
      isNativeAndroid: this.isNativeAndroidFn(),
    };
    return this.getSnapshot();
  }
}

export function createAppUpdateService(options?: AppUpdateServiceOptions): AppUpdateService {
  return new AppUpdateService(options);
}

export type { UpdateManifest };

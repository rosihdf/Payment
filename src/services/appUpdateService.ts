import {
  APP_UPDATE_AUTO_CHECK_INTERVAL_MS,
  APP_UPDATE_SNOOZE_MS,
  type AppUpdatePreferenceStore,
  createLocalStoragePreferenceStore,
  isUpdateVersionSnoozed,
  recordAutomaticCheck,
  shouldRunAutomaticCheck,
  snoozeUpdateVersion,
  clearUpdateSnooze,
} from '../domain/appUpdate/appUpdatePreferences';
import {
  type AppUpdateChannel,
  manifestUrlForChannel,
  readAppUpdateChannel,
  readDeveloperModeEnabled,
  writeAppUpdateChannel,
  writeDeveloperModeEnabled,
} from '../domain/appUpdate/appUpdateChannel';
import {
  APP_UPDATE_DOWNLOAD_TIMEOUT_MS,
  APP_UPDATE_FETCH_TIMEOUT_MS,
  type AppUpdateSnapshot,
  type AppUpdateStatus,
  type UpdateManifest,
  createInitialAppUpdateSnapshot,
  deriveUpdateStatus,
  isUpdateOfferStatus,
  parseUpdateManifest,
} from '../domain/appUpdate/updateManifest';
import {
  type ApkCacheWriter,
  type ApkInstallerBridge,
  INSTALL_SOURCE_BLOCKED,
  apkRelativePathForVersion,
  createFilesystemApkCacheWriter,
  createNativeApkInstallerBridge,
} from '../native/apkUpdateNative';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/appInfo';
import { isNativeAndroid } from '../utils/nativePlatform';

export type AppUpdateFetch = typeof fetch;
export type AppUpdateListener = (snapshot: AppUpdateSnapshot) => void;

export interface AppUpdateServiceOptions {
  fetchImpl?: AppUpdateFetch;
  manifestUrl?: string;
  timeoutMs?: number;
  downloadTimeoutMs?: number;
  installedVersionName?: string;
  installedVersionCode?: number;
  isNativeAndroidFn?: () => boolean;
  now?: () => string;
  nowMs?: () => number;
  /** Nur Notfall-Fallback – nicht der normale Installationspfad. */
  openUrl?: (url: string) => void;
  preferenceStore?: AppUpdatePreferenceStore;
  autoCheckIntervalMs?: number;
  snoozeMs?: number;
  apkCache?: ApkCacheWriter;
  /** Teilweise stubs in Tests erlaubt; fehlendes getInstalledVersion fällt auf Build-Konstanten zurück. */
  apkInstaller?: Partial<ApkInstallerBridge>;
  log?: (event: string, details?: Record<string, string | number | boolean | null>) => void;
  updateChannel?: AppUpdateChannel;
  developerModeEnabled?: boolean;
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
  console.info(`[AppUpdate] ${event}`, details);
}

function manifestHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function looksLikeApkZip(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) {
    return false;
  }
  const view = new Uint8Array(buffer);
  return view[0] === 0x50 && view[1] === 0x4b;
}

export class AppUpdateService {
  private readonly fetchImpl: AppUpdateFetch;
  private manifestUrl: string;
  private readonly timeoutMs: number;
  private readonly downloadTimeoutMs: number;
  private installedVersionName: string;
  private installedVersionCode: number;
  private readonly isNativeAndroidFn: () => boolean;
  private readonly now: () => string;
  private readonly nowMs: () => number;
  private readonly openUrl: (url: string) => void;
  private readonly preferenceStore: AppUpdatePreferenceStore;
  private readonly autoCheckIntervalMs: number;
  private readonly snoozeMs: number;
  private readonly apkCache: ApkCacheWriter;
  private readonly apkInstaller: ApkInstallerBridge;
  private readonly log: (
    event: string,
    details?: Record<string, string | number | boolean | null>,
  ) => void;

  private snapshot: AppUpdateSnapshot;
  private checkPromise: Promise<AppUpdateSnapshot> | null = null;
  private installPromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null;
  private reconcilePromise: Promise<AppUpdateSnapshot> | null = null;
  private downloadAbort: AbortController | null = null;
  /** Nach Installer-Öffnung: nächstes Resume erzwingt Versions-Reconcile. */
  private awaitingInstallerReturn = false;
  private readonly listeners = new Set<AppUpdateListener>();

  constructor(options: AppUpdateServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? APP_UPDATE_FETCH_TIMEOUT_MS;
    this.downloadTimeoutMs = options.downloadTimeoutMs ?? APP_UPDATE_DOWNLOAD_TIMEOUT_MS;
    this.installedVersionName = options.installedVersionName ?? APP_VERSION;
    this.installedVersionCode = options.installedVersionCode ?? APP_VERSION_CODE;
    this.isNativeAndroidFn = options.isNativeAndroidFn ?? isNativeAndroid;
    this.now = options.now ?? (() => new Date().toISOString());
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.openUrl = options.openUrl ?? defaultOpenUrl;
    this.preferenceStore = options.preferenceStore ?? createLocalStoragePreferenceStore();
    this.autoCheckIntervalMs = options.autoCheckIntervalMs ?? APP_UPDATE_AUTO_CHECK_INTERVAL_MS;
    this.snoozeMs = options.snoozeMs ?? APP_UPDATE_SNOOZE_MS;
    this.apkCache = options.apkCache ?? createFilesystemApkCacheWriter();
    const nativeInstaller = createNativeApkInstallerBridge();
    const partial = options.apkInstaller ?? {};
    this.apkInstaller = {
      openFromCache: partial.openFromCache ?? nativeInstaller.openFromCache,
      openUnknownSourcesSettings:
        partial.openUnknownSourcesSettings ?? nativeInstaller.openUnknownSourcesSettings,
      getInstalledVersion:
        partial.getInstalledVersion ??
        (async () => ({
          versionName: this.installedVersionName,
          versionCode: this.installedVersionCode,
        })),
    };
    this.log = options.log ?? defaultLog;

    const channel =
      options.updateChannel ?? readAppUpdateChannel(this.preferenceStore);
    const developerMode =
      options.developerModeEnabled ?? readDeveloperModeEnabled(this.preferenceStore);
    this.manifestUrl = options.manifestUrl ?? manifestUrlForChannel(channel);

    this.snapshot = createInitialAppUpdateSnapshot(
      this.installedVersionName,
      this.installedVersionCode,
      this.isNativeAndroidFn(),
      channel,
      developerMode,
    );
  }

  subscribe(listener: AppUpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AppUpdateSnapshot {
    return { ...this.snapshot, manifest: this.snapshot.manifest };
  }

  shouldAutoCheck(): boolean {
    return this.isNativeAndroidFn();
  }

  shouldRunAutomaticCheck(): boolean {
    if (!this.shouldAutoCheck()) {
      return false;
    }
    return shouldRunAutomaticCheck(
      this.preferenceStore,
      this.nowMs(),
      this.autoCheckIntervalMs,
    );
  }

  /**
   * Optionales Banner bzw. Fortschrittsbanner (kein Pflichtupdate-Overlay).
   * Pflichtupdate nutzt AppUpdateGate; während Download trotzdem Fortschritt im Banner.
   */
  shouldShowOptionalBanner(): boolean {
    const { status, manifest, isNativeAndroid: native, optionalDismissed } = this.snapshot;
    if (!native || !manifest) {
      return false;
    }

    const activeTransfer =
      status === 'downloading' || status === 'verifying' || status === 'installing';

    if (manifest.mandatory) {
      return activeTransfer;
    }

    if (activeTransfer) {
      return true;
    }

    if (status !== 'available' && status !== 'readyToInstall' && status !== 'error') {
      return false;
    }

    if (isUpdateVersionSnoozed(this.preferenceStore, manifest.versionCode, this.nowMs())) {
      return false;
    }

    return !optionalDismissed;
  }

  /** Später nur im Banner bei optionalem Update, nicht während Download. */
  shouldShowBannerLaterAction(): boolean {
    if (!this.shouldShowOptionalBanner() || !this.snapshot.manifest) {
      return false;
    }
    if (this.snapshot.manifest.mandatory) {
      return false;
    }
    const { status } = this.snapshot;
    return status === 'available' || status === 'readyToInstall' || status === 'error';
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private patch(partial: Partial<AppUpdateSnapshot>): AppUpdateSnapshot {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
    return this.getSnapshot();
  }

  async checkForUpdate(
    options: { manual?: boolean; automatic?: boolean } = {},
  ): Promise<AppUpdateSnapshot> {
    if (!this.isNativeAndroidFn() && !options.manual) {
      return this.patch({
        status: 'current',
        isNativeAndroid: false,
        errorMessage: 'Updateprüfung nur in der nativen Android-App.',
      });
    }

    if (!this.isNativeAndroidFn() && options.manual) {
      return this.patch({
        status: 'current',
        isNativeAndroid: false,
        lastCheckedAt: this.now(),
        errorMessage: 'Im Browser/PWA prüft der Service Worker Updates – keine APK-Updateprüfung.',
      });
    }

    if (
      this.snapshot.status === 'downloading' ||
      this.snapshot.status === 'verifying' ||
      this.snapshot.status === 'installing'
    ) {
      return this.getSnapshot();
    }

    if (options.automatic && !this.shouldRunAutomaticCheck()) {
      this.log('auto_check_skipped', {
        reason: 'interval',
        intervalMs: this.autoCheckIntervalMs,
      });
      return this.getSnapshot();
    }

    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.patch({
      status: 'checking',
      errorMessage: null,
      isNativeAndroid: true,
      needsUnknownSourcesPermission: false,
    });

    this.checkPromise = (async () => {
      try {
        return await this.runCheck();
      } finally {
        if (options.automatic) {
          recordAutomaticCheck(this.preferenceStore, this.nowMs());
          this.log('auto_check_recorded', { at: this.nowMs() });
        }
      }
    })().finally(() => {
      this.checkPromise = null;
    });

    return this.checkPromise;
  }

  /** Nur Banner: Snooze 24h für die angebotene Version. App-Info bleibt auf available. */
  dismissOptionalUpdate(): void {
    if (!this.snapshot.manifest || this.snapshot.manifest.mandatory) {
      return;
    }
    if (
      this.snapshot.status !== 'available' &&
      this.snapshot.status !== 'readyToInstall' &&
      this.snapshot.status !== 'error'
    ) {
      return;
    }
    const versionCode = this.snapshot.manifest.versionCode;
    snoozeUpdateVersion(this.preferenceStore, versionCode, this.nowMs(), this.snoozeMs);
    this.patch({ optionalDismissed: true });
    this.log('banner_snoozed', { versionCode, snoozeMs: this.snoozeMs });
  }

  clearOptionalDismissal(): void {
    clearUpdateSnooze(this.preferenceStore);
    this.patch({ optionalDismissed: false });
  }

  /**
   * Nativer Download → SHA → Installer. Kein Browser.
   */
  async startInstall(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!this.isNativeAndroidFn()) {
      return { ok: false, error: 'Installation nur in der nativen Android-App.' };
    }
    if (this.installPromise) {
      return this.installPromise;
    }
    if (this.snapshot.status === 'readyToInstall' && this.snapshot.localApkRelativePath) {
      return this.openInstaller();
    }

    this.installPromise = this.runNativeInstall().finally(() => {
      this.installPromise = null;
    });
    return this.installPromise;
  }

  async cancelDownload(): Promise<void> {
    if (this.downloadAbort) {
      this.downloadAbort.abort();
    }
  }

  async openInstaller(): Promise<{ ok: true } | { ok: false; error: string }> {
    const path = this.snapshot.localApkRelativePath;
    if (!path) {
      return { ok: false, error: 'Keine lokale Update-Datei vorhanden.' };
    }
    this.patch({
      status: 'installing',
      errorMessage: null,
      needsUnknownSourcesPermission: false,
    });
    try {
      this.awaitingInstallerReturn = true;
      await this.apkInstaller.openFromCache(path);
      // Nutzer kann Installer abbrechen → bereit halten, bis Resume die Version prüft.
      this.patch({ status: 'readyToInstall' });
      return { ok: true };
    } catch (error) {
      this.awaitingInstallerReturn = false;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(INSTALL_SOURCE_BLOCKED) || (error instanceof Error && error.name === INSTALL_SOURCE_BLOCKED)) {
        this.patch({
          status: 'readyToInstall',
          needsUnknownSourcesPermission: true,
          errorMessage:
            'Android blockiert die Installation aus dieser Quelle. Bitte erlauben und danach „Installation starten“ tippen.',
        });
        return { ok: false, error: this.snapshot.errorMessage ?? message };
      }
      this.patch({
        status: 'readyToInstall',
        errorMessage: 'Der Installer konnte nicht geöffnet werden.',
      });
      return { ok: false, error: this.snapshot.errorMessage ?? message };
    }
  }

  async openUnknownSourcesSettings(): Promise<void> {
    await this.apkInstaller.openUnknownSourcesSettings();
  }

  /** Expliziter Notfall-Fallback – nicht Teil des normalen Pfads. */
  openBrowserFallback(): { ok: true } | { ok: false; error: string } {
    const url = this.snapshot.manifest?.downloadUrl;
    if (!url?.startsWith('https://')) {
      return { ok: false, error: 'Keine Download-URL verfügbar.' };
    }
    this.openUrl(url);
    return { ok: true };
  }

  /** Nach Upgrade oder wenn installierte Version >= remote. */
  resetAfterSuccessfulUpgrade(): void {
    const path = this.snapshot.localApkRelativePath;
    if (path) {
      void this.apkCache.delete(path);
    }
    clearUpdateSnooze(this.preferenceStore);
    this.awaitingInstallerReturn = false;
    this.patch({
      ...createInitialAppUpdateSnapshot(
        this.installedVersionName,
        this.installedVersionCode,
        this.isNativeAndroidFn(),
        this.snapshot.updateChannel,
        this.snapshot.developerModeEnabled,
      ),
      status: 'current',
      lastCheckedAt: this.now(),
      errorMessage: null,
      optionalDismissed: false,
      downloadProgress: null,
      downloadBytesReceived: null,
      downloadBytesTotal: null,
      localApkRelativePath: null,
      needsUnknownSourcesPermission: false,
      manifest: null,
    });
    this.log('upgrade_reset', {
      installedVersionCode: this.installedVersionCode,
      installedVersionName: this.installedVersionName,
    });
  }

  getUpdateChannel(): AppUpdateChannel {
    return this.snapshot.updateChannel;
  }

  isDeveloperModeEnabled(): boolean {
    return this.snapshot.developerModeEnabled;
  }

  enableDeveloperMode(): void {
    writeDeveloperModeEnabled(this.preferenceStore, true);
    this.patch({ developerModeEnabled: true });
    this.log('developer_mode_enabled', {});
  }

  hideDeveloperOptions(): void {
    writeDeveloperModeEnabled(this.preferenceStore, false);
    this.patch({ developerModeEnabled: false });
  }

  /**
   * Wechselt den Updatekanal und setzt Manifest-/Download-State zurück.
   */
  async setUpdateChannel(channel: AppUpdateChannel): Promise<AppUpdateSnapshot> {
    if (channel === this.snapshot.updateChannel) {
      return this.getSnapshot();
    }
    await this.clearUpdateCacheInternal();
    writeAppUpdateChannel(this.preferenceStore, channel);
    this.manifestUrl = manifestUrlForChannel(channel);
    this.patch({
      updateChannel: channel,
      status: this.isNativeAndroidFn() ? 'idle' : 'current',
      manifest: null,
      lastCheckedAt: null,
      errorMessage: null,
      optionalDismissed: false,
      downloadProgress: null,
      downloadBytesReceived: null,
      downloadBytesTotal: null,
      localApkRelativePath: null,
      needsUnknownSourcesPermission: false,
    });
    this.log('update_channel_changed', { channel });
    return this.getSnapshot();
  }

  /** Snooze + lokales APK + Manifest-State löschen; Kanal bleibt. */
  async clearUpdateCache(): Promise<AppUpdateSnapshot> {
    await this.clearUpdateCacheInternal();
    this.patch({
      status: this.isNativeAndroidFn() ? 'idle' : 'current',
      manifest: null,
      lastCheckedAt: null,
      errorMessage: null,
      optionalDismissed: false,
      downloadProgress: null,
      downloadBytesReceived: null,
      downloadBytesTotal: null,
      localApkRelativePath: null,
      needsUnknownSourcesPermission: false,
    });
    return this.getSnapshot();
  }

  /** Testkanal → Produktion, Cache/Snooze/State zurücksetzen. Entwicklermodus bleibt. */
  async deactivateTestChannel(): Promise<AppUpdateSnapshot> {
    await this.clearUpdateCacheInternal();
    writeAppUpdateChannel(this.preferenceStore, 'production');
    this.manifestUrl = manifestUrlForChannel('production');
    this.patch({
      updateChannel: 'production',
      status: this.isNativeAndroidFn() ? 'idle' : 'current',
      manifest: null,
      lastCheckedAt: null,
      errorMessage: null,
      optionalDismissed: false,
      downloadProgress: null,
      downloadBytesReceived: null,
      downloadBytesTotal: null,
      localApkRelativePath: null,
      needsUnknownSourcesPermission: false,
    });
    this.log('test_channel_deactivated', {});
    return this.getSnapshot();
  }

  private async clearUpdateCacheInternal(): Promise<void> {
    if (this.downloadAbort) {
      this.downloadAbort.abort();
      this.downloadAbort = null;
    }
    const path = this.snapshot.localApkRelativePath;
    if (path) {
      await this.apkCache.delete(path);
    }
    clearUpdateSnooze(this.preferenceStore);
    this.awaitingInstallerReturn = false;
  }

  /**
   * Liest die native installierte Version und setzt den State zurück,
   * wenn sie >= der angebotenen Manifest-Version ist.
   * Kein Manifest-Fetch – für Resume nach Installer.
   */
  async refreshInstalledVersionFromNative(): Promise<{
    versionName: string;
    versionCode: number;
  }> {
    if (!this.isNativeAndroidFn()) {
      return {
        versionName: this.installedVersionName,
        versionCode: this.installedVersionCode,
      };
    }
    const installed = await this.apkInstaller.getInstalledVersion();
    this.installedVersionName = installed.versionName;
    this.installedVersionCode = installed.versionCode;
    this.patch({
      installedVersionName: installed.versionName,
      installedVersionCode: installed.versionCode,
      isNativeAndroid: true,
    });
    this.log('installed_version_refreshed', {
      versionName: installed.versionName,
      versionCode: installed.versionCode,
    });
    return installed;
  }

  /**
   * Resume-/Foreground-Reconcile:
   * 1. Native Version neu lesen
   * 2. Bei installed >= offered → current, Banner weg, APK löschen
   * 3. Bei Abbruch (Version unverändert) → readyToInstall behalten
   * Kein doppelter paralleler Lauf.
   */
  async reconcileAfterResume(): Promise<AppUpdateSnapshot> {
    if (this.reconcilePromise) {
      return this.reconcilePromise;
    }

    this.reconcilePromise = (async () => {
      const wasAwaitingInstaller = this.awaitingInstallerReturn;
      try {
        if (!this.isNativeAndroidFn()) {
          return this.getSnapshot();
        }

        // Während aktiver Download/Verify nicht in den Resume-Reset eingreifen.
        if (
          this.snapshot.status === 'downloading' ||
          this.snapshot.status === 'verifying' ||
          this.snapshot.status === 'checking'
        ) {
          return this.getSnapshot();
        }

        await this.refreshInstalledVersionFromNative();

        const offeredCode = this.snapshot.manifest?.versionCode ?? null;
        const localPath = this.snapshot.localApkRelativePath;

        if (offeredCode != null && this.installedVersionCode >= offeredCode) {
          this.resetAfterSuccessfulUpgrade();
          recordAutomaticCheck(this.preferenceStore, this.nowMs());
          return this.getSnapshot();
        }

        // Lokales Artefakt ohne gültiges Angebot oder bereits überholt: aufräumen.
        if (localPath && (offeredCode == null || this.installedVersionCode >= offeredCode)) {
          void this.apkCache.delete(localPath);
          if (offeredCode == null) {
            this.patch({
              localApkRelativePath: null,
              downloadProgress: null,
              downloadBytesReceived: null,
              downloadBytesTotal: null,
              needsUnknownSourcesPermission: false,
              status:
                this.snapshot.status === 'readyToInstall' || this.snapshot.status === 'installing'
                  ? 'idle'
                  : this.snapshot.status,
            });
          }
        }

        if (wasAwaitingInstaller) {
          this.awaitingInstallerReturn = false;
          // Installer abgebrochen / Version unverändert → readyToInstall beibehalten.
          if (
            localPath &&
            offeredCode != null &&
            this.installedVersionCode < offeredCode &&
            (this.snapshot.status === 'readyToInstall' || this.snapshot.status === 'installing')
          ) {
            this.patch({ status: 'readyToInstall' });
          }
        }

        return this.getSnapshot();
      } finally {
        this.reconcilePromise = null;
      }
    })();

    return this.reconcilePromise;
  }

  private applySnoozeState(status: AppUpdateStatus, versionCode: number | null): boolean {
    if (status !== 'available' || versionCode == null) {
      return false;
    }
    return isUpdateVersionSnoozed(this.preferenceStore, versionCode, this.nowMs());
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
      if (this.isNativeAndroidFn()) {
        await this.refreshInstalledVersionFromNative();
      }

      const response = await this.fetchImpl(this.manifestUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'follow',
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
          errorClass: 'json_parse',
          jsonValid: false,
        });
      }

      const parsed = parseUpdateManifest(raw);
      if (!parsed.ok) {
        return this.setError('Update-Informationen sind ungültig.', 'error', {
          host,
          errorClass: 'schema',
          jsonValid: false,
          issues: parsed.issues.slice(0, 3).join('; '),
        });
      }

      const status = deriveUpdateStatus(this.installedVersionCode, parsed.manifest);
      if (status === 'current') {
        const path = this.snapshot.localApkRelativePath;
        if (path) {
          void this.apkCache.delete(path);
        }
        clearUpdateSnooze(this.preferenceStore);
        return this.patch({
          status: 'current',
          manifest: parsed.manifest,
          lastCheckedAt: this.now(),
          errorMessage: null,
          optionalDismissed: false,
          downloadProgress: null,
          downloadBytesReceived: null,
          downloadBytesTotal: null,
          localApkRelativePath: null,
          needsUnknownSourcesPermission: false,
        });
      }

      const snoozed = this.applySnoozeState(status, parsed.manifest.versionCode);
      const keepReady =
        this.snapshot.status === 'readyToInstall' &&
        this.snapshot.localApkRelativePath &&
        this.snapshot.manifest?.versionCode === parsed.manifest.versionCode;

      return this.patch({
        status: keepReady ? 'readyToInstall' : status,
        manifest: parsed.manifest,
        lastCheckedAt: this.now(),
        errorMessage: null,
        optionalDismissed: snoozed,
        downloadProgress: keepReady ? this.snapshot.downloadProgress : null,
        downloadBytesReceived: keepReady ? this.snapshot.downloadBytesReceived : null,
        downloadBytesTotal: keepReady ? this.snapshot.downloadBytesTotal : null,
        localApkRelativePath: keepReady ? this.snapshot.localApkRelativePath : null,
        needsUnknownSourcesPermission: keepReady
          ? this.snapshot.needsUnknownSourcesPermission
          : false,
      });
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

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return this.setError('Keine Internetverbindung.', 'offline', {
          host,
          errorClass: 'offline',
          errorName: name,
          navigatorOnline: false,
        });
      }

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

  private async runNativeInstall(): Promise<{ ok: true } | { ok: false; error: string }> {
    const manifest = this.snapshot.manifest;
    if (!manifest) {
      return { ok: false, error: 'Kein Update-Manifest vorhanden.' };
    }
    if (!manifest.downloadUrl.startsWith('https://')) {
      return { ok: false, error: 'Download-URL muss HTTPS verwenden.' };
    }

    const relativePath = apkRelativePathForVersion(manifest.versionName);
    this.downloadAbort = new AbortController();
    const timer = setTimeout(() => this.downloadAbort?.abort(), this.downloadTimeoutMs);

    this.patch({
      status: 'downloading',
      errorMessage: null,
      downloadProgress: 0,
      downloadBytesReceived: 0,
      downloadBytesTotal: manifest.sizeBytes,
      localApkRelativePath: null,
      needsUnknownSourcesPermission: false,
      optionalDismissed: false,
    });

    try {
      const buffer = await this.downloadApkBuffer(manifest, this.downloadAbort.signal);
      clearTimeout(timer);

      this.patch({
        status: 'verifying',
        downloadProgress: 100,
        downloadBytesReceived: buffer.byteLength,
        downloadBytesTotal: manifest.sizeBytes,
      });

      if (buffer.byteLength !== manifest.sizeBytes) {
        await this.apkCache.delete(relativePath);
        return this.failInstall('Die heruntergeladene Datei konnte nicht überprüft werden.', {
          errorClass: 'size_mismatch',
          expected: manifest.sizeBytes,
          received: buffer.byteLength,
        });
      }

      if (!looksLikeApkZip(buffer)) {
        await this.apkCache.delete(relativePath);
        return this.failInstall('Die heruntergeladene Datei konnte nicht überprüft werden.', {
          errorClass: 'invalid_apk',
        });
      }

      const hash = await sha256Hex(buffer);
      if (hash !== manifest.sha256) {
        await this.apkCache.delete(relativePath);
        return this.failInstall('Die heruntergeladene Datei konnte nicht überprüft werden.', {
          errorClass: 'sha_mismatch',
        });
      }

      await this.apkCache.write(relativePath, buffer);
      this.patch({
        status: 'readyToInstall',
        localApkRelativePath: relativePath,
        errorMessage: null,
      });

      return this.openInstaller();
    } catch (error) {
      clearTimeout(timer);
      await this.apkCache.delete(relativePath);
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String((error as { name: unknown }).name)
          : 'Unknown';
      if (name === 'AbortError') {
        this.patch({
          status: this.snapshot.manifest?.mandatory ? 'mandatory' : 'available',
          errorMessage: null,
          downloadProgress: null,
          downloadBytesReceived: null,
          downloadBytesTotal: null,
          localApkRelativePath: null,
        });
        return { ok: false, error: 'Download abgebrochen.' };
      }
      const message =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Keine Internetverbindung.'
          : 'Download fehlgeschlagen.';
      return this.failInstall(message, { errorClass: 'download', errorName: name });
    } finally {
      this.downloadAbort = null;
    }
  }

  private async downloadApkBuffer(
    manifest: UpdateManifest,
    signal: AbortSignal,
  ): Promise<ArrayBuffer> {
    const response = await this.fetchImpl(manifest.downloadUrl, {
      method: 'GET',
      signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const totalHeader = Number(response.headers.get('content-length') ?? manifest.sizeBytes);
    const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : manifest.sizeBytes;

    if (!response.body || typeof response.body.getReader !== 'function') {
      const buffer = await response.arrayBuffer();
      this.patch({
        downloadProgress: 100,
        downloadBytesReceived: buffer.byteLength,
        downloadBytesTotal: total,
      });
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        const progress = Math.min(99, Math.floor((received / total) * 100));
        this.patch({
          status: 'downloading',
          downloadProgress: progress,
          downloadBytesReceived: received,
          downloadBytesTotal: total,
        });
      }
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  }

  private failInstall(
    message: string,
    details: Record<string, string | number | boolean | null> = {},
  ): { ok: false; error: string } {
    this.log('install_error', { userMessage: message, ...details });
    const offerStatus = this.snapshot.manifest?.mandatory ? 'mandatory' : 'available';
    this.patch({
      status: 'error',
      errorMessage: message,
      downloadProgress: null,
      downloadBytesReceived: null,
      downloadBytesTotal: null,
      localApkRelativePath: null,
    });
    // UI kann von error erneut versuchen; Angebot bleibt im Manifest.
    void offerStatus;
    return { ok: false, error: message };
  }

  private setError(
    message: string,
    status: Extract<AppUpdateStatus, 'error' | 'offline'> = 'error',
    details: Record<string, string | number | boolean | null> = {},
  ): AppUpdateSnapshot {
    this.log('check_error', { status, userMessage: message, ...details });
    return this.patch({
      status,
      errorMessage: message,
      lastCheckedAt: this.now(),
      isNativeAndroid: this.isNativeAndroidFn(),
    });
  }
}

export function createAppUpdateService(options?: AppUpdateServiceOptions): AppUpdateService {
  return new AppUpdateService(options);
}

export type { UpdateManifest };
export { isUpdateOfferStatus };

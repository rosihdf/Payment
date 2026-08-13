/**
 * Phase-6D Permission-first-Erweiterung (inaktiv für Golden-Reference-P1).
 * Aktivierung: androidApkInstallFlow.ts durch Re-Export/Import aus dieser Datei ersetzen.
 */
import {
  AndroidApkUpdateFlowError,
  INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX,
  downloadAndroidApkToCache,
  resolveApkDownloadUrl,
  type AndroidLatestManifest,
} from './androidApkUpdate';
import { AppUpdateInstallerPermissionFirst as AppUpdateInstaller } from './appUpdateInstaller.permissionFirst';

/** Nutzer-/UI-Text zu Fehler aus APK-Download oder Paketinstaller. */
export const formatAndroidApkInstallFailureUserMessage = (e: unknown): string => {
  if (e instanceof AndroidApkUpdateFlowError) {
    return e.message;
  }
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = String((e as { message?: unknown }).message ?? '');
    if (msg.includes(INSTALL_SOURCE_BLOCKED_MESSAGE_PREFIX)) {
      const cleaned = msg.split(':').slice(1).join(':').trim();
      return cleaned.length > 0
        ? cleaned
        : 'Falls Android blockiert, erlaube Installation aus dieser Quelle für AMRtech Payment in den Android-Einstellungen. Danach „Update installieren“ erneut tippen.';
    }
    if (msg.trim().length > 0) return msg.trim();
  }
  return 'Update konnte nicht gestartet werden. Bitte erneut versuchen.';
};

export type NativeApkInstallFlowResult =
  | { ok: true; notice: string }
  | { ok: false; message: string; awaitingPermission?: boolean };

let installFlowInFlight = false;
let pendingInstallManifest: AndroidLatestManifest | null = null;

export const resetAndroidInstallFlowInFlightForTests = (): void => {
  installFlowInFlight = false;
  pendingInstallManifest = null;
};

export const getPendingAndroidInstallManifestForTests = (): AndroidLatestManifest | null =>
  pendingInstallManifest;

const ensureInstallPermissionOrOpenSettings = async (
  manifest: AndroidLatestManifest,
): Promise<{ ok: true } | { ok: false; message: string; awaitingPermission: true }> => {
  const { canInstall } = await AppUpdateInstaller.canInstallPackages();
  if (canInstall) {
    pendingInstallManifest = null;
    return { ok: true };
  }

  pendingInstallManifest = manifest;
  await AppUpdateInstaller.openInstallPermissionSettings();
  return {
    ok: false,
    message:
      'Bitte erlaube in den Android-Einstellungen „Apps aus dieser Quelle zulassen“ für AMRtech Payment. Nach der Rückkehr wird das Update automatisch fortgesetzt.',
    awaitingPermission: true,
  };
};

const runDownloadAndInstall = async (
  manifest: AndroidLatestManifest,
): Promise<NativeApkInstallFlowResult> => {
  const apkUrl = resolveApkDownloadUrl(manifest);
  const { relativePath } = await downloadAndroidApkToCache({ apkUrl, manifest });
  await AppUpdateInstaller.openApkFromCacheRelativePath({ relativePath });
  pendingInstallManifest = null;
  return {
    ok: true,
    notice:
      'Android-Paketinstaller geöffnet. Bitte bestätige dort die Installation — ohne deine Freigabe findet keine Installation statt.',
  };
};

export const runAndroidNativeApkInstallFlow = async (
  manifest: AndroidLatestManifest,
): Promise<NativeApkInstallFlowResult> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: 'Gerät offline — Update kann nicht heruntergeladen werden.' };
  }

  if (installFlowInFlight) {
    return { ok: false, message: 'Update wird bereits vorbereitet — bitte warten.' };
  }

  installFlowInFlight = true;

  try {
    const permission = await ensureInstallPermissionOrOpenSettings(manifest);
    if (!permission.ok) {
      return permission;
    }

    return await runDownloadAndInstall(manifest);
  } catch (e) {
    return { ok: false, message: formatAndroidApkInstallFailureUserMessage(e) };
  } finally {
    installFlowInFlight = false;
  }
};

export const tryResumePendingAndroidInstallFlow = async (): Promise<NativeApkInstallFlowResult | null> => {
  if (pendingInstallManifest == null || installFlowInFlight) {
    return null;
  }

  installFlowInFlight = true;

  try {
    const { canInstall } = await AppUpdateInstaller.canInstallPackages();
    if (!canInstall) {
      return null;
    }

    const manifest = pendingInstallManifest;
    return await runDownloadAndInstall(manifest);
  } catch (e) {
    return { ok: false, message: formatAndroidApkInstallFailureUserMessage(e) };
  } finally {
    installFlowInFlight = false;
  }
};

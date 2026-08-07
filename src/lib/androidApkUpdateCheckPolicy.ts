/** Automatische Prüfungen: mindestens dieser Abstand (Resume, Intervall, Netzwerk). */
export const ANDROID_APK_UPDATE_AUTO_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

/** Hintergrund-Intervall für längere Sessions. */
export const ANDROID_APK_UPDATE_BACKGROUND_INTERVAL_MS = 15 * 60 * 1000;

export type AndroidApkUpdateCheckReason =
  | 'initial'
  | 'resume'
  | 'dashboard_mount'
  | 'interval'
  | 'network_online'
  | 'manual'
  | 'info_mount';

function bypassesAutoCheckCooldown(reason: AndroidApkUpdateCheckReason): boolean {
  return reason === 'manual' || reason === 'info_mount' || reason === 'initial';
}

export function shouldRunAndroidApkUpdateCheck(
  lastCheckAtMs: number | null,
  nowMs: number,
  reason: AndroidApkUpdateCheckReason,
  force = false,
): boolean {
  if (force) return true;
  if (bypassesAutoCheckCooldown(reason)) return true;
  if (lastCheckAtMs == null) return true;
  return nowMs - lastCheckAtMs >= ANDROID_APK_UPDATE_AUTO_CHECK_COOLDOWN_MS;
}

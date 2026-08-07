import { Capacitor } from '@capacitor/core';
import { APP_VERSION, APP_VERSION_CODE } from '../utils/appInfo';

export type ClientInstallKind = 'android' | 'ios' | 'pwa' | 'web';

export type AppBuildInfo = {
  version: string;
  installKind: ClientInstallKind;
  androidGradleVersionCode: number | null;
  androidGradleVersionName: string;
};

export function resolveClientInstallKind(
  capGetPlatform: () => string,
  win: Window | undefined,
): ClientInstallKind {
  try {
    const p = capGetPlatform();
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
  } catch {
    /* SSR / Tests ohne Capacitor */
  }
  if (typeof win === 'undefined') return 'web';
  const standalone =
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? 'pwa' : 'web';
}

/** Build-/Laufzeit-Infos für den Wartungs-Updatepfad. */
export function getAppBuildInfo(): AppBuildInfo {
  const installKind = resolveClientInstallKind(
    () => Capacitor.getPlatform(),
    typeof window !== 'undefined' ? window : undefined,
  );
  return {
    version: APP_VERSION,
    installKind,
    androidGradleVersionCode: APP_VERSION_CODE,
    androidGradleVersionName: APP_VERSION,
  };
}

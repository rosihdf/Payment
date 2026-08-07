import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANDROID_APK_DOWNLOAD_POLL_INTERVAL_MS,
  resolveAndroidApkDownloadProgress,
  shouldPollAndroidApkDownload,
  type AndroidApkDownloadProgressSnapshot,
} from '../lib/androidApkDownloadProgress';
import type { AndroidApkDownloadUiPhase } from '../lib/androidApkDownloadState';

const IDLE_SNAPSHOT: AndroidApkDownloadProgressSnapshot = {
  phase: 'idle',
  downloadId: null,
  versionCode: null,
  status: null,
};

/**
 * Beobachtet DownloadManager-Status (Polling + Resume/Visibility).
 * Kein aggressives Polling — nur solange phase === downloading und Tab sichtbar.
 */
export function useAndroidApkDownloadProgress(opts: {
  enabled: boolean;
  offeredVersionCode: number | null | undefined;
  installedVersionCode: number | null | undefined;
}): {
  phase: AndroidApkDownloadUiPhase;
  downloadId: number | null;
  status: AndroidApkDownloadProgressSnapshot['status'];
  refresh: () => Promise<AndroidApkDownloadProgressSnapshot>;
} {
  const [snapshot, setSnapshot] = useState<AndroidApkDownloadProgressSnapshot>(IDLE_SNAPSHOT);
  const offered = opts.offeredVersionCode;
  const installed = opts.installedVersionCode;
  const enabled = opts.enabled;
  const inFlight = useRef(false);

  const refresh = useCallback(async (): Promise<AndroidApkDownloadProgressSnapshot> => {
    if (!enabled) {
      setSnapshot(IDLE_SNAPSHOT);
      return IDLE_SNAPSHOT;
    }
    if (inFlight.current) {
      return resolveAndroidApkDownloadProgress({
        offeredVersionCode: offered,
        installedVersionCode: installed,
      });
    }
    inFlight.current = true;
    try {
      const next = await resolveAndroidApkDownloadProgress({
        offeredVersionCode: offered,
        installedVersionCode: installed,
      });
      setSnapshot(next);
      return next;
    } finally {
      inFlight.current = false;
    }
  }, [enabled, offered, installed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !shouldPollAndroidApkDownload(snapshot.phase)) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const id = window.setInterval(() => {
      void resolveAndroidApkDownloadProgress({
        offeredVersionCode: offered,
        installedVersionCode: installed,
      }).then(setSnapshot);
    }, ANDROID_APK_DOWNLOAD_POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [enabled, snapshot.phase, offered, installed]);

  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void resolveAndroidApkDownloadProgress({
        offeredVersionCode: offered,
        installedVersionCode: installed,
      }).then(setSnapshot);
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [enabled, offered, installed]);

  return {
    phase: snapshot.phase,
    downloadId: snapshot.downloadId,
    status: snapshot.status,
    refresh,
  };
}

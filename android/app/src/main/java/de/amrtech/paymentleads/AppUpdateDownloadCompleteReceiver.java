package de.amrtech.paymentleads;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Reagiert nur auf den von Payment gestarteten Update-Download.
 * Bei {@link DownloadManager#STATUS_SUCCESSFUL} öffnet den Systeminstaller genau einmal.
 */
public final class AppUpdateDownloadCompleteReceiver extends BroadcastReceiver {

    private static final String TAG = "AmrPayUpdate";

    @Override
    public void onReceive(final Context context, final Intent intent) {
        Log.i(TAG, "onReceive enter");
        if (context == null || intent == null) {
            Log.i(TAG, "onReceive abort null");
            return;
        }
        final String action = intent.getAction();
        Log.i(TAG, "action=" + action);
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(action)) {
            return;
        }

        final long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        final long pendingId = AppUpdateDownloadStore.getPendingDownloadId(context);
        final boolean alreadyOpened =
                AppUpdateDownloadStore.isInstallerAlreadyOpened(context, downloadId);
        Log.i(
                TAG,
                "ids reported="
                        + downloadId
                        + " pending="
                        + pendingId
                        + " alreadyOpened="
                        + alreadyOpened);

        final DownloadManager dm =
                (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            Log.i(TAG, "abort no DownloadManager");
            return;
        }

        final int status = AppUpdateDownloadInstaller.queryStatus(dm, downloadId);
        final boolean gate =
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                        downloadId, pendingId, alreadyOpened, status);
        Log.i(TAG, "status=" + status + " gate=" + gate);
        if (!gate) {
            return;
        }

        final boolean opened = AppUpdateDownloadInstaller.openCompletedDownload(context, downloadId);
        Log.i(TAG, "openCompletedDownload result=" + opened);
    }
}

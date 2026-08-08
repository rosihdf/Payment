package de.amrtech.paymentleads;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Reagiert nur auf den von Payment gestarteten Update-Download.
 * Bei {@link DownloadManager#STATUS_SUCCESSFUL} öffnet den Systeminstaller genau einmal.
 */
public final class AppUpdateDownloadCompleteReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(final Context context, final Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
            return;
        }

        final long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        final long pendingId = AppUpdateDownloadStore.getPendingDownloadId(context);
        final boolean alreadyOpened =
                AppUpdateDownloadStore.isInstallerAlreadyOpened(context, downloadId);

        final DownloadManager dm =
                (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            return;
        }

        final int status = AppUpdateDownloadInstaller.queryStatus(dm, downloadId);
        if (!AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                downloadId, pendingId, alreadyOpened, status)) {
            return;
        }

        AppUpdateDownloadInstaller.openCompletedDownload(context, downloadId);
    }
}

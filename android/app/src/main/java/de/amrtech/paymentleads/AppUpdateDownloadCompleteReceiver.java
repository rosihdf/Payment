package de.amrtech.paymentleads;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

/**
 * Validiert DOWNLOAD_COMPLETE und reicht SUCCESSFUL an {@link AppUpdateInstallCoordinator}
 * weiter. Startet den Installer nicht selbst über den Receiver-Context.
 */
public final class AppUpdateDownloadCompleteReceiver extends BroadcastReceiver {

    private static final String TAG = "AmrPayUpdate";

    @Override
    public void onReceive(final Context context, final Intent intent) {
        Log.i(TAG, "Receiver download complete enter");
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
        final boolean activeActivity = AppUpdateInstallCoordinator.isMainActivityResumed();
        Log.i(
                TAG,
                "downloadId="
                        + downloadId
                        + " pendingId="
                        + pendingId
                        + " alreadyOpened="
                        + alreadyOpened
                        + " activeActivity="
                        + activeActivity);

        final DownloadManager dm =
                (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            Log.i(TAG, "abort no DownloadManager");
            return;
        }

        final int status = AppUpdateInstallCoordinator.queryStatus(dm, downloadId);
        Log.i(TAG, "STATUS=" + status);

        final AppUpdateInstallDispatch.Mode mode =
                AppUpdateInstallDispatch.decide(
                        downloadId, pendingId, alreadyOpened, status, activeActivity);
        Log.i(TAG, "dispatch=" + mode);
        if (mode == AppUpdateInstallDispatch.Mode.NONE) {
            return;
        }

        final Uri uri = AppUpdateInstallCoordinator.queryUri(dm, downloadId);
        Log.i(TAG, "uriPresent=" + (uri != null));
        if (uri == null) {
            return;
        }

        // Speichert ready + öffnet sofort über MainActivity ODER deferred bis onResume.
        AppUpdateInstallCoordinator.onPaymentDownloadSuccessful(context, downloadId, uri);
    }
}

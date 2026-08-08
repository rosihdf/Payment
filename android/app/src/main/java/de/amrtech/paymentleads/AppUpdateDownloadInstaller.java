package de.amrtech.paymentleads;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

/**
 * Öffnet den Android-Systeminstaller für eine bereits heruntergeladene Update-APK.
 * Kein erneuter Download, kein REQUEST_INSTALL_PACKAGES.
 */
final class AppUpdateDownloadInstaller {

    private static final String TAG = "AmrPayUpdate";
    private static final String APK_MIME = "application/vnd.android.package-archive";

    private AppUpdateDownloadInstaller() {}

    /**
     * Falls der gespeicherte Payment-Download bereits SUCCESSFUL ist und der
     * Installer noch nicht bestätigt geöffnet wurde: jetzt öffnen.
     * Für onResume-Reconcile nach BAL-Blockade.
     */
    static boolean openPendingIfSuccessful(final Context context) {
        if (context == null) {
            return false;
        }
        final long pendingId = AppUpdateDownloadStore.getPendingDownloadId(context);
        if (pendingId < 0L) {
            return false;
        }
        if (AppUpdateDownloadStore.isInstallerAlreadyOpened(context, pendingId)) {
            Log.i(TAG, "reconcile skip alreadyOpened id=" + pendingId);
            return false;
        }
        final DownloadManager dm =
                (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            return false;
        }
        final int status = queryStatus(dm, pendingId);
        Log.i(TAG, "reconcile pendingId=" + pendingId + " status=" + status);
        if (!AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                pendingId, pendingId, false, status)) {
            return false;
        }
        return openCompletedDownload(context, pendingId);
    }

    /**
     * @return true wenn der Installer-Intent gestartet wurde
     */
    static boolean openCompletedDownload(final Context context, final long downloadId) {
        if (downloadId < 0L) {
            Log.i(TAG, "open skip invalid id");
            return false;
        }
        if (AppUpdateDownloadStore.isInstallerAlreadyOpened(context, downloadId)) {
            Log.i(TAG, "open skip alreadyOpened id=" + downloadId);
            return false;
        }

        final DownloadManager dm =
                (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            Log.i(TAG, "open skip no DownloadManager");
            return false;
        }

        final int status = queryStatus(dm, downloadId);
        if (status != DownloadManager.STATUS_SUCCESSFUL) {
            Log.i(TAG, "open skip status=" + status + " id=" + downloadId);
            return false;
        }

        final Uri uri = dm.getUriForDownloadedFile(downloadId);
        if (uri == null) {
            Log.i(TAG, "open skip uri=null id=" + downloadId);
            return false;
        }
        Log.i(TAG, "open uri=" + uri + " id=" + downloadId);

        final Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, APK_MIME);
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        view.setClipData(ClipData.newRawUri("", uri));

        final Activity activity = AppUpdateForegroundTracker.getResumedActivity();
        try {
            if (activity != null) {
                Log.i(TAG, "startActivity via Activity");
                activity.startActivity(view);
                // Nur bei Activity-Context als geöffnet markieren: sichtbarer Start ist
                // BAL-fähig. Stiller BAL-Block aus Receiver-Context darf Retries nicht
                // über opened_download_id sperren.
                AppUpdateDownloadStore.markInstallerOpened(context, downloadId);
                Log.i(TAG, "installer started (activity) id=" + downloadId);
                return true;
            }
            Log.i(TAG, "startActivity via Context (no resumed Activity)");
            context.startActivity(view);
            // Nicht markieren: bei targetSdk 35 kann BAL startActivity still blockieren
            // ohne Exception. onResume-Reconcile darf dann erneut versuchen.
            Log.i(TAG, "installer start requested (context) id=" + downloadId);
            return true;
        } catch (final ActivityNotFoundException e) {
            Log.e(TAG, "startActivity ActivityNotFoundException id=" + downloadId, e);
            return false;
        } catch (final SecurityException e) {
            Log.e(TAG, "startActivity SecurityException id=" + downloadId, e);
            return false;
        } catch (final Exception e) {
            Log.e(TAG, "startActivity Exception id=" + downloadId, e);
            return false;
        }
    }

    static boolean matchesPendingPaymentDownload(final Context context, final long downloadId) {
        if (downloadId < 0L) {
            return false;
        }
        return downloadId == AppUpdateDownloadStore.getPendingDownloadId(context);
    }

    static boolean isSuccessful(final DownloadManager dm, final long downloadId) {
        return queryStatus(dm, downloadId) == DownloadManager.STATUS_SUCCESSFUL;
    }

    /** @return DownloadManager-COLUMN_STATUS oder -1 wenn unbekannt */
    static int queryStatus(final DownloadManager dm, final long downloadId) {
        final DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = null;
        try {
            cursor = dm.query(query);
            if (cursor == null || !cursor.moveToFirst()) {
                return -1;
            }
            final int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            if (statusIdx < 0) {
                return -1;
            }
            return cursor.getInt(statusIdx);
        } catch (final Exception e) {
            return -1;
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }
}

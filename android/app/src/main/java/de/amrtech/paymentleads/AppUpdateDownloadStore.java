package de.amrtech.paymentleads;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Persistiert die von Payment gestartete Update-downloadId für den
 * {@link android.app.DownloadManager}-Abschlussempfänger.
 */
final class AppUpdateDownloadStore {

    private static final String TAG = "AmrPayUpdate";
    private static final String PREFS = "amrtech_payment_app_update_download";
    private static final String KEY_PENDING_ID = "pending_download_id";
    private static final String KEY_OPENED_ID = "opened_download_id";

    private AppUpdateDownloadStore() {}

    static void setPendingDownloadId(final Context context, final long downloadId) {
        // commit(): sicher verfügbar, bevor ein schneller DOWNLOAD_COMPLETE eintrifft
        final boolean ok =
                prefs(context).edit().putLong(KEY_PENDING_ID, downloadId).commit();
        Log.i(TAG, "setPendingDownloadId id=" + downloadId + " commit=" + ok);
    }

    static long getPendingDownloadId(final Context context) {
        return prefs(context).getLong(KEY_PENDING_ID, -1L);
    }

    static boolean isInstallerAlreadyOpened(final Context context, final long downloadId) {
        return prefs(context).getLong(KEY_OPENED_ID, -1L) == downloadId;
    }

    static void markInstallerOpened(final Context context, final long downloadId) {
        final boolean ok =
                prefs(context).edit().putLong(KEY_OPENED_ID, downloadId).commit();
        Log.i(TAG, "markInstallerOpened id=" + downloadId + " commit=" + ok);
    }

    private static SharedPreferences prefs(final Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

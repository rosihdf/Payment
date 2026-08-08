package de.amrtech.paymentleads;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;

/**
 * Persistiert Payment-Update-Download: pending-ID, ready-successful, URI, opened.
 * Pending-ID wird hier nicht beim DOWNLOAD_COMPLETE gelöscht.
 */
final class AppUpdateDownloadStore {

    private static final String TAG = "AmrPayUpdate";
    private static final String PREFS = "amrtech_payment_app_update_download";
    private static final String KEY_PENDING_ID = "pending_download_id";
    private static final String KEY_OPENED_ID = "opened_download_id";
    private static final String KEY_READY_ID = "ready_successful_download_id";
    private static final String KEY_READY_URI = "ready_successful_uri";

    private AppUpdateDownloadStore() {}

    static void setPendingDownloadId(final Context context, final long downloadId) {
        final boolean ok =
                prefs(context)
                        .edit()
                        .putLong(KEY_PENDING_ID, downloadId)
                        .remove(KEY_READY_ID)
                        .remove(KEY_READY_URI)
                        .commit();
        Log.i(TAG, "setPendingDownloadId id=" + downloadId + " commit=" + ok);
    }

    static long getPendingDownloadId(final Context context) {
        return prefs(context).getLong(KEY_PENDING_ID, -1L);
    }

    static void markReadySuccessful(
            final Context context, final long downloadId, final String uriString) {
        final SharedPreferences.Editor edit =
                prefs(context).edit().putLong(KEY_READY_ID, downloadId);
        if (uriString != null && !uriString.isEmpty()) {
            edit.putString(KEY_READY_URI, uriString);
        } else {
            edit.remove(KEY_READY_URI);
        }
        final boolean ok = edit.commit();
        Log.i(TAG, "markReadySuccessful id=" + downloadId + " uriSet=" + (uriString != null)
                + " commit=" + ok);
    }

    static boolean isReadySuccessful(final Context context, final long downloadId) {
        return downloadId >= 0L && prefs(context).getLong(KEY_READY_ID, -1L) == downloadId;
    }

    static Uri getReadyUri(final Context context, final long downloadId) {
        if (!isReadySuccessful(context, downloadId)) {
            return null;
        }
        final String raw = prefs(context).getString(KEY_READY_URI, null);
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        try {
            return Uri.parse(raw);
        } catch (final Exception e) {
            return null;
        }
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

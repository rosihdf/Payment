package de.amrtech.paymentleads;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

/**
 * Zentraler Coordinator: Download-Complete → aktive {@link MainActivity} → Systeminstaller.
 * Der Receiver startet den Installer niemals über den Receiver-Context.
 */
final class AppUpdateInstallCoordinator {

    private static final String TAG = "AmrPayUpdate";
    private static final String APK_MIME = "application/vnd.android.package-archive";

    private static volatile MainActivity resumedMainActivity;

    private AppUpdateInstallCoordinator() {}

    static void onMainActivityResume(final MainActivity activity) {
        if (activity == null) {
            return;
        }
        resumedMainActivity = activity;
        Log.i(TAG, "MainActivity onResume activeActivity=yes");
        tryOpenPendingFromMainActivity(activity);
    }

    static void onMainActivityPause(final MainActivity activity) {
        if (activity != null && resumedMainActivity == activity) {
            resumedMainActivity = null;
            Log.i(TAG, "MainActivity onPause activeActivity=no");
        }
    }

    static boolean isMainActivityResumed() {
        final MainActivity activity = resumedMainActivity;
        return activity != null && isUsable(activity);
    }

    static MainActivity getResumedMainActivity() {
        final MainActivity activity = resumedMainActivity;
        return isUsable(activity) ? activity : null;
    }

    /**
     * Nach validiertem STATUS_SUCCESSFUL: ready speichern und ggf. sofort über MainActivity öffnen.
     */
    static void onPaymentDownloadSuccessful(
            final Context context, final long downloadId, final Uri uri) {
        if (context == null || downloadId < 0L) {
            return;
        }
        final String uriString = uri != null ? uri.toString() : null;
        final boolean uriPresent = uri != null;
        Log.i(TAG, "readySuccessful id=" + downloadId + " uriPresent=" + uriPresent);

        AppUpdateDownloadStore.markReadySuccessful(context, downloadId, uriString);

        final MainActivity activity = getResumedMainActivity();
        final boolean active = activity != null;
        Log.i(TAG, "activeActivity=" + active);
        if (!active) {
            Log.i(TAG, "defer until MainActivity resume id=" + downloadId);
            return;
        }
        if (uri == null) {
            Log.i(TAG, "uri missing — cannot open now id=" + downloadId);
            return;
        }

        // Race: Activity ist bereits resumed → kein weiteres onResume. Sofort öffnen.
        activity.runOnUiThread(
                new Runnable() {
                    @Override
                    public void run() {
                        openInstallerFromMainActivity(activity, downloadId, uri);
                    }
                });
    }

    static void tryOpenPendingFromMainActivity(final MainActivity activity) {
        if (activity == null || !isUsable(activity)) {
            return;
        }
        final long pendingId = AppUpdateDownloadStore.getPendingDownloadId(activity);
        final boolean ready = AppUpdateDownloadStore.isReadySuccessful(activity, pendingId);
        final boolean opened = AppUpdateDownloadStore.isInstallerAlreadyOpened(activity, pendingId);
        Log.i(
                TAG,
                "resumeCheck pendingId="
                        + pendingId
                        + " ready="
                        + ready
                        + " opened="
                        + opened);
        if (!AppUpdateInstallDispatch.shouldOpenOnResume(pendingId, ready, opened)) {
            // Fallback: DownloadManager-Status, falls ready-Flag fehlt (älterer Stand)
            if (pendingId < 0L || opened) {
                return;
            }
            final DownloadManager dm =
                    (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) {
                return;
            }
            final int status = queryStatus(dm, pendingId);
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                return;
            }
            final Uri uri = dm.getUriForDownloadedFile(pendingId);
            Log.i(TAG, "resume fallback status=SUCCESSFUL uriPresent=" + (uri != null));
            if (uri == null) {
                return;
            }
            AppUpdateDownloadStore.markReadySuccessful(activity, pendingId, uri.toString());
            openInstallerFromMainActivity(activity, pendingId, uri);
            return;
        }

        Uri uri = AppUpdateDownloadStore.getReadyUri(activity, pendingId);
        if (uri == null) {
            final DownloadManager dm =
                    (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                uri = dm.getUriForDownloadedFile(pendingId);
            }
        }
        Log.i(TAG, "resume open uriPresent=" + (uri != null));
        if (uri == null) {
            return;
        }
        openInstallerFromMainActivity(activity, pendingId, uri);
    }

    /**
     * Einzige Stelle, die den Systeminstaller startet — immer über MainActivity.
     *
     * @return true wenn startActivity aufgerufen wurde
     */
    static boolean openInstallerFromMainActivity(
            final MainActivity activity, final long downloadId, final Uri uri) {
        if (activity == null || !isUsable(activity) || downloadId < 0L || uri == null) {
            Log.i(TAG, "installer start skip invalid args");
            return false;
        }
        if (AppUpdateDownloadStore.isInstallerAlreadyOpened(activity, downloadId)) {
            Log.i(TAG, "installer start skip alreadyOpened id=" + downloadId);
            return false;
        }

        final Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, APK_MIME);
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // MainActivity-Context: NEW_TASK nicht nötig, schadet aber nicht für PackageInstaller
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        view.setClipData(ClipData.newRawUri("", uri));

        try {
            Log.i(TAG, "installer start from MainActivity id=" + downloadId + " uri=" + uri);
            activity.startActivity(view);
            AppUpdateDownloadStore.markInstallerOpened(activity, downloadId);
            Log.i(TAG, "installer start success id=" + downloadId);
            return true;
        } catch (final ActivityNotFoundException e) {
            Log.e(TAG, "installer start error ActivityNotFound id=" + downloadId, e);
            return false;
        } catch (final SecurityException e) {
            Log.e(TAG, "installer start error SecurityException id=" + downloadId, e);
            return false;
        } catch (final Exception e) {
            Log.e(TAG, "installer start error Exception id=" + downloadId, e);
            return false;
        }
    }

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

    static Uri queryUri(final DownloadManager dm, final long downloadId) {
        try {
            return dm.getUriForDownloadedFile(downloadId);
        } catch (final Exception e) {
            return null;
        }
    }

    private static boolean isUsable(final MainActivity activity) {
        if (activity == null || activity.isFinishing()) {
            return false;
        }
        if (android.os.Build.VERSION.SDK_INT >= 17 && activity.isDestroyed()) {
            return false;
        }
        return true;
    }
}

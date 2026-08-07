package de.amrtech.paymentleads;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Startet APK-Downloads über den Android-{@link DownloadManager}.
 * Payment installiert selbst nicht — der Nutzer öffnet die fertige Datei aus Downloads/Benachrichtigung.
 */
@CapacitorPlugin(name = "AppUpdateDownload")
public class AppUpdateDownloadPlugin extends Plugin {

    private static boolean isSafeFilename(final String name) {
        if (name == null) {
            return false;
        }
        final String t = name.trim();
        if (t.isEmpty() || t.length() > 180) {
            return false;
        }
        if (t.contains("..") || t.contains("/") || t.contains("\\")) {
            return false;
        }
        return t.toLowerCase().endsWith(".apk");
    }

    @PluginMethod
    public void enqueueApkDownload(final PluginCall call) {
        final String url = call.getString("url");
        final String filename = call.getString("filename");
        final String title = call.getString("title");
        final String description = call.getString("description", "Update wird heruntergeladen");

        if (url == null || url.trim().isEmpty() || !url.trim().startsWith("https://")) {
            call.reject("Ungültige HTTPS-Download-URL.");
            return;
        }
        if (!isSafeFilename(filename)) {
            call.reject("Ungültiger APK-Dateiname.");
            return;
        }
        final String safeTitle =
                title != null && !title.trim().isEmpty() ? title.trim() : "AMRtech Payment Update";

        final Context ctx = getContext();
        final DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager ist auf diesem Gerät nicht verfügbar.");
            return;
        }

        try {
            final DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url.trim()));
            request.setMimeType("application/vnd.android.package-archive");
            request.setTitle(safeTitle);
            request.setDescription(
                    description != null && !description.trim().isEmpty()
                            ? description.trim()
                            : "Update wird heruntergeladen");
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS, filename.trim());

            final long downloadId = dm.enqueue(request);
            final JSObject result = new JSObject();
            result.put("downloadId", downloadId);
            call.resolve(result);
        } catch (final IllegalArgumentException e) {
            call.reject("Download konnte nicht gestartet werden (ungültige Anfrage).", e);
        } catch (final SecurityException e) {
            call.reject("Download konnte nicht gestartet werden (Berechtigung).", e);
        } catch (final Exception e) {
            call.reject("Download konnte nicht gestartet werden.", e);
        }
    }

    @PluginMethod
    public void getDownloadStatus(final PluginCall call) {
        final Long downloadIdObj = call.getLong("downloadId");
        if (downloadIdObj == null) {
            call.reject("downloadId fehlt.");
            return;
        }
        final long downloadId = downloadIdObj;

        final Context ctx = getContext();
        final DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager ist auf diesem Gerät nicht verfügbar.");
            return;
        }

        try {
            call.resolve(queryStatus(dm, downloadId));
        } catch (final Exception e) {
            call.reject("Download-Status konnte nicht gelesen werden.", e);
        }
    }

    /**
     * Öffnet eine bereits erfolgreiche DownloadManager-APK (gleiche URI wie die System-Benachrichtigung).
     * Startet keinen neuen Download und installiert nicht selbst.
     */
    @PluginMethod
    public void openDownloadedApk(final PluginCall call) {
        final Long downloadIdObj = call.getLong("downloadId");
        if (downloadIdObj == null) {
            call.reject("downloadId fehlt.");
            return;
        }
        final long downloadId = downloadIdObj;

        final Context ctx = getContext();
        final DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager ist auf diesem Gerät nicht verfügbar.");
            return;
        }

        final JSObject statusObj = queryStatus(dm, downloadId);
        final String status = statusObj.getString("status");
        if (!"successful".equals(status)) {
            call.reject("Download ist noch nicht abgeschlossen.");
            return;
        }

        final Uri uri = dm.getUriForDownloadedFile(downloadId);
        if (uri == null) {
            openDownloadsUi(call);
            return;
        }

        final Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, "application/vnd.android.package-archive");
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            getContext().startActivity(view);
            final JSObject result = new JSObject();
            result.put("opened", true);
            result.put("via", "download_uri");
            call.resolve(result);
        } catch (final ActivityNotFoundException e) {
            openDownloadsUi(call);
        } catch (final Exception e) {
            call.reject("Heruntergeladene APK konnte nicht geöffnet werden.", e);
        }
    }

    private void openDownloadsUi(final PluginCall call) {
        try {
            final Intent downloads = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
            downloads.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(downloads);
            final JSObject result = new JSObject();
            result.put("opened", true);
            result.put("via", "downloads_ui");
            call.resolve(result);
        } catch (final Exception e) {
            call.reject("Downloads-Übersicht konnte nicht geöffnet werden.", e);
        }
    }

    private static JSObject queryStatus(final DownloadManager dm, final long downloadId) {
        final DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = null;
        final JSObject result = new JSObject();
        result.put("downloadId", downloadId);
        try {
            cursor = dm.query(query);
            if (cursor == null || !cursor.moveToFirst()) {
                result.put("status", "not_found");
                return result;
            }
            final int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            final int reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
            final int status = statusIdx >= 0 ? cursor.getInt(statusIdx) : -1;
            final int reason = reasonIdx >= 0 ? cursor.getInt(reasonIdx) : 0;
            result.put("status", mapStatus(status));
            result.put("reason", reason);
            return result;
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    private static String mapStatus(final int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:
                return "pending";
            case DownloadManager.STATUS_RUNNING:
                return "running";
            case DownloadManager.STATUS_PAUSED:
                return "paused";
            case DownloadManager.STATUS_SUCCESSFUL:
                return "successful";
            case DownloadManager.STATUS_FAILED:
                return "failed";
            default:
                return "unknown";
        }
    }
}

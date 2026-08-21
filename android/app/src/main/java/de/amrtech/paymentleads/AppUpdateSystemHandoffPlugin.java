package de.amrtech.paymentleads;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Finaler Update-Handoff: APK in MediaStore Downloads legen und Dateimanager öffnen.
 *
 * <p>Kein Installationsrecht, kein Paketinstaller-Intent auf die APK, kein Cache-URI-Provider als
 * Installer, kein Session-basiertes Paket-API, kein System-Download-Service.
 */
@CapacitorPlugin(name = "AppUpdateSystemHandoff")
public class AppUpdateSystemHandoffPlugin extends Plugin {

    public static final String MIME_APK = "application/vnd.android.package-archive";
    public static final String MIME_DIR = DocumentsContract.Document.MIME_TYPE_DIR;

    /** Flacher Downloads-Pfad: Download/ArioSales-Update.apk */
    public static final String RELATIVE_DOWNLOADS = Environment.DIRECTORY_DOWNLOADS + "/";

    /** Einziger lokaler Update-Dateiname (unabhängig von Remote-Version). */
    public static final String LOCAL_UPDATE_APK_DISPLAY_NAME = "ArioSales-Update.apk";

    public static final String OWN_APK_PREFIX = "ArioSales";
    private static final String LEGACY_APK_PREFIX = "AMRtech-Payment";

    public static final String SAMSUNG_MYFILES_PACKAGE = "com.sec.android.app.myfiles";
    public static final String SAMSUNG_LAUNCH_ACTION = "samsung.myfiles.intent.action.LAUNCH_MY_FILES";
    public static final String SAMSUNG_START_PATH_EXTRA = "samsung.myfiles.intent.extra.START_PATH";
    public static final String SAMSUNG_FOLDERPATH_EXTRA = "FOLDERPATH";
    public static final String SAMSUNG_VIEW_ACTION = "com.sec.android.app.myfiles.VIEW";

    public static final String MSG_FILEMANAGER_BLOCKED =
            "filemanager_handoff_blocked: Das Update wurde heruntergeladen. Öffne bitte Downloads und tippe auf"
                    + " „ArioSales-Update.apk“.";

    private static boolean hasPathTraversalOrAbsolute(final String rel) {
        if (rel.isEmpty()) {
            return true;
        }
        if (rel.charAt(0) == '/' || rel.charAt(0) == '\\') {
            return true;
        }
        final String unified = rel.replace('\\', '/');
        final String[] segs = unified.split("/", -1);
        for (final String seg : segs) {
            if ("..".equals(seg)) {
                return true;
            }
        }
        return false;
    }

    private File resolveCacheApk(final String trimmedRel) throws IOException {
        final File cacheRootCanon = getContext().getCacheDir().getCanonicalFile();
        final String cacheCanonPathStr = cacheRootCanon.getCanonicalPath();
        final File apkCanon = new File(cacheRootCanon, trimmedRel).getCanonicalFile();
        final String canonApkStr = apkCanon.getCanonicalPath();
        final String prefix = cacheCanonPathStr + File.separatorChar;
        if (!(canonApkStr.startsWith(prefix) || canonApkStr.equals(cacheCanonPathStr))) {
            throw new IOException("APK liegt nicht im App-Cache.");
        }
        if (!apkCanon.isFile()) {
            throw new IOException("APK-Datei nicht gefunden.");
        }
        return apkCanon;
    }

    private File resolveDownloadsFolder() {
        return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
    }

    private Uri buildDownloadsRootDocumentUri() {
        final String docId = "primary:" + Environment.DIRECTORY_DOWNLOADS;
        return DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", docId);
    }

    private boolean isPackageInstalled(final String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (final PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private boolean tryStart(final android.app.Activity act, final Intent intent) {
        try {
            act.startActivity(intent);
            return true;
        } catch (final ActivityNotFoundException | SecurityException e) {
            return false;
        } catch (final Exception e) {
            return false;
        }
    }

    private static boolean isOwnAmrtechPaymentApkName(final String name) {
        if (name == null) {
            return false;
        }
        final String n = name.trim();
        if (!n.toLowerCase().endsWith(".apk")) {
            return false;
        }
        return n.regionMatches(true, 0, OWN_APK_PREFIX, 0, OWN_APK_PREFIX.length())
                || n.regionMatches(true, 0, LEGACY_APK_PREFIX, 0, LEGACY_APK_PREFIX.length());
    }

    /** Entfernt eigene ArioSales-/Legacy-Payment-Update-APKs aus MediaStore Downloads. */
    private void deleteOwnAmrtechPaymentApks(final ContentResolver resolver, final Uri collection) {
        try (final Cursor c =
                resolver.query(
                        collection,
                        new String[] {MediaStore.Downloads._ID, MediaStore.Downloads.DISPLAY_NAME},
                        null,
                        null,
                        null)) {
            if (c == null) {
                return;
            }
            while (c.moveToNext()) {
                final String name = c.getString(1);
                if (!isOwnAmrtechPaymentApkName(name)) {
                    continue;
                }
                final long id = c.getLong(0);
                resolver.delete(Uri.withAppendedPath(collection, String.valueOf(id)), null, null);
            }
        } catch (final Exception ignored) {
            // Cleanup best-effort
        }
    }

    /**
     * Speichert die Cache-APK flach unter Download/ArioSales-Update.apk.
     * Entfernt vorher eigene Update-APK-Einträge (ArioSales + Legacy-Payment-Prefix).
     */
    @PluginMethod
    public void saveCacheApkToPublicDownloads(final PluginCall call) {
        final String rel = call.getString("relativePath");
        if (rel == null || rel.trim().isEmpty()) {
            call.reject("Pfad zur APK fehlt (relativePath).");
            return;
        }
        final String trimmed = rel.trim();
        if (hasPathTraversalOrAbsolute(trimmed)) {
            call.reject("Ungültiger relativer APK-Pfad.");
            return;
        }

        // Fest verdrahtet — Remote-Versionsname wird lokal nicht verwendet.
        final String displayName = LOCAL_UPDATE_APK_DISPLAY_NAME;

        try {
            final File apkCanon = resolveCacheApk(trimmed);
            final ContentResolver resolver = getContext().getContentResolver();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                final Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                deleteOwnAmrtechPaymentApks(resolver, collection);

                final ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, displayName);
                values.put(MediaStore.Downloads.MIME_TYPE, MIME_APK);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                values.put(MediaStore.Downloads.RELATIVE_PATH, RELATIVE_DOWNLOADS);

                final Uri itemUri = resolver.insert(collection, values);
                if (itemUri == null) {
                    call.reject("MediaStore-Eintrag konnte nicht angelegt werden.");
                    return;
                }

                try (final InputStream in = new FileInputStream(apkCanon);
                        final OutputStream out = resolver.openOutputStream(itemUri)) {
                    if (out == null) {
                        resolver.delete(itemUri, null, null);
                        call.reject("MediaStore-OutputStream fehlgeschlagen.");
                        return;
                    }
                    final byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) >= 0) {
                        out.write(buf, 0, n);
                    }
                    out.flush();
                } catch (final Exception e) {
                    resolver.delete(itemUri, null, null);
                    call.reject("Schreiben in Downloads fehlgeschlagen.", e);
                    return;
                }

                final ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(itemUri, done, null, null);

                final JSObject ret = new JSObject();
                ret.put("contentUri", itemUri.toString());
                ret.put("displayName", displayName);
                ret.put("storage", "mediastore_downloads");
                ret.put("relativePath", RELATIVE_DOWNLOADS);
                call.resolve(ret);
                return;
            }

            call.reject("Android 10+ (API 29) erforderlich für MediaStore-Downloads ohne Legacy-Storage.");
        } catch (final Exception e) {
            call.reject("APK konnte nicht in Downloads gespeichert werden.", e);
        }
    }

    /**
     * Öffnet den Dateimanager auf Downloads — nie den Paketinstaller auf die APK.
     */
    @PluginMethod
    public void openDownloadsFileManager(final PluginCall call) {
        final android.app.Activity act = getActivity();
        if (act == null) {
            call.reject("Keine Activity — Dateimanager-Handoff nicht möglich.");
            return;
        }

        final File folder = resolveDownloadsFolder();
        final String folderPath = folder.getAbsolutePath();
        String usedStrategy = null;
        String usedPackage = null;
        String usedAction = null;

        if (isPackageInstalled(SAMSUNG_MYFILES_PACKAGE)) {
            final Intent samsungLaunch =
                    getContext().getPackageManager().getLaunchIntentForPackage(SAMSUNG_MYFILES_PACKAGE);
            if (samsungLaunch != null) {
                samsungLaunch.setAction(SAMSUNG_LAUNCH_ACTION);
                samsungLaunch.putExtra(SAMSUNG_START_PATH_EXTRA, folderPath);
                samsungLaunch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if (tryStart(act, samsungLaunch)) {
                    usedStrategy = "samsung_launch_my_files";
                    usedPackage = SAMSUNG_MYFILES_PACKAGE;
                    usedAction = SAMSUNG_LAUNCH_ACTION;
                }
            }

            if (usedStrategy == null) {
                final Intent samsungView = new Intent(SAMSUNG_VIEW_ACTION);
                samsungView.setPackage(SAMSUNG_MYFILES_PACKAGE);
                samsungView.putExtra(SAMSUNG_FOLDERPATH_EXTRA, folderPath);
                samsungView.putExtra("folderPath", folderPath);
                samsungView.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (tryStart(act, samsungView)) {
                    usedStrategy = "samsung_myfiles_view";
                    usedPackage = SAMSUNG_MYFILES_PACKAGE;
                    usedAction = SAMSUNG_VIEW_ACTION;
                }
            }
        }

        if (usedStrategy == null) {
            final Uri downloadsUri = buildDownloadsRootDocumentUri();
            final Intent downloadsView = new Intent(Intent.ACTION_VIEW);
            downloadsView.setDataAndType(downloadsUri, MIME_DIR);
            downloadsView.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (tryStart(act, downloadsView)) {
                usedStrategy = "documentsui_downloads";
                usedAction = Intent.ACTION_VIEW;
            }
        }

        if (usedStrategy == null) {
            final Intent openDoc = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            openDoc.addCategory(Intent.CATEGORY_OPENABLE);
            openDoc.setType("*/*");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                openDoc.putExtra(DocumentsContract.EXTRA_INITIAL_URI, buildDownloadsRootDocumentUri());
            }
            openDoc.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (tryStart(act, openDoc)) {
                usedStrategy = "action_open_document";
                usedAction = Intent.ACTION_OPEN_DOCUMENT;
            }
        }

        if (usedStrategy == null) {
            call.reject(MSG_FILEMANAGER_BLOCKED);
            return;
        }

        final JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("strategy", usedStrategy);
        ret.put("action", usedAction);
        ret.put("folderPath", folderPath);
        if (usedPackage != null) {
            ret.put("targetPackage", usedPackage);
        }
        ret.put("displayName", LOCAL_UPDATE_APK_DISPLAY_NAME);
        ret.put("opensInstaller", false);
        call.resolve(ret);
    }
}

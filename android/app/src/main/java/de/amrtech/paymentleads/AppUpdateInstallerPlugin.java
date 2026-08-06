package de.amrtech.paymentleads;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.IOException;

/**
 * Öffnet eine APK unter {@link android.content.Context#getCacheDir()} über FileProvider und
 * Intent {@link Intent#ACTION_VIEW}. Keine stille Installation.
 */
@CapacitorPlugin(name = "AppUpdateInstaller")
public class AppUpdateInstallerPlugin extends Plugin {

    public static final String MSG_INSTALL_SOURCE_BLOCKED = "install_source_blocked";

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

    @PluginMethod
    public void canRequestPackageInstalls(final PluginCall call) {
        final JSObject result = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openUnknownSourcesSettings(final PluginCall call) {
        try {
            final Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            final android.app.Activity act = getActivity();
            if (act == null) {
                call.reject("Keine Activity — Einstellungen können nicht geöffnet werden.");
                return;
            }
            act.startActivity(intent);
            call.resolve();
        } catch (final Exception e) {
            call.reject("Einstellungen für unbekannte Quellen konnten nicht geöffnet werden.", e);
        }
    }

    /**
     * @param relativePath Relativ zum Cache, z. B. {@code amrtech-updates/AMRtech-Payment-1.0.7.apk}.
     */
    @PluginMethod
    public void openApkFromCacheRelativePath(final PluginCall call) {
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

        final File cacheRootRaw = getContext().getCacheDir();
        final File cacheRootCanon;
        final String cacheCanonPathStr;
        try {
            cacheRootCanon = cacheRootRaw.getCanonicalFile();
            cacheCanonPathStr = cacheRootCanon.getCanonicalPath();
        } catch (final IOException e) {
            call.reject("Cache-Verzeichnis nicht lesbar.", e);
            return;
        }

        final File apkRaw = new File(cacheRootCanon, trimmed);
        final File apkCanon;
        final String canonApkStr;
        try {
            apkCanon = apkRaw.getCanonicalFile();
            canonApkStr = apkCanon.getCanonicalPath();
        } catch (final IOException e) {
            call.reject("APK-Pfad konnte nicht aufgelöst werden.", e);
            return;
        }

        final String prefix = cacheCanonPathStr + File.separatorChar;
        if (!(canonApkStr.startsWith(prefix) || canonApkStr.equals(cacheCanonPathStr))) {
            call.reject("APK liegt nicht im App-Cache.");
            return;
        }

        if (!apkCanon.isFile()) {
            call.reject("APK-Datei nicht gefunden. Bitte den Download erneut starten.");
            return;
        }

        final PackageManager pm = getContext().getPackageManager();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!pm.canRequestPackageInstalls()) {
                call.reject(MSG_INSTALL_SOURCE_BLOCKED);
                return;
            }
        }

        try {
            final String authority = getContext().getPackageName() + ".fileprovider";
            final Uri apkUri = FileProvider.getUriForFile(getContext(), authority, apkCanon);
            final Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                intent.setClipData(ClipData.newRawUri("", apkUri));
            }

            final android.app.Activity act = getActivity();
            if (act == null) {
                call.reject("Keine Activity — Installer kann nicht gestartet werden.");
                return;
            }
            act.startActivity(intent);
            call.resolve();
        } catch (final ActivityNotFoundException e) {
            call.reject("Es wurde kein Paketinstaller gefunden.", e);
        } catch (final Exception e) {
            call.reject("Der Android-Paketinstaller konnte nicht gestartet werden.", e);
        }
    }
}

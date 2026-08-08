package de.amrtech.paymentleads;

import android.app.Activity;
import android.util.Log;

import java.lang.ref.WeakReference;

/**
 * Hält die sichtbare {@link MainActivity}, damit der Installer aus dem
 * Download-Complete-Pfad über einen Activity-Context gestartet werden kann
 * (Background-Activity-Launch-Beschränkungen).
 */
final class AppUpdateForegroundTracker {

    private static final String TAG = "AmrPayUpdate";
    private static volatile WeakReference<Activity> resumedActivity = new WeakReference<>(null);

    private AppUpdateForegroundTracker() {}

    static void onResume(final Activity activity) {
        if (activity == null) {
            return;
        }
        resumedActivity = new WeakReference<>(activity);
        Log.i(TAG, "foreground=resume");
    }

    static void onPause(final Activity activity) {
        final Activity current = getResumedActivity();
        if (current != null && current == activity) {
            resumedActivity = new WeakReference<>(null);
            Log.i(TAG, "foreground=pause");
        }
    }

    static Activity getResumedActivity() {
        final WeakReference<Activity> ref = resumedActivity;
        if (ref == null) {
            return null;
        }
        final Activity activity = ref.get();
        if (activity == null || activity.isFinishing()) {
            return null;
        }
        if (android.os.Build.VERSION.SDK_INT >= 17 && activity.isDestroyed()) {
            return null;
        }
        return activity;
    }
}

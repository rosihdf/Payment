package de.amrtech.paymentleads;

/**
 * Reine Entscheidungslogik für Download-Complete → Installer-Dispatch (ohne Android-I/O).
 */
final class AppUpdateInstallDispatch {

    /** Entspricht {@link android.app.DownloadManager#STATUS_SUCCESSFUL}. */
    static final int STATUS_SUCCESSFUL = 8;
    /** Entspricht {@link android.app.DownloadManager#STATUS_RUNNING}. */
    static final int STATUS_RUNNING = 2;

    enum Mode {
        /** Fremde ID, falscher Status, bereits geöffnet, ungültig. */
        NONE,
        /** MainActivity ist resumed → Installer sofort über Activity öffnen. */
        OPEN_VIA_ACTIVITY_NOW,
        /** MainActivity nicht resumed → nur pending-successful speichern. */
        DEFER_UNTIL_RESUME
    }

    private AppUpdateInstallDispatch() {}

    static Mode decide(
            final long reportedDownloadId,
            final long pendingPaymentDownloadId,
            final boolean installerAlreadyOpenedForId,
            final int downloadManagerStatus,
            final boolean mainActivityResumed) {
        if (reportedDownloadId < 0L
                || pendingPaymentDownloadId < 0L
                || reportedDownloadId != pendingPaymentDownloadId
                || installerAlreadyOpenedForId
                || downloadManagerStatus != STATUS_SUCCESSFUL) {
            return Mode.NONE;
        }
        return mainActivityResumed ? Mode.OPEN_VIA_ACTIVITY_NOW : Mode.DEFER_UNTIL_RESUME;
    }

    static boolean shouldOpenOnResume(
            final long pendingDownloadId,
            final boolean readySuccessful,
            final boolean installerAlreadyOpenedForId) {
        if (pendingDownloadId < 0L) {
            return false;
        }
        if (!readySuccessful) {
            return false;
        }
        return !installerAlreadyOpenedForId;
    }
}

package de.amrtech.paymentleads;

/**
 * Reine Entscheidungslogik für den Download-Abschluss (ohne Android-I/O).
 * STATUS_SUCCESSFUL = {@code android.app.DownloadManager.STATUS_SUCCESSFUL} (8).
 */
final class AppUpdateDownloadCompleteGate {

    /** Entspricht {@link android.app.DownloadManager#STATUS_SUCCESSFUL}. */
    static final int STATUS_SUCCESSFUL = 8;

    private AppUpdateDownloadCompleteGate() {}

    /**
     * @return true nur wenn Installer für diese Payment-ID geöffnet werden darf
     */
    static boolean shouldOpenInstaller(
            final long reportedDownloadId,
            final long pendingPaymentDownloadId,
            final boolean installerAlreadyOpenedForId,
            final int downloadManagerStatus) {
        if (reportedDownloadId < 0L) {
            return false;
        }
        if (pendingPaymentDownloadId < 0L) {
            return false;
        }
        if (reportedDownloadId != pendingPaymentDownloadId) {
            return false;
        }
        if (installerAlreadyOpenedForId) {
            return false;
        }
        return downloadManagerStatus == STATUS_SUCCESSFUL;
    }
}

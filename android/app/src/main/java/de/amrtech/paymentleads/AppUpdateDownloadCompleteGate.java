package de.amrtech.paymentleads;

/**
 * Kompatible Gate-API (reine Logik). Neuere Dispatch-Modi: {@link AppUpdateInstallDispatch}.
 */
final class AppUpdateDownloadCompleteGate {

    static final int STATUS_SUCCESSFUL = AppUpdateInstallDispatch.STATUS_SUCCESSFUL;

    private AppUpdateDownloadCompleteGate() {}

    static boolean shouldOpenInstaller(
            final long reportedDownloadId,
            final long pendingPaymentDownloadId,
            final boolean installerAlreadyOpenedForId,
            final int downloadManagerStatus) {
        return AppUpdateInstallDispatch.decide(
                        reportedDownloadId,
                        pendingPaymentDownloadId,
                        installerAlreadyOpenedForId,
                        downloadManagerStatus,
                        true)
                == AppUpdateInstallDispatch.Mode.OPEN_VIA_ACTIVITY_NOW;
    }
}

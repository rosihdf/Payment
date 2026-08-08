package de.amrtech.paymentleads;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AppUpdateDownloadCompleteGateTest {

    private static final int STATUS_RUNNING = 2;
    private static final int STATUS_SUCCESSFUL = 8;
    private static final int STATUS_FAILED = 16;

    @Test
    public void foreignDownloadId_doesNotOpen() {
        assertFalse(
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                        99L, 7L, false, STATUS_SUCCESSFUL));
    }

    @Test
    public void running_doesNotOpen() {
        assertFalse(
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(7L, 7L, false, STATUS_RUNNING));
    }

    @Test
    public void failed_doesNotOpen() {
        assertFalse(
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(7L, 7L, false, STATUS_FAILED));
    }

    @Test
    public void successful_opensOnce() {
        assertTrue(
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                        7L, 7L, false, STATUS_SUCCESSFUL));
        assertFalse(
                AppUpdateDownloadCompleteGate.shouldOpenInstaller(
                        7L, 7L, true, STATUS_SUCCESSFUL));
    }
}

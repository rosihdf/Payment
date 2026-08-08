package de.amrtech.paymentleads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AppUpdateInstallDispatchTest {

    private static final int STATUS_RUNNING = AppUpdateInstallDispatch.STATUS_RUNNING;
    private static final int STATUS_SUCCESSFUL = AppUpdateInstallDispatch.STATUS_SUCCESSFUL;
    private static final int STATUS_FAILED = 16;

    @Test
    public void fallA_resumed_foreignId_doesNothing() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.NONE,
                AppUpdateInstallDispatch.decide(99L, 7L, false, STATUS_SUCCESSFUL, true));
    }

    @Test
    public void fallB_resumed_running_doesNothing() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.NONE,
                AppUpdateInstallDispatch.decide(7L, 7L, false, STATUS_RUNNING, true));
    }

    @Test
    public void fallC_resumed_successful_opensImmediately() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.OPEN_VIA_ACTIVITY_NOW,
                AppUpdateInstallDispatch.decide(7L, 7L, false, STATUS_SUCCESSFUL, true));
    }

    @Test
    public void fallD_notResumed_successful_defers() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.DEFER_UNTIL_RESUME,
                AppUpdateInstallDispatch.decide(7L, 7L, false, STATUS_SUCCESSFUL, false));
    }

    @Test
    public void fallE_afterDefer_resumeOpensOnce() {
        assertTrue(AppUpdateInstallDispatch.shouldOpenOnResume(7L, true, false));
        // nach erfolgreichem Open (opened=true) kein zweiter Start
        assertFalse(AppUpdateInstallDispatch.shouldOpenOnResume(7L, true, true));
    }

    @Test
    public void fallF_alreadyOpened_noSecondStart() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.NONE,
                AppUpdateInstallDispatch.decide(7L, 7L, true, STATUS_SUCCESSFUL, true));
        assertFalse(AppUpdateInstallDispatch.shouldOpenOnResume(7L, true, true));
    }

    @Test
    public void fallG_startError_openedRemainsFalse_retryPossible() {
        // Simulate: ready gespeichert, startActivity warf → opened=false
        assertTrue(AppUpdateInstallDispatch.shouldOpenOnResume(7L, true, false));
        assertEquals(
                AppUpdateInstallDispatch.Mode.OPEN_VIA_ACTIVITY_NOW,
                AppUpdateInstallDispatch.decide(7L, 7L, false, STATUS_SUCCESSFUL, true));
    }

    @Test
    public void failed_doesNothing() {
        assertEquals(
                AppUpdateInstallDispatch.Mode.NONE,
                AppUpdateInstallDispatch.decide(7L, 7L, false, STATUS_FAILED, true));
    }
}

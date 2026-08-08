package de.amrtech.paymentleads;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppUpdateDownloadPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        AppUpdateForegroundTracker.onResume(this);
        // Falls DOWNLOAD_COMPLETE den Installer wegen BAL still blockiert hat:
        // sobald die App wieder sichtbar ist, Systeminstaller nachziehen.
        AppUpdateDownloadInstaller.openPendingIfSuccessful(this);
    }

    @Override
    public void onPause() {
        AppUpdateForegroundTracker.onPause(this);
        super.onPause();
    }
}

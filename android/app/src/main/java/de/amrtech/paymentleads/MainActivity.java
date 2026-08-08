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
        AppUpdateInstallCoordinator.onMainActivityResume(this);
    }

    @Override
    public void onPause() {
        AppUpdateInstallCoordinator.onMainActivityPause(this);
        super.onPause();
    }
}

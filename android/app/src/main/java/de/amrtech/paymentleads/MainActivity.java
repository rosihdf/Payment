package de.amrtech.paymentleads;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppUpdateInstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

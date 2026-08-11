package de.amrtech.paymentleads;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Phase-6H Final: MediaStore Downloads + Dateimanager-Handoff (ohne Installationsrecht)
        registerPlugin(AppUpdateSystemHandoffPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

# Capacitor / WebView bridge – keep plugin entry points for In-App-Updates.
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadPlugin { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadCompleteReceiver { *; }
-keep class de.amrtech.paymentleads.AppUpdateInstallCoordinator { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadStore { *; }
-keep class de.amrtech.paymentleads.AppUpdateInstallDispatch { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadCompleteGate { *; }
-keepclassmembers class de.amrtech.paymentleads.AppUpdateDownloadPlugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keepattributes *Annotation*
-dontwarn com.getcapacitor.**

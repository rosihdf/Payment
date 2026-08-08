# Capacitor / WebView bridge – keep plugin entry points for In-App-Updates.
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadPlugin { *; }
-keep class de.amrtech.paymentleads.AppUpdateDownloadCompleteReceiver { *; }
-keepclassmembers class de.amrtech.paymentleads.AppUpdateDownloadPlugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keepattributes *Annotation*
-dontwarn com.getcapacitor.**

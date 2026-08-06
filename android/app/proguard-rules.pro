# Capacitor / WebView bridge – keep plugin entry points for In-App-Updates.
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class de.amrtech.paymentleads.AppUpdateInstallerPlugin { *; }
-keepclassmembers class de.amrtech.paymentleads.AppUpdateInstallerPlugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keepattributes *Annotation*
-dontwarn com.getcapacitor.**

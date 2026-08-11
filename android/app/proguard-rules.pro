# Capacitor / WebView bridge
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keepattributes *Annotation*
-dontwarn com.getcapacitor.**

-keep class de.amrtech.paymentleads.AppUpdateSystemHandoffPlugin { *; }

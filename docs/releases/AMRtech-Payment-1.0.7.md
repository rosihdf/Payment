# AMRtech Payment 1.0.7 – Nativer In-App-Update

Native Download/Installation aus Banner und App-Info; kein Browserpfad. Später nur im Banner.

## Android

| Feld | Wert |
|------|------|
| versionName | `1.0.7` |
| versionCode | `10007` |
| Manifest-URL | `https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json` |

## Native

- Cache-Download via Fetch + `@capacitor/filesystem`
- FileProvider Installer-Plugin `AppUpdateInstaller`
- `REQUEST_INSTALL_PACKAGES`

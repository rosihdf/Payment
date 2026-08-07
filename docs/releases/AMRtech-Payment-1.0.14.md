# AMRtech Payment 1.0.14

## Kurz

Play-Protect-Trigger entfernt: kein `REQUEST_INSTALL_PACKAGES`, kein direkter Payment-Installer.
Updates laufen über Android DownloadManager + Systembenachrichtigung.

## App-Metadaten

| Feld | Wert |
|------|------|
| versionName | `1.0.14` |
| versionCode | `10030` |
| Package | `de.amrtech.paymentleads` |

## Änderungen

- DownloadManager-Bridge `AppUpdateDownload`
- Banner/App-Info ohne Self-Install
- Testkanal (5×-Tap) wieder aktiv
- Manifestprüfung/Banner/Snooze wie Wartungsbasis

# AMRtech Payment 1.0.16

## Kurz

DownloadManager-UI: nach `STATUS_SUCCESSFUL` wechselt Banner/App-Info auf „Update heruntergeladen“ und öffnet die fertige APK ohne erneuten Download.

## App-Metadaten

| Feld | Wert |
|------|------|
| versionName | `1.0.16` |
| versionCode | `10032` |
| Package | `de.amrtech.paymentleads` |

## Änderungen

- UI-Phasen downloading / downloaded / failed
- Polling + Resume für DownloadManager-Status
- `openDownloadedApk(downloadId)`
- kein zweites enqueue bei SUCCESSFUL/RUNNING

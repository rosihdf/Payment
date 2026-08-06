# AMRtech Payment 1.0.5 – Android Updateprüfung WebView

Reparatur der nativen Updateprüfung auf Capacitor/Android (Samsung Tab 8): Download-Worker CORS für `https://localhost`, präzisere Fehlerklassifizierung, Manifest-Schema kompatibel zu produktiven `latest.json`-Feldern.

## Android

| Feld | Wert |
|------|------|
| Application-ID | `de.amrtech.paymentleads` |
| versionName | `1.0.5` |
| versionCode | `10005` |
| Manifest-URL | `https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json` |
| APK (lokal) | `release-artifacts/v1.0.5/AMRtech-Payment-1.0.5.apk` |
| SHA-256 | `65fe219a1466ebff4ea4e5a2c774eb8e1890125ec515e37e932985d841147801` |
| Signatur-Cert SHA-256 | `d3f85fb274c460139b178b76c93b3fda555fa48b0d960b9817be4d85f174fd9d` (identisch zu 1.0.4) |

## Worker

`amrtech-payment-downloads` Deployment `63fba5f2-00a6-484a-a221-ef376ff5198e`:

- `Access-Control-Allow-Origin: *`
- OPTIONS → 204
- Allow GET/HEAD/OPTIONS
- `Content-Type: application/json; charset=utf-8` für `latest.json`

## Hinweis Gerätetest

Kein Samsung Tab 8 per `adb` verbunden zum Zeitpunkt des lokalen Builds. R2 `latest.json` zeigt weiterhin 1.0.4 – OTA/R2-Update erst nach erfolgreichem App-Test.

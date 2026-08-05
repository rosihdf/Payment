# AMRtech Payment 1.0.3 – Kernreparatur

Release der produktionsfähigen Kernreparatur (Kunden, Beratung, Angebot, Provision, Admin, Außendienst).

## Web/PWA

| Feld | Wert |
|------|------|
| versionName | `1.0.3` |
| Worker | `amrtech-payment` |
| Branch | `main` |
| Release-Tag | `v1.0.3` |
| Datenmodus | Supabase-Produktion |

## Android (vorbereitet)

| Feld | Wert |
|------|------|
| Application-ID | `de.amrtech.paymentleads` |
| versionName | `1.0.3` |
| versionCode | `10003` |
| Zielname für R2 | `AMRtech-Payment-1.0.3.apk` |

## Geplante R2-Pfade

- `android/v1.0.3/AMRtech-Payment-1.0.3.apk`
- `android/v1.0.3/AMRtech-Payment-1.0.3.apk.sha256`
- `android/v1.0.3/manifest.json`
- danach `android/latest.apk` und `android/latest.json` auf 1.0.3 umstellen

## Entwurf `latest.json`

```json
{
  "versionName": "1.0.3",
  "versionCode": 10003,
  "minimumVersionCode": 10000,
  "mandatory": false
}
```

SHA-256, Download-URL und `sourceCommit` werden nach signiertem APK-Build ergänzt.

## Kernänderungen

- Provisions-Save-Deadlock behoben (serialisierte Schreibzugriffe, leichter Save-Pfad)
- Workspace-Lade-Deadlock nach Navigation behoben
- Beratung, Angebot, Kunden, Außendienst-RLS repariert und abgenommen
- Supabase-Browser-Acceptance 7/7

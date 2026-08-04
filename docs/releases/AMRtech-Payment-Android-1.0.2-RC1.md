# AMRtech Payment Android 1.0.2 – RC1 (vorbereitet, nicht veröffentlicht)

Lokale Release-Vorbereitung für den Frontend-Rebuild-RC1. **Kein R2-Upload, kein Worker-Deploy, kein Tag.**

## App-Metadaten

| Feld | Wert |
|------|------|
| App-Name | AMRtech Payment |
| Application-ID | `de.amrtech.paymentleads` |
| versionName | `1.0.2` |
| versionCode | `10002` |
| Branch | `rebuild/frontend-v2` |
| Datenmodus Build | Supabase-Produktion |

## Lokales Artefakt

| Feld | Wert |
|------|------|
| Pfad | `android/app/build/outputs/apk/release/app-release.apk` (nicht versioniert) |
| Zielname für R2 | `AMRtech-Payment-1.0.2.apk` |
| Größe | `11191358` Bytes |
| SHA-256 | `d8cee4a7d5c51993af04e0c4ad2a025da49327b7515450007abb6a8502068c53` |
| Signatur-Fingerprint (Zertifikat SHA-256) | `d3f85fb274c460139b178b76c93b3fda555fa48b0d960b9817be4d85f174fd9d` |
| Signaturprüfung | `apksigner verify` EXIT 0 (identisch zu 1.0.0/1.0.1) |

## Geplante R2-Pfade (noch nicht hochgeladen)

- `android/v1.0.2/AMRtech-Payment-1.0.2.apk`
- `android/v1.0.2/AMRtech-Payment-1.0.2.apk.sha256`
- `android/v1.0.2/manifest.json`
- danach `android/latest.apk` und `android/latest.json` auf 1.0.2 umstellen

## Entwurf `latest.json` (noch nicht live)

```json
{
  "versionName": "1.0.2",
  "versionCode": 10002,
  "minimumVersionCode": 10000,
  "downloadUrl": "https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.2/AMRtech-Payment-1.0.2.apk",
  "sha256": "d8cee4a7d5c51993af04e0c4ad2a025da49327b7515450007abb6a8502068c53",
  "publishedAt": "2026-08-04T00:00:00.000Z",
  "releaseNotes": "Frontend-Rebuild RC1: einheitliche v2-Oberfläche, Beratung, CRM, Provision, Admin.",
  "releaseTag": "v1.0.2",
  "sourceCommit": "pending-final-head",
  "mandatory": false
}
```

Aktuell live: `latest.json` zeigt weiterhin **1.0.1**.

## Download-Worker

Allowlist in `workers/amrtech-payment-downloads` um 1.0.2-Pfade erweitert (Deploy ausstehend).

## Veröffentlichungsschritte (nicht ausführen vor grünem RC)

1. APK nach `release-artifacts/` kopieren, SHA-256-Datei schreiben.
2. R2-Objekte unter `android/v1.0.2/` hochladen.
3. `latest.apk` / `latest.json` aktualisieren.
4. Download-Worker deployen.
5. Manifest-URL und Updateprüfung in App-Info verifizieren.

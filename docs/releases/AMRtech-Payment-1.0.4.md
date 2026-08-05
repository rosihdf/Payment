# AMRtech Payment 1.0.4 – Produktkern-Abschluss

Release des freigegebenen Produktkerns inkl. atomarem Provisions-Save, einem aktiven Beratungsentwurf pro Kunde, Anbieter-Auswahl, Laufzeitkorrekturen, neuem Angebots-PDF und vereinfachtem Kundenlink.

## Web/PWA

| Feld | Wert |
|------|------|
| versionName | `1.0.4` |
| Worker | `amrtech-payment` |
| Branch | `main` |
| Release-Tag | `v1.0.4` |
| Datenmodus | Supabase-Produktion |

## Android

| Feld | Wert |
|------|------|
| Application-ID | `de.amrtech.paymentleads` |
| versionName | `1.0.4` |
| versionCode | `10004` |
| Zielname für R2 | `AMRtech-Payment-1.0.4.apk` |

## R2-Pfade

- `android/v1.0.4/AMRtech-Payment-1.0.4.apk`
- `android/v1.0.4/AMRtech-Payment-1.0.4.apk.sha256`
- `android/v1.0.4/manifest.json`
- danach `android/latest.apk` und `android/latest.json` auf 1.0.4 umstellen

## Entwurf `latest.json`

```json
{
  "versionName": "1.0.4",
  "versionCode": 10004,
  "minimumVersionCode": 10000,
  "mandatory": false
}
```

SHA-256, Download-URL und `sourceCommit` werden nach signiertem APK-Build ergänzt.

## Kernänderungen

- Atomarer Provisions-Save über RPC
- Genau ein aktiver Beratungsentwurf pro Kunde
- Anbieter als Auswahlliste inkl. OCR-Mapping
- Vertragslaufzeit nur katalogbelegte Optionen
- Kunden-PDF neu gestaltet
- Kundenlink-/Freigabe-UX vereinfacht

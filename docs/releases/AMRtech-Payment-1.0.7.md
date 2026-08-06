# AMRtech Payment 1.0.7 – Kundensichtbarkeit + nativer In-App-Update

Kundensichtbarkeit: Außendienst sieht nur zugewiesene Kunden; Admin sieht alle und steuert Betreuer. Native Download/Installation aus Banner und App-Info.

## Web/PWA

| Feld | Wert |
|------|------|
| versionName | `1.0.7` |
| Worker | `amrtech-payment` |
| Branch | `main` |
| Datenmodus | Supabase-Produktion |

## Android

| Feld | Wert |
|------|------|
| versionName | `1.0.7` |
| versionCode | `10007` |
| Manifest-URL | `https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json` |

## Native Update

- Cache-Download via Fetch + `@capacitor/filesystem`
- FileProvider Installer-Plugin `AppUpdateInstaller`
- `REQUEST_INSTALL_PACKAGES`

## Kundensichtbarkeit

- Admin: alle Kunden, Betreuer setzen/ändern/entfernen
- Außendienst: nur `assigned_sales_user_id = auth.uid()`, Auto-Zuweisung bei Neuanlage
- Fremdzugriff → „Kunde nicht gefunden“ (kein Datenleck)

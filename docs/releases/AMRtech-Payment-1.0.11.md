# AMRtech Payment 1.0.11

## Kurz

Play-Protect-Fix: `REQUEST_INSTALL_PACKAGES` dauerhaft entfernt. Gerätebisect (ppA) hat diese Permission als Auslöser für „Schädliche App blockiert“ bestätigt.

## App-Metadaten

| Feld | Wert |
|------|------|
| versionName | `1.0.11` |
| versionCode | `10022` |
| Package | `de.amrtech.paymentleads` |
| Tag | `v1.0.11` |

## Änderungen

- `android.permission.REQUEST_INSTALL_PACKAGES` entfernt
- Tote Berechtigungslogik entfernt (`canRequestPackageInstalls`, `ACTION_MANAGE_UNKNOWN_APP_SOURCES`, zugehörige UI)
- Installer-Pfad unverändert: FileProvider + `content://` + `ACTION_VIEW` + ClipData
- Update-State-Reconcile, Testkanal, Kundenzuweisung / Betreuerzuweisung bleiben erhalten

## Hinweis

ppA nutzte versionCode `10021` (nur Test). Produktionslinie: `10022`.

# AMRtech Payment 1.0.13

## Kurz

Payment-Updater vollständig durch den produktiv bewährten ArioVan-Wartungspfad ersetzt. Keine SHA-/Größenprüfung, kein Testkanal, keine Payment-eigene Update-State-Maschine.

## App-Metadaten

| Feld | Wert |
|------|------|
| versionName | `1.0.13` |
| versionCode | `10029` |
| Package | `de.amrtech.paymentleads` |
| Tag | `v1.0.13` |

## Änderungen

- Updatepfad 1:1 ArioVan Wartung (Manifest-Fetch, Banner, Cache-Download, FileProvider/Installer, Resume)
- Payment-spezifisch nur Package, Branding, URLs, Dateiname, Version
- Keine Fachänderungen an Kunden/Beratung/OCR/Provision

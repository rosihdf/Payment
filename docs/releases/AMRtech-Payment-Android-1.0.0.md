# AMRtech Payment Android 1.0.0

Release-APK aus dem unveränderten Git-Tag `v1.0.0` (ohne 1.1-Funktionen).

## Quelle

| Feld | Wert |
|------|------|
| Tag | `v1.0.0` |
| Commit | `4a8d369a8245592b7d74cab481e3872289cc0f54` |
| Build-Worktree | `/Users/micha/amrtech-payment-leads-apk-v1.0.0` (temporär, detached HEAD) |

## App-Metadaten

| Feld | Wert |
|------|------|
| App-Name | AMRtech Payment |
| Paketname / Application-ID | `de.amrtech.paymentleads` |
| versionName | `1.0.0` |
| versionCode | `10000` |
| Datenmodus | Supabase-Produktion (`VITE_DATA_MODE=supabase`) |
| Supabase-Projekt | `vohnqrftkuefkugabcob` |

## Buildverfahren

1. Separaten Git-Worktree aus `v1.0.0` anlegen (Hauptprojekt unangetastet).
2. Production-Env lokal bereitstellen (gitignored), Quality Gates und `npm run build:production`.
3. `@capacitor/android` hinzufügen, `npx cap add android`, `npx cap sync android`.
4. Android-Release mit JDK 21 und Gradle `assembleRelease`.
5. Signierung über lokalen Keystore **außerhalb** des Repositories.
6. Artefakte nach R2 hochladen und über den Download-Worker ausliefern.

Lokale Release-Artefakte (Worktree):

`release-artifacts/AMRtech-Payment-1.0.0.apk`

## Signierung

- Release-signiert (v1 + v2), **keine** Debug-Signatur.
- Keystore und Passwörter liegen ausschließlich lokal außerhalb des Repos.
- Gradle liest optional `~/.amrtech/keystore.properties` bzw. `AMRTECH_KEYSTORE_PROPERTIES`.
- Keine Passwörter, Tokens oder Keystore-Dateien werden versioniert oder hier dokumentiert.
- **Backup-Pflicht:** Den lokalen Release-Keystore sicher sichern; ohne ihn sind Updates derselben App-Signatur unmöglich.

## Prüfsumme und Größe

| Feld | Wert |
|------|------|
| Dateiname | `AMRtech-Payment-1.0.0.apk` |
| Größe | `11166182` Bytes (~10,65 MiB) |
| SHA-256 | `ca54d4e248cb9d6436893d1dac8e452785f2bda99dcb78deaf6dfd71376a3b4c` |

## Cloudflare

| Ressource | Wert |
|-----------|------|
| R2-Bucket (privat) | `amrtech-payment-releases` |
| Download-Worker | `amrtech-payment-downloads` |
| Worker-URL | `https://amrtech-payment-downloads.amrtech.workers.dev` |
| Deployment Version ID | `a038b786-ee38-4e6a-9b37-0ae6645264c5` |

### Objekte im Bucket

- `android/v1.0.0/AMRtech-Payment-1.0.0.apk`
- `android/v1.0.0/AMRtech-Payment-1.0.0.apk.sha256`
- `android/latest.apk`
- `android/latest.json`

### Öffentliche Downloadlinks

- Version (unveränderlich):  
  https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.0/AMRtech-Payment-1.0.0.apk
- Prüfsumme:  
  https://amrtech-payment-downloads.amrtech.workers.dev/android/v1.0.0/AMRtech-Payment-1.0.0.apk.sha256
- Latest APK:  
  https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.apk
- Manifest:  
  https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json

Der bestehende App-Worker `amrtech-payment` wurde **nicht** verändert.

## Rollback / Austausch von `latest.apk`

1. Gewünschte APK und `latest.json` lokal bereitlegen.
2. Nach `amrtech-payment-releases` hochladen:
   - `android/latest.apk`
   - `android/latest.json`
3. Versionspfade unter `android/vX.Y.Z/` **nicht** überschreiben.
4. Optional Worker-Allowlist um neue Versionspfade erweitern und Worker neu deployen.

`latest.*` ist kurz cachebar (`max-age=300`); Versions-URLs sind immutable.

## Git-Hinweis

- Tag `v1.0.0` unverändert.
- Kein Push, kein neuer Tag.
- Generische Download-Worker-/Release-Doku kann im Hauptprojekt liegen, aber wurde für diesen Schritt **nicht** automatisch committed.

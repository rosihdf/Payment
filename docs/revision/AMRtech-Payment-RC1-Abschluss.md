# AMRtech Payment Frontend-Rebuild – RC1-Abschluss

Stand: lokal auf `rebuild/frontend-v2`, ohne Push, ohne Deploy, ohne R2-APK-Upload.

## Git

| Feld | Wert |
|------|------|
| Branch | `rebuild/frontend-v2` |
| Baseline | `c8034d21576046f24f85f6cc11910daf3be08a98` |
| Commits seit Baseline | `20d5865` Legacy-Cutover · `f509f55` E2E · `46f368a` Docs · `a278f3a` Release-Vorbereitung |
| Push | nein |
| Deploy | nein |
| Tag | nein |

## Inventur

### Entfernt / ersetzt

- Legacy-Seiten shells: Angebotsliste/-neu/-edit, Vertragsliste, Angebotsdokument-Detail, Admin-Übersicht, Katalog-Shell, Profil
- Tote Badges/Layouts: `ActivationStatusBadge`, `TariffStatusBadge`, `AdminProductLayout`, `AdminTariffLayout`, `ProductsPage`

### Bewusste Ausnahmen (behalten)

- Auth (`LoginPage`, `AuthCallbackPage`, `RequireAuth`) außerhalb der AppShell
- Öffentliche Angebotsprüfung (`OfferReviewPage`) außerhalb der AppShell
- Formulare/Panels unter `features/` (Produkt, Tarif, OfferForm, Commission-Panels) – eingebettet in v2-Shells, keine parallele Oberfläche
- Doppelte `ResponsiveTable` (`components/common` + `v2/ui`) – technisch vorhanden, kein paralleler Workflow

### Feature-Flags

- Keine v2-Umschalt-Flags, keine sichtbare Alt-/Neu-Umschaltung
- v2 ist alleinige interne Oberfläche

## Funktionale Abnahme

Abgedeckt durch Playwright (13 Tests) und Vitest (152/1073), inkl.:

- Beratung: 0 € / manuelle Kosten, zurück/vor, Reload, Angebot, Closing/BestPay-Versanddialog
- CRM: Suche, Neuanlage, Akte
- Angebot / Kundenlink: öffentlicher Link, Rückfrage, Änderungswunsch
- Provision: Standardwert + Reload, Mitarbeitervereinbarung + Reload
- Admin: Benutzer, Tarif, Produkt
- BestPay: Versand dokumentieren erreichbar; Aktivierungsliste erreichbar (Demo oft leer)

## Responsive

- Viewports 360 / 390 / 412 / 768 / 960 / 1280 via `v2ResponsiveViewport.test.tsx` (55 Tests)
- Screenshots unter `docs/revision/screenshots/`
- Kein horizontaler Overflow in den geprüften Kernrouten

## PWA

Production-Preview lokal:

- Manifest `standalone`, HTTP 200
- Service Worker registered/active, Controller nach Reload vorhanden
- Kernrouten HTTP 200 inkl. `/offers`, `/contracts`

## Android

| Feld | Wert |
|------|------|
| versionName | 1.0.2 |
| versionCode | 10002 |
| SHA-256 | `d8cee4a7d5c51993af04e0c4ad2a025da49327b7515450007abb6a8502068c53` |
| Größe | 11191358 Bytes |
| Zertifikat SHA-256 | `d3f85fb274c460139b178b76c93b3fda555fa48b0d960b9817be4d85f174fd9d` |
| Emulator | Install Success, MainActivity resumed |
| Echtes Gerät | nicht geprüft in diesem Lauf |
| R2 / latest.json | unverändert bei 1.0.1 (bewusst) |

## Qualität

| Gate | Ergebnis |
|------|----------|
| Vitest | 152 / 1073 EXIT 0 |
| Playwright | 13 EXIT 0 |
| Lint | EXIT 0 (bekannte Warnings) |
| Typecheck | EXIT 0 |
| Production-Build | EXIT 0 |
| OCR-Verify | EXIT 0 |
| Secretscan dist | EXIT 0 |
| Secretscan Source | keine produktiven Secrets |
| RLS/Repository/Worker-Tests | in Vitest enthalten |
| Responsive | 55 EXIT 0 |
| PWA-Smoke | grün |
| Android Release-Build | EXIT 0 |
| APK-Signatur | EXIT 0 |
| Emulator Install/Launch | Success |
| `git diff --check` | EXIT 0 |
| `.only` / `.skip` | keine |
| Debug-Ausgaben in `src` | keine |

## Release-Vorbereitung (nicht ausgeführt)

Siehe `docs/releases/AMRtech-Payment-Android-1.0.2-RC1.md`.

### Web

- Production-Build vorhanden unter `dist/`
- Deploy-Befehl (später): `npm run deploy`
- Rollback: vorherigen Worker-Deploy / vorheriges `dist`-Artefakt

### Git-Plan (später)

```bash
git push -u origin rebuild/frontend-v2
# PR nach main, Review, Merge
git tag v1.0.2 <final-head>
git push origin v1.0.2
```

## Echte Restpunkte

- Live-`latest.json` zeigt noch 1.0.1 (Upload bewusst zurückgehalten)
- Echtes Android-Gerät in diesem RC1-Lauf nicht angeschlossen
- Öffentliche Angebots-E2E mocken den Worker-API-Pfad lokal (Vite ohne Worker)

## Entscheidung

- RC1 abnahmefähig: **ja**
- bereit für Merge und Release: **ja** (nach Push/PR/Review; Veröffentlichung von Web/APK separat und bewusst)

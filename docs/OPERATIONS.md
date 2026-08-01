# Betriebsdokumentation

## Lokale Installation

```bash
npm install
npm run dev
```

## Build und Tests

```bash
npm run lint
npm run test
npm run build
npm run verify:ocr-build
```

## Konfiguration

- **Persistenzmodus:** `VITE_DATA_MODE=local` (Standard) oder `supabase`
- **Supabase (final):** `VITE_SUPABASE_URL=https://vohnqrftkuefkugabcob.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=…`
- **Supabase-Kernbereiche:** `profiles`, `leads`, `tariffs`, `products` inkl. RLS; übrige Domains bleiben lokal
- **Demo-Modus:** aktiv nur in Development im lokalen Modus; im Supabase-Modus deaktiviert
- **Auth:** Demo-Benutzerwechsel nur lokal/Demo; Supabase-Modus nutzt E-Mail/Passwort für `admin` und `field_service`
- Keine Secrets im Frontend committen (kein DB-Passwort, kein `sb_secret_*`, kein Service-Role-Key)

## Cloudflare Deployment

Vite-Buildvariablen (`VITE_*`) werden **beim Build** eingebettet. Worker-Secrets ersetzen sie nicht.

Lokal für Production (gitignored): `.env.production.local` mit

```bash
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://vohnqrftkuefkugabcob.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=…
```

```bash
npm run deploy
# = build:production (assert + OCR-Assets + tsc + vite --mode production) + wrangler deploy
```

- Worker-Name: `amrtech-payment` (kein zweiter Worker)
- SPA-Assets aus `dist`, Cron Keepalive `17 3 * * *` UTC → RPC `touch_system_keepalive`
- Manuell: `POST /__keepalive`
- Smoke: `PRODUCTION_URL=https://amrtech-payment.amrtech.workers.dev npm run smoke:production`
- Production ohne `VITE_DATA_MODE=supabase` bricht fail-fast ab (kein Demo-Fallback)

## Benutzerverwaltung (Admin)

- UI: `/admin/users` → „Benutzer einladen“ (keine Passwortfelder)
- Worker-API (nur mit Admin-JWT + Service-Role-Secret):
  - `POST /api/admin/users/invite`
  - `PATCH /api/admin/users/:userId`
  - `POST /api/admin/users/:userId/deactivate|reactivate|resend-invite`
- Secret nur im Worker: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
- Einladungs-Redirect: `https://amrtech-payment.amrtech.workers.dev/auth/callback`
- In Supabase Auth URL Configuration setzen:
  - Site URL: `https://amrtech-payment.amrtech.workers.dev`
  - Redirect URLs: `https://amrtech-payment.amrtech.workers.dev/auth/callback`

## Administration

Route: `/admin`

Unterbereiche:

- Übersicht, Benutzer, Rollen/Rechte
- Tarife & Preise, Produkte & Hardware, Provision
- Freigaberegeln, Vorlagen
- Daten & Sicherung, Audit, Systemstatus

## Datenexport und Sicherung

- CSV-Exporte für fachliche Listen (Leads, Angebote, Stammdaten, Audit) – Download im Browser
- JSON-Gesamtsicherung mit Formatversion, Schema-Versionen und Prüfsumme – Download im Browser
- Sicherungshistorie speichert nur Metadaten lokal
- Keine PDF-Binärdaten, OCR-Bilder oder Secrets in Exporten

## Restore-Vorprüfung

- Datei auswählen, Formatversion und enthaltene Bereiche prüfen
- Keine Mutation vor expliziter Bestätigung
- Kein vollständiger transaktionaler Restore im Browser; Restore ist bewusst nur vorgeprüft

## Diagnose

- Integritätsprüfungen für verwaiste Referenzen, doppelte IDs und ungültige Versionen
- Nur sichere Reparaturen automatisch (z. B. beschädigte Cache-Zeilen)
- Keine stillen Änderungen an Annahmen, Freigaben oder Snapshots

## Vertragsmanagement (C)

- Routen: `/contracts`, `/contracts/:contractId`
- Entstehung: aus angenommenen OfferVersions, idempotent über `sourceKey`
- Nummernschema: `V-YYYY-NNNNN`
- Stores: `amrtech.contracts`, `amrtech.contractVersions`, `amrtech.contractTerminations`
- Statusänderungen nur über `ContractService` (keine Render-Mutation)
- Export/Backup/Diagnose/Restore-Vorprüfung kennen Vertragsstores
- OCR und PDF.js werden über `/contracts` nicht geladen

### Abgrenzung D

- Kein vollständiges Händler-Onboarding
- Keine Terminal-Lager- oder Seriennummernverwaltung
- Keine BestPay-Aktivierungs-API, kein Händler-/Kundenportal

## Aktivierung & Onboarding (D)

- Routen: `/activations`, `/activations/:activationId`
- Entstehung: aus `Contract` in Status Vorbereitung/Aktivierung, idempotent über `sourceKey` (`contract:{contractId}:initial-activation`)
- Nummernschema: `A-YYYY-NNNNN`
- Stores: `amrtech.activationCases`, `amrtech.activationChecklists`, `amrtech.activationApplications`, `amrtech.activationHardware`, `amrtech.activationBlockers`
- Statusänderungen ausschließlich über `ActivationService`, geführtes Übergangsmodell inkl. Rückkehr aus „Blockiert“
- Checkliste versionsgebunden aus der `ContractVersion` abgeleitet; Pflichtpunkte mit Abhängigkeiten und optionaler Beleg-Pflicht
- Hardware-Einheiten je Stückzahl der Vertrags-Hardware-Zeilen; Statusfolge Bestellt → Zugeordnet → Versendet → Zugestellt → Eingerichtet → Getestet → Aktiv; doppelte Seriennummern über aktive Aktivierungen hinweg werden nur gewarnt
- Anträge, Testzahlungen und Hardwareabweichungen sind rein manuelle, metadatenbasierte Vorgänge – keine externen Anbieter-, Acquirer- oder Zahlungs-APIs
- Go-live-Bestätigung überführt den Vertrag nach `active`; Provisionsstatus wird dabei nie automatisch verändert (nur Audit-Eintrag)
- Export/Backup/Diagnose/Systemstatus kennen alle Aktivierungsstores (Schema-Version `activations`)
- OCR und PDF.js werden über `/activations` nicht geladen
- Übersicht: reine Filter-/Sortier-/Kennzahlenfunktionen in `activationOverview.ts` (keine Engines, keine Mutation durch Lesen)
- Suche: Aktivierungsnummer, Vertragsnummer, Firma, Ansprechpartner, Offer-Nummer, externe Referenz, Seriennummer, Hardwaremodell
- Filter: vollständiger Status, Zuständigkeit (alle/eigene/ohne/konkret), Priorität (`normal`/`high`/`urgent`), Go-live 7/14/30/überfällig/ohne Datum, Arbeitszustände, kombinierbar, Reset, aktive Filter sichtbar
- Sortierung: nächste Fälligkeit, gewünschter Go-live, Priorität, zuletzt geändert, Firma, Aktivierungsnummer; stabile Zweitsortierung Aktivierungsnummer → ID
- Performance-Abnahme: 1.000 Aktivierungen, 20.000 Checklistenpunkte, 3.000 Anträge, 5.000 Hardware, 2.000 Blocker, 5.000 Aufgaben, 10.000 Aktivitäten, 5.000 Dokumentmetadaten; Bulk-Aggregation ohne N+1

### Abgrenzung E

- Keine laufende Kundenbetreuung/Vertragspflege nach Übergabe
- Kein Kundenportfolio
- Keine BestPay-/Acquirer-/Carrier-/Zahlungs-API
- Keine Kartendaten (PAN/CVV/Passwörter) in Stores

## Bekannte Grenzen (Version 1.0)

- Kernbereiche (`profiles`, `leads`, `tariffs`, `products`) und Auth laufen über Supabase; Operativdomänen (Angebote, Verträge, Aktivierungen, BestPay-Sessions, Aufgaben/Aktivitäten, Provision/Freigaben/Vorlagen/Audit) bleiben LocalStorage bis zur Migration
- Admin-Users-API läuft über Cloudflare Worker mit Service-Role-Secret (nicht im Frontend)
- Keine automatischen externen Backups und kein transaktionaler Restore
- Keine granulare Price-Book-Admin-UI jenseits Tarif-/Produkt-Hubs
- Kein E-Mail-Vorlagenversand
- Freigabesimulation und Vorlagenpflege sind lokal administrierbar; Angebotsworkflow nutzt weiter die bestehende Approval-Auswertung
- Rechtliche Aufbewahrungsfristen sind konfigurierbar/offen, nicht automatisch umgesetzt
- Browserdatenlöschung kann lokale Operativdaten entfernen – regelmäßige Sicherung empfohlen

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

- **Persistenzmodus:** `local` (Browser-`localStorage`)
- **Demo-Modus:** aktiv in Development, deaktiviert in Production-Konfiguration
- **Auth:** Demo-Benutzerwechsel nur im Demo-Modus; Produktion erfordert spätere Backend-Auth
- Keine Secrets im Frontend committen

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

## Bekannte Grenzen

- Keine echte Server-API, OAuth, Cloud-Sync oder Mandantentrennung
- Keine automatischen externen Backups und kein transaktionaler Restore
- Keine granulare Price-Book-Admin-UI jenseits Tarif-/Produkt-Hubs
- Kein E-Mail-Vorlagenversand
- Freigabesimulation und Vorlagenpflege sind lokal administrierbar; Angebotsworkflow nutzt weiter die bestehende Approval-Auswertung
- Rechtliche Aufbewahrungsfristen sind konfigurierbar/offen, nicht automatisch umgesetzt
- Browserdatenlöschung kann lokale Daten entfernen – regelmäßige Sicherung empfohlen

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

## Bekannte Grenzen

- Keine echte Server-API, OAuth, Cloud-Sync oder Mandantentrennung
- Keine automatischen externen Backups und kein transaktionaler Restore
- Keine granulare Price-Book-Admin-UI jenseits Tarif-/Produkt-Hubs
- Kein E-Mail-Vorlagenversand
- Freigabesimulation und Vorlagenpflege sind lokal administrierbar; Angebotsworkflow nutzt weiter die bestehende Approval-Auswertung
- Rechtliche Aufbewahrungsfristen sind konfigurierbar/offen, nicht automatisch umgesetzt
- Browserdatenlöschung kann lokale Daten entfernen – regelmäßige Sicherung empfohlen

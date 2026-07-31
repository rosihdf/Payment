# AMRtech Payment Leads

Außendienst-Anwendung zur Aufnahme von Payment-Leads und zum Vergleich zwischen dem aktuellen Payment-Anbieter eines Interessenten und einem BestPay-Angebot.

## B03: Verbindlicher Angebotsworkflow

Angebote führen zusätzlich zum Legacy-Status einen service-geschützten Workflow mit Freigabe, Versand, Annahme/Ablehnung, Aktivierung und Provision. Jede Angebotsversion enthält einen unveränderlichen Snapshot inklusive Summen, Angebotsnummer, Vertragsmodell, Terminal- und Zubehörpositionen, Preis-/Provisionsreferenzen sowie Freigabe- und Kostenbasisdaten. Die zentrale Snapshot-Validierung kann von Wizard, Aktivierung und PDF-Ausgabe verwendet werden.

Freigabe, Versand, Annahme, Ablehnung und Aktivierung werden als nachvollziehbare Ereignisse gespeichert. Annahme und Ablehnung nutzen feste, auswertbare Gründe; Aktivierungen enthalten versionsgebundene Checklisten, Abweichungen, Hardware und externe Referenzen. Die Freigabe schützt vor Selbstfreigabe im Außendienst. Automatische Freigabe-, Nachfass- und Aktivierungsaufgaben sowie Aktivitäten verwenden stabile Source-Keys und sind damit idempotent. Dokumente werden ausschließlich als Metadaten (kein Binärinhalt in `localStorage`) registriert.

Workflow-Mutationen erfolgen über `OfferWorkflowService`. Versionen werden bei relevanten Snapshot-Änderungen erzeugt, Ablauf wird ausschließlich explizit geprüft, und BestPay-Angebote erhalten ihre Vergleichs- und Szenario-Herkunft. Der Wizard kann den aktuellen Workflow-Kontext einschließlich Version und Freigabebedarf abrufen; `approvalAcknowledgedAt` bleibt ausschließlich ein veralteter UI-Wiederaufnahmehinweis.

## B04: Administration und Produktivbetrieb

Unter `/admin` bündelt die Anwendung zentrale Stammdaten- und Betriebsfunktionen: Benutzer, Rollen/Rechte, Tarife/Preise, Produkte/Hardware, Provision, Freigaberegeln, Vorlagen, Export/Sicherung, Audit und Systemstatus. Rechte werden zentral über das Permission-Modell geprüft; der Demo-Benutzerwechsel ist nur im Demo-Modus verfügbar.

Die Anwendung läuft im **lokalen Datenmodus** (Browser-`localStorage`). Es gibt keine Cloud-Synchronisation. Gesamtsicherungen exportieren strukturierte JSON-Daten ohne Binärdateien, Secrets oder OCR-Bilder. Restore-Vorprüfungen mutieren keine Daten vor expliziter Bestätigung. Provisionsvorschau und Freigabesimulation nutzen die bestehenden Engines.

## C: Vertragsmanagement

Unter `/contracts` verwaltet die Anwendung dauerhafte Vertragsbeziehungen. Verträge entstehen idempotent aus angenommenen Angebotsversionen (`accepted` bzw. Folgezustände). Das Angebot bleibt historischer Abschlussnachweis; `Contract` und `ContractVersion` sind die laufende Konditionswahrheit.

Fachlicher Umfang:

- Vertragsübersicht mit Suche, Filtern, Fristen und Kennzahlen
- Vertragsdetail mit Übersicht, Versionen, Änderungen, Kündigung, Dokumenten, Aufgaben/Aktivitäten
- Statusmodell mit service-seitigen Übergängen (keine Mutation durch bloßes Rendern)
- Versionierung inkl. Diff, geplanter Aktivierung und Freigabebewertung über die bestehende Approval-Logik
- Laufzeiten/Kündigungsfristen zentral berechnet; Fristaufgaben idempotent über `sourceKey`
- Strukturierte Kündigungen inkl. Rückgewinnung und Nachweisreferenz
- Dokumentmetadaten mit Contract-/Version-Bezug (keine Binärdaten in `localStorage`)
- Integration mit Angebot, Aktivierung, Provision (Referenz), Admin-Export/Backup/Diagnose/Audit

Operatives Onboarding inkl. Hardwarezuordnung und Go-live liegt in Bereich D (`/activations`). Keine BestPay-Aktivierungs-API im Vertragsbereich.

## D: Aktivierung & Onboarding

Unter `/activations` bildet die Anwendung die operative Umsetzung eines Vertrags bis zum Go-live ab. `ActivationCase` ist die führende operative Wahrheit für das Onboarding aus einem `Contract`; `Contract`/`ContractVersion` bleiben die Wahrheit für vereinbarte Konditionen und Hardware-Positionen. Das bestehende `OfferActivation` (B03) bleibt unverändert bestehen.

Eine Aktivierung entsteht idempotent (`sourceKey` = `contract:{contractId}:initial-activation`) aus einem Vertrag in Status Vorbereitung oder Aktivierung. Beim Start wird eine versionsgebundene Checkliste aus der aktuellen `ContractVersion` abgeleitet (Stammdaten, Vertragsprüfung, Unterlagen, Händlerantrag, Acquiring, Hardware, Versand, Einrichtung, Test, Go-live, Abschluss, Übergabe) sowie je Hardware-Zeile eine Einheit pro Stückzahl angelegt.

Fachlicher Umfang:

- Aktivierungsübersicht mit Suche (Nummer/Vertrag/Firma/Kontakt/Angebot/Referenz/Seriennummer/Modell), vollständigen Statusfiltern, Zuständigkeit, Priorität, Go-live-Zeitraum (7/14/30/überfällig/ohne Datum), Arbeitszuständen, kombinierbaren Filtern inkl. Reset, stabiler Sortierung und Kennzahlen
- Aktivierungsdetail mit Übersicht, Checkliste, Unterlagen, Anträgen, Hardware, Einrichtung/Test, Blockern und verknüpften Aufgaben
- Geführtes, service-seitig geprüftes Statusmodell inkl. Rückkehr aus einem blockierten Zustand
- Checkliste mit Pflicht-/Kann-Punkten, Abhängigkeiten und Beleg-Anforderung (Dokument als Metadaten, kein Binärinhalt)
- Anträge (Händlereinrichtung, Acquiring, Terminal-Bereitstellung, Zusatzleistungen) rein manuell dokumentiert – keine externen API-Aufrufe
- Hardware je Einheit mit Bestellung, Zuordnung, Versand, Zustellung, Einrichtung, Test und Übergabe; Datumsreihenfolge wird geprüft, doppelte Seriennummern über aktive Aktivierungen hinweg werden gewarnt (nicht blockiert)
- Hardwareabweichungen erzeugen einen harten Blocker und eine Aufgabe, ohne die `ContractVersion` zu verändern
- Testzahlungen ausschließlich mit optionalem Betrag, anonymisierter Referenz und Ergebnis – keine Kartendaten, kein PAN/CVV
- Blocker (Hinweis/Warnung/hart) mit Pflichtlösung beim Schließen; harte Blocker verhindern Go-live und versetzen die Aktivierung in den Status „Blockiert“
- Go-live-Bestätigung nur bei erfüllter Checkliste, getesteter Hardware, entschiedenen Anträgen und ohne offene harte Blocker; überführt den Vertrag nach `active`. Die Provision wird dabei **nicht** automatisch auf „bezahlt“ gesetzt – es wird ausschließlich ein Audit-Eintrag erzeugt
- Rücknahme des Go-live mit Pflichtbegründung, Abschluss und Übergabevorbereitung an die Kundenbetreuung (Kundenportfolio E folgt separat)
- Automatische Folgeaufgaben und Aktivitäten je Schritt/Ereignis, idempotent über `sourceKey`
- Integration mit Vertrag, Aufgaben/Aktivitäten, Dokumenten, Audit sowie Admin-Export/Diagnose/Systemstatus
- Performance-Abnahme mit 1.000 Aktivierungen und zugehörigen Maximalmengen (20.000 Checklistenpunkte, 3.000 Anträge, 5.000 Hardware, 2.000 Blocker, 5.000 Aufgaben, 10.000 Aktivitäten, 5.000 Dokumentmetadaten); Listenaggregation ohne N+1 und ohne Pricing-/Commission-/Recommendation-Engines

Abgrenzung E: Keine laufende Kundenbetreuung/Vertragspflege nach Übergabe, kein Kundenportfolio, keine BestPay-/Acquirer-/Carrier-/Zahlungs-API, keine Kartendaten (PAN/CVV/Passwörter) in Stores.

Weitere Betriebshinweise: `docs/OPERATIONS.md`

## Technologie

- React + TypeScript
- Vite
- React Router
- vite-plugin-pwa
- Vitest
- Capacitor (vorbereitet)

## Entwicklung

```bash
npm install
npm run dev
```

## Qualitätssicherung

```bash
npm run lint
npm run test
npm run build
```

## Architektur

- **UI** arbeitet ausschließlich über Repository-Interfaces und Services
- **Repositories** kapseln den Datenzugriff (localStorage)
- **Services** enthalten Geschäftslogik
- **Domainmodelle** sind frei von UI-Abhängigkeiten

## PWA

Die Anwendung ist als Progressive Web App installierbar. Service Worker und Offline-App-Shell sind über `vite-plugin-pwa` eingerichtet.

## Capacitor (Mobile)

Capacitor ist vorbereitet. Native Projekte wurden noch nicht angelegt.

Spätere Schritte für Android:

```bash
npm run build
npx cap sync
npx cap add android
npx cap open android
```

## Demo-Rollen

Im Header kann zwischen Demo-Benutzern gewechselt werden:

- 3× Außendienst
- 1× Admin

Die Navigation passt sich der gewählten Rolle an.

## Vergleichsrechner

Unter `/calculator` vergleicht die Anwendung bisherige Payment-Konditionen mit einem aktiven BestPay-Tarif.

- Berechnung basiert auf bisherigen Konditionen und dem gewählten aktiven Tarif
- Geldwerte intern in Cent, Transaktions- und Clearingpreise in Zehntelcent (1 = 0,1 Cent)
- Prozentwerte intern in Zehntel-Basispunkten (249 = 0,249 %)
- Monatliche Fixkosten aus Grundgebühr je Vertrag, Terminalmiete je Terminal und Servicepauschale je Terminal
- Initiale Tarifkatalogdaten: BestPay Mobile A920 Classic und Flat (interne Produktcodes `BP-A920-CLASSIC`, `BP-A920-FLAT`)
- Non-EWR- und Commercial-Card-Markups sowie Zubehör sind noch nicht Teil des Vergleichs
- Lokale Berechnung ohne Backend
- Keine Angebots- oder PDF-Erstellung in A05

## Tarifverwaltung

- Echte BestPay A920-Tarife aus Flyer-Unterlagen (Classic und Flat)
- Produktcodes sind interne App-Codes, nicht als offizielle BestPay-Produktcodes ausgewiesen
- Unbekannte Vertragslaufzeiten, Kündigungsfristen und Inklusivtransaktionen bleiben offen (`null` / „Keine Angabe“)
- Versionierte Katalogmigration entfernt alte Demo-Platzhalter (`BP-START`, `BP-BUSINESS`, `BP-FLEX`) idempotent

## Routen

| Route | Beschreibung |
|-------|--------------|
| `/` | Dashboard |
| `/leads` | Lead-Übersicht |
| `/leads/new` | Neuer Lead |
| `/leads/:id` | Lead-Detail |
| `/calculator` | Rechner-Hub (BestPay-Einzelberechnung, Neue Berechnung, gespeicherte Berechnungen) |
| `/calculator/wizard` | Legacy-Redirect auf `/sales/wizard` |
| `/sales` | Vertriebsarbeitsplatz (Pipeline, laufende Vertriebsfälle) |
| `/sales/wizard` | BestPay Vertriebsprozess (B01, technisch SalesWizard) |
| `/calculator/bestpay` | Eigenständiger BestPay-Vergleich (A11.4) |
| `/calculator/bestpay/history` | Gespeicherte BestPay-Berechnungen (A11.5) |
| `/products` | Produktkatalog (Admin und Außendienst, nur aktive Produkte) |
| `/offers` | Angebotsübersicht (Admin und Außendienst) |
| `/offers/new` | Neues Angebot anlegen |
| `/offers/:id` | Angebotsdetail |
| `/offers/:id/edit` | Angebot bearbeiten (nur Entwürfe) |
| `/offers/:id/preview` | PDF-Vorschau |
| `/offers/:offerId/documents/:documentId` | PDF-Dokumentdetail |
| `/contracts` | Vertragsübersicht |
| `/contracts/:contractId` | Vertragsdetail |
| `/admin` | Administration (Übersicht, Benutzer, Stammdaten, Betrieb) |
| `/admin/users` | Benutzerverwaltung |
| `/admin/roles` | Rollen und Rechte |
| `/admin/pricing` | Tarife und Preise |
| `/admin/products` | Produkte und Hardware (Hub) |
| `/admin/products/manage` | Produktverwaltung (Admin) |
| `/admin/tariffs` | Tarifverwaltung (Admin) |
| `/admin/commission` | Provisionsverwaltung |
| `/admin/approvals` | Freigaberegeln |
| `/admin/templates` | Vorlagen |
| `/admin/data` | Export und Sicherung |
| `/admin/audit` | Audit |
| `/admin/system` | Systemstatus |
| `/profile` | Profil |

## Produktkatalog

Unter `/products` zeigt die Anwendung den BestPay-Hardware- und Produktkatalog für Admin und Außendienst. Nur aktive Produkte sind sichtbar; der Außendienst kann Produkte ansehen, aber nicht bearbeiten.

Unter `/admin/products/manage` verwaltet der Admin alle Produkte inklusive inaktiver Einträge.

### Abgrenzung zu Payment-Tarifen

Produkte und Payment-Tarife sind getrennte Domänen:

- **Produkte:** Hardware, Kassensysteme, Zubehör, Softwaremodule, Dienstleistungen
- **Tarife:** Payment-Konditionen (z. B. BestPay Mobile A920 Classic/Flat)

Es gibt keine automatische Tarifempfehlung und keine automatische Produkt-/Tarifverknüpfung. Gemeinsam genutzt wird nur die Terminalart (stationär/mobil) zur Darstellung.

## Angebotskonfiguration

Unter `/offers` können Admin und Außendienst interne BestPay-Angebote konfigurieren und speichern.

- Lead/Kunde auswählen, optional einen Payment-Tarif und Produktpositionen hinzufügen
- Mengen und kontrollierte Preisüberschreibungen mit Begründung
- Monatliche und einmalige Summen (Tarif-Fixkosten + Positionen)
- Status: Entwurf, Abgeschlossen, Storniert
- Snapshots für Kunde, Tarif und Produkte — gespeicherte Angebote bleiben unabhängig von späteren Katalogänderungen
- Angebotsnummern im Format `BP-ANG-YYYY-0001`
- Keine E-Mail, keine Provision in A07

## PDF-Angebotsdokumente (A08)

Unter `/offers/:id` können Admin und Außendienst PDF-Dokumente zu Angeboten erzeugen und verwalten.

- **PDF-Vorschau** — unverbindliche Vorschau ohne Speicherung (`/offers/:id/preview`)
- **Finales PDF** — unveränderlicher Snapshot nur für abgeschlossene Angebote
- **Neue Dokumentversion** — ersetzt die aktuelle Version; frühere Versionen bleiben als „Frühere Version“ sichtbar
- Integritätsprüfung über Content-Hash im gespeicherten Snapshot
- Lokale PDF-Erzeugung mit jsPDF, Download über Blob-URL
- Absenderdaten aus dem Firmenprofil (`/profile`)

### Routen

| Route | Beschreibung |
|-------|--------------|
| `/offers/:id/preview` | PDF-Vorschau (nicht gespeichert) |
| `/offers/:offerId/documents/:documentId` | PDF-Dokumentdetail mit Vorschau und Download |

### Berechtigungen

- **Admin:** alle Angebote sehen und bearbeiten
- **Außendienst:** nur eigene Angebote; Leads gemäß bestehender Lead-Berechtigung

### Abgrenzung

Tarife, Produkte und Angebote bleiben getrennte Domänen. Variable Tarifkonditionen (Transaktionsentgelte, Kartenentgelte) werden angezeigt, aber nicht in die feste Angebotssumme eingerechnet.

### Produktkategorien

| Kategorie | Beschreibung |
|-----------|--------------|
| `payment_terminal` | Kartenterminal |
| `cash_register` | Kassensystem |
| `cash_register_module` | Kassenmodul |
| `accessory` | Zubehör |
| `service` | Dienstleistung |

### Preisarten

- **Monatlich** — wiederkehrende Miete oder Pauschale
- **Einmalig** — einmalige Kosten
- **Inklusive** — im Produkt enthalten (Preis 0 €)
- **Auf Anfrage** — kein belegter Preis (Blanko-Angebote)

Geldwerte intern in Cent. Einige Produkte haben einen zweiten Preisbestandteil (z. B. Premium Line: Kassenmiete + Swissbit TSE Stick).

### Initiale Katalogprodukte

19 belegte Produkte aus BestPay-Unterlagen (Premium Line, Zusatzmodule, CCV-Kassensysteme, A920-Zubehör, Blanko-Kassensysteme auf Anfrage). Interne Produktcodes beginnen mit `BP-`.

### Speicherung

Produkte werden lokal in `localStorage` gehalten. Die versionierte Katalogmigration (`productCatalogVersion: 1`) ergänzt fehlende Initialprodukte idempotent, ohne bestehende Admin-Produkte zu überschreiben.

## Preis- und Freigaberegel-Engine (A09)

A09 wertet Angebots- und Kalkulationskontexte deterministisch gegen versionierte Preislisten, Preisregeln und Vertragslaufzeiten aus. Es liefert eine vollständige interne Preisentscheidung inklusive Prüfklasse und Freigabevorbereitung für spätere Blöcke (A10–A14).

### Kernprinzipien

- **Jedes Angebot benötigt Adminprüfung** — `standard` bedeutet Schnellprüfung, nicht automatische Freigabe
- **Keine erfundenen Preise** — fehlende Konfiguration führt zu blockierenden Befunden
- **Sonderlaufzeiten** sind mindestens `critical` und benötigen eine Begründung
- **Preis unter Mindestpreis** ist `critical`
- **Exakt 36 Monate** werden provisionsseitig nicht erfunden zugeordnet (Hinweis `PROVISION_TERM_AMBIGUOUS_36_MONTHS`)
- **A09 berechnet noch keine Provision** — das folgt in A10

### Prüfklassen

| Klasse | Bedeutung |
|--------|-----------|
| `standard` | Reguläres Angebot, Schnellprüfung fachlich möglich |
| `attention` | Auffällige Abweichung, Detailprüfung erforderlich |
| `critical` | Kritische Abweichung oder blockierende Konfigurationslücke |

### Engine-Schichten

1. Eingabekontext (`PricingEvaluationInput`)
2. Stichtags- und Preislistenversionsauflösung
3. Regelmatching mit Spezifität und Priorität
4. Preisgrenzenprüfung (Listen-, Ziel-, Mindestpreis, Nachlass)
5. Laufzeitauswertung (Standard vs. Sonderlaufzeit)
6. Prüfklassifikation
7. Freigabevorbereitung (`ApprovalPreparation`)
8. Reproduzierbarer Snapshot

### UI-Integration

Unter `/offers/:id` zeigt der Abschnitt **Preis- und Freigabeprüfung**:

- Außendienst: empfohlener/gewählter Preis, Prüfstatus, Laufzeithinweise (ohne Mindestpreis)
- Admin: zusätzlich Listen-/Ziel-/Mindestpreis, Preislistenversion, angewendete Regeln
- Neuberechnung für Entwürfe über bestehendes Button-Pattern

### Speicherung

Preislisten, Laufzeiten, Regeln und Auswertungen werden lokal in `localStorage` gehalten. Die Katalogmigration startet **ohne erfundene Demo-Preisregeln** — produktive Preisdaten müssen administrativ gepflegt werden.

### Abgrenzung zu A10

A09 liefert: Preisgrenzen, Abweichungen, Prüfklasse, Snapshot, Freigabepaket. A10 übernimmt die vollständige Provisionsberechnung und -kürzung.

## Provisions-Engine (A10)

A10 berechnet auf Basis der A09-Preisbewertung individuelle BestPay-Provisionsvorschauen und eingefrorene Berechnungen.

### Kernprinzipien

- **A09-Preisbewertung ist verbindliche Grundlage** — keine parallele Preislogik
- **Keine erfundenen Provisionssätze** — produktiver Katalog startet leer
- **Exakt 36 Monate** werden nicht automatisch zugeordnet (`COMMISSION_TERM_AMBIGUOUS_36_MONTHS`)
- **Laufende Beteiligungen** bleiben vorläufig, wenn Abrechnungsdaten fehlen
- **Kürzungen** benötigen Adminentscheidung und Begründung (max. 50 % der ursprünglichen Provision)
- **Keine Auszahlung** in A10 — höchstens Status `expected` nach Einfrieren

### Belegte Demo-Modelle (nur Tests)

- Klassisch: Terminal+ACQ >36M = 300 €, Terminal <36M = 200 €, ACQ = 150 €
- Variabel: 150 € / 100 € / 100 € plus laufende Beteiligungen (explizit konfigurierte Formeln)
- Zubehör: 20 % vom Verkaufspreis

### Schwellenpräzision

Gebühren wie 0,039 € und 0,014 € werden als `tenthsOfCent` gespeichert (39 bzw. 14).

### UI

Unter `/offers/:id` zeigt der Abschnitt **Provision** die Vorschau für Außendienst und Details/Kürzungsentscheidung für Admin.

## BestPay-Empfehlungsrechner (A11)

A11 vergleicht **ausschließlich BestPay-Konfigurationen** miteinander — keine Wettbewerber, kein Multi-Provider-Vergleich.

### Kernprinzipien

- **Kundenbedarf zuerst** — Provision dominiert nicht die Primärempfehlung
- **A09 orchestrieren** — Preislogik wird nicht dupliziert
- **A10 intern** — Provisionsvorschau je Kandidat ohne echtes Angebot pro Variante
- **Keine erfundenen Gewichte** — produktiver WeightSet-Katalog startet leer; deterministische Grundregeln
- **Blockierte Kandidaten** werden nicht regulär empfohlen oder übernommen
- **Unvollständige Kosten** werden als solche markiert — kein scheinbar exakter Gesamtbetrag
- **Snapshot** — reproduzierbare Entscheidungsgrundlage mit Katalogversionen
- **Stale-Erkennung** — relevante Eingabe-/Katalogänderungen invalidieren Übernahme

### Ablauf

1. Bedarf aus Lead/Offer (`CustomerNeed`)
2. Kandidatenbildung aus Tarifen, Hardware, Laufzeiten
3. Harte Ausschlüsse (inaktiv, Laufzeit, Hardware)
4. A09 je Kandidat, A10 intern
5. Kostenprojektion, Scoring, Ranking
6. Primärempfehlung + bis zu 2 Alternativen
7. Übernahme in Angebotsentwurf mit Referenz und optionaler Abweichungsbegründung

### UI

Unter `/offers/:id` zeigt der Abschnitt **BestPay-Empfehlung** Primärempfehlung, Alternativen und Admin-Analyse.

### Abgrenzung zu A12

A11 bereitet gewählte Konfiguration und Snapshot-Referenz vor. A12 übernimmt finale Angebotserstellung, Adminfreigabe und PDF.

## OCR-Abrechnungsimport und Ist-Kostenbasis (A11.1)

A11.1 erfasst **Fremdanbieter-Abrechnungen** ausschließlich als Ist-Situation des Kunden — kein Wettbewerber-Produktkatalog.

### Kernprinzipien

- **Manuelle Prüfung Pflicht** — OCR-Werte fließen nie ungeprüft in A11 ein
- **PDF-Text zuerst** — eingebetteter Text via `pdfjs`; OCR-Fallback nur vorbereitet (Bilder: `BILLING_OCR_UNAVAILABLE`)
- **Mock-OCR nur Demo/Test** — `VITE_BILLING_DEMO_OCR=true` oder Tests
- **Keine Originaldateien in localStorage** — Session-In-Memory; Metadaten und Snapshots persistent
- **Mehrfachabrechnungen** — gewichtete Monatsnormalisierung, Dubletten- und Ausreißerkennung ohne stille Entfernung
- **Einmalige Kosten getrennt** — nicht ungeprüft in laufende Monatskosten gemischt

### Ablauf

1. Upload/Foto einer oder mehrerer Abrechnungen (`OfferBillingImportSection`)
2. Validierung, Fingerprint, Extraktion (PDF-Text / Demo-Mock)
3. Felderkennung mit Konfidenz und Konfliktauflösung
4. Prüfung: bestätigen, korrigieren, verwerfen, manuell ergänzen
5. Periodennormalisierung und Aggregation zu `CustomerCostBaseline`
6. Bestätigung erzeugt unveränderlichen `BillingImportSnapshot`
7. A11 übernimmt Baseline in `CustomerNeed` und markiert Empfehlung bei Änderung als stale
8. Ist-vs-BestPay-Vergleich in der Empfehlungsansicht (nur bei vergleichbarer Basis)

### Unterstützte Formate

PDF, JPG/JPEG, PNG, WEBP — HEIC derzeit nicht. Kameraaufnahme über Browser (`capture="environment"`).

### Abgrenzung

Kein Fremdanbieter-Tarifvergleich. A12 übernimmt finale Angebotserstellung, Adminfreigabe und PDF.

## Produktive lokale OCR und Korrekturansicht (A11.2)

A11.2 ersetzt den Platzhalter `UnavailableOcrExtractionProvider` durch **`BrowserOcrExtractionProvider`** (Tesseract.js 6.x) — **OCR läuft lokal im Browser**. Kundendokumente werden für OCR **nicht an externe Dienste übertragen**.

### OCR-Technologie

- Bibliothek: **tesseract.js** mit Web Worker
- Sprachmodelle: **deu+eng** (Deutsch Standard, Englisch für gemischte Abrechnungen)
- Worker-Wiederverwendung pro Importsitzung, maximal ein paralleler OCR-Job
- Sprachdaten werden beim ersten Lauf geladen (gleicher Origin über npm-Paket)

### PDF-Strategie

1. Eingebetteter PDF-Text via `pdfjs-dist` (bevorzugt)
2. Textqualitätsprüfung (Länge, lesbare Zeichen, Abrechnungsschlüsselwörter)
3. Bei unzureichendem Text: Seitenrendering + lokale OCR
4. Dokumente als `embedded_text`, `ocr` oder `mixed` gekennzeichnet

### Bildverarbeitung

- Formate: JPG/JPEG, PNG, WEBP (+ Kameraaufnahme)
- Vorverarbeitung: Graustufe, leichte Kontrastanpassung, Skalierung, Transparenz auf Weiß
- Manuelle Rotation (90° links/rechts, zurücksetzen) ohne Original-Blob zu verändern
- OCR-Cache in-memory (Fingerprint, Seite, Rotation, Provider-Version)

### Korrekturansicht

- Editierbare Feldtypen (Geld, Ganzzahl, Prozent, Datum, Zeitraum)
- Mehrere Feldkandidaten vergleichen und auswählen
- Manuelle Gebührenpositionen (`BillingCostLineItem`) ergänzen
- Perioden und Baseline-Vorschau werden nach Korrekturen neu berechnet
- Erst **Werte übernehmen** erzeugt die bestätigte Ist-Kostenbasis für A11

### Datenschutz

- Keine Originaldateien in localStorage
- Keine vollständigen OCR-Texte in Console-Logs
- Object-URLs und Canvas-Ressourcen werden freigegeben
- Mock-OCR nur mit `VITE_BILLING_DEMO_OCR=true` oder in Tests

### Offlinegrenzen

Nach erstmaligem Laden von Worker und Sprachdaten grundsätzlich offline nutzbar. Sehr große PDFs und ältere Android-Geräte können Leistungsgrenzen haben.

### Bekannte Leistungsgrenzen

- Kein HEIC-Support
- Keine Perspektivkorrektur
- OCR-Konfidenz ersetzt keine fachliche Prüfung
- Alte bestätigte Snapshots werden durch bessere OCR nicht verändert

## Eigenständiger BestPay-Vergleichsrechner (A11.4)

Unter **Rechner** (`/calculator`) gibt es den Einstieg **BestPay-Vergleich**.

### Einstieg

- Primär: **Abrechnung einlesen** → `/calculator/bestpay?mode=billing`
- Sekundär: **Werte manuell eingeben** → `/calculator/bestpay?mode=manual`
- Funktioniert **ohne vorhandenes Angebot** und ohne vorherige Lead-Zuordnung

### Ablauf

1. Grundlage wählen (OCR/Billing oder manuell)
2. Ist-Daten prüfen/bestätigen (bestehende A11.1–A11.3-Pipeline)
3. Bedarf und Zielbild erfassen
4. BestPay berechnen über A09/A10/A11-Engines
5. Empfehlung, Alternativen, Ersparnis/Mehrkosten
6. Optional Lead zuordnen und **Angebot erstellen**

### Wiederverwendung

- Billing/OCR: `BillingImportService.getOrCreateFreeSession` + bestehende `OfferBillingImportSection` (Session-Modus)
- Recommendation: `RecommendationService.calculateForStandaloneNeed`
- Pricing/Commission: innerhalb der Recommendation-Engine
- Angebot: `OfferService.createOffer` + Recommendation-/Baseline-Link

### Persistenz

- `BestPayComparisonSession` versioniert in localStorage
- Entwurf wiederherstellbar, verwerfbar
- Keine Originaldateien persistent

### Rechte

- Rechner für Außendienst und Admin
- Provision nur intern sichtbar (getrennt vom Händlernutzen)
- Angebot nur mit Lead-Zuordnung und Angebotsrecht über bestehende Offer-Services

### Snapshots / Stale

- Ergebnis speichert Recommendation-Version und Fingerprint
- Geänderte manuelle Eingaben markieren das Ergebnis als `stale`
- Stale blockiert die Angebotsanlage bis zur bewussten Neuberechnung

### Datenschutz

- Original-PDF/Fotos werden nicht in der Comparison-Session persistiert
- OCR bleibt lokal im Browser (A11.2/A11.3)

### Bekannte Grenzen

- Keine separate Kunden-Domain: Zuordnung erfolgt über Lead
- Kostenartenaufschlüsselung Ist-vs-BestPay nutzt die von A11 gelieferten Aggregate
- Keine Listenansicht gespeicherter Berechnungen (A11.5)

### Abgrenzung A11.5

A11.4 speichert Sessions, bietet aber keine vollständige Historienverwaltung. Das folgt in A11.5.

## Gespeicherte BestPay-Berechnungen (A11.5)

Unter **Rechner** gibt es die Übersicht **Gespeicherte Berechnungen** (`/calculator/bestpay/history`).

### Funktionen

- Mehrere Sessions im versionierten Store (`activeSessionId` + `sessions`)
- Migration bestehender A11.4-Sessions ohne ID-/Snapshot-Verlust
- Suche (Titel, Händler, Lead, Angebotsnummer/-titel, Variante)
- Filter: Status, Aktualität, Zuordnung, Datenquelle, Zeitraum
- Sortierung (Standard: zuletzt geändert)
- Wiederaufnahme derselben Session-ID ohne stille Neuberechnung
- Duplizieren (ohne Offer-/Idempotenzschlüssel; neu berechnen vor Angebot)
- Archivieren / Wiederherstellen
- Begrenztes Löschen rein lokaler Entwürfe
- Stale-Hinweis über Snapshot-Metadaten (keine Engine-Neuberechnung in der Liste)
- Lead-/Angebotslinks, fehlende Referenzen crashen nicht

### Persistenz / Datenschutz

- Keine Original-PDF/Fotos/Base64 in der Historie
- Listenmodell nur mit Metadaten/Summaries
- OCR/PDF.js werden durch die Historienseite nicht geladen

### Rechte

- Historie für Außendienst und Admin
- Provision bleibt getrennt und nur bei Recht sichtbar (nicht in der Liste)
- Archivieren/Löschen service-seitig abgesichert

### Abgrenzung A11.6

Kein separater A11.6-Block mehr: Varianten-/Szenariovergleich ist Teil des B01-Vertriebs-Wizards. Keine Cloud-Sync, keine Teamfreigaben.

## BestPay Vertriebs-Wizard (B01)

Unter **Vertriebsprozess** (`/sales/wizard`) orchestriert die App den vollständigen Vertriebsablauf. Der Einstieg erfolgt über den Hauptnavigationseintrag **Vertriebsprozess** oder über den Vertriebsarbeitsplatz (`/sales`) mit **Neuen Vertriebsfall starten**. Die Legacy-Route `/calculator/wizard` leitet auf `/sales/wizard` um.

### Schritte

1. Interessent (bestehender Lead / neuer Interessent / ohne Lead)
2. Aktuelle Kosten (Billing-/OCR-Pipeline oder manuell)
3. Bedarf
4. Variantenvergleich (beliebige Szenarien)
5. Angebot (vorhandene Angebotsengine)
6. Freigabe (Pricing-Approval-Metadaten; Auto-Skip wenn nicht nötig)
7. Abschluss

### Architektur

- Orchestrierung über `SalesWizardService` auf derselben `BestPayComparisonSession` (Schema v3)
- Keine zweite Persistenz, keine zweite OCR-/Billing-/Pricing-/Recommendation-/Commission-Engine
- Autosave bei jeder Service-Änderung; Resume über `?session=` oder aktiven Wizard-Entwurf
- Desktop: linke Fortschrittsnavigation; mobil: horizontale Schrittleiste

### Hub-Einstiege (Rechner)

- Neue Berechnung
- Abrechnung einlesen
- Manuell eingeben
- Gespeicherte Berechnungen (Historie A11.5)
- Unaufdringlicher Hinweis zum Vertriebsprozess

## Vertriebsarbeitsplatz (B02)

Unter **Vertrieb** (`/sales`) liegt der tägliche operative Arbeitsplatz.

### Zweck

Handlungsorientierte Übersicht über Pipeline, Aufgaben/Wiedervorlagen, Aktivitäten und erwartete Abschlüsse – verbunden mit Lead, Wizard, Berechnung, Angebot, Freigabe und Provision.

### Pipelinephasen

Neu → Kontakt → Abrechnung → Berechnung → Angebot → Freigabe → Nachfassen → Angenommen → Aktivierung → Abgerechnet → Gewonnen / Verloren

Die Ableitung erfolgt deterministisch aus Lead-, Session-, Offer-, Aktivitäts-, Aufgaben- und Provisionsdaten. Der bestehende Offerstatus (`draft` / `completed` / `cancelled`) wird nicht überschrieben. Spätere Stufen nutzen u. a. Commission-Case-Status und dokumentierte Aktivitäten (z. B. Angebot versendet).

Vorgänge ohne Lead erscheinen unter **Noch nicht zugeordnet**.

### Aufgaben und Wiedervorlagen

- Domain `SalesTask` (versionierter Store)
- Typen u. a. Rückruf, Abrechnung, Berechnung fortsetzen, Freigabe, Nachfassen, Aktivierung, Provision
- Status: offen / in Bearbeitung / erledigt / abgebrochen
- Priorität: normal / hoch / dringend
- Wiedervorlagen = Aufgaben mit Fälligkeit
- Automatische Aufgaben (idempotent über `sourceKey`), z. B. Wizard-Entwurf → „Berechnung fortsetzen“
- Erledigung erzeugt genau eine Systemaktivität

### Aktivitäten und Notizen

- Domain `SalesActivity` (versionierter Store)
- Manuell: Notiz, Telefonat, E-Mail, Termin (intern, nicht in Kundendokumente)
- Systemaktivitäten: nicht editierbar/löschbar, idempotent, nicht bei bloßem Lesen
- Timeline im Arbeitsplatz und kompakt im Lead-Detail

### Dashboard

Kennzahlen (überfällig, heute, offene Leads/Wizards/Berechnungen, Freigaben, Nachfassen, erwartete Abschlüsse), Listen Heute / Offene Vorgänge / Erwartete Abschlüsse, Suche und Scope **Meine Vorgänge** (Team nur Admin).

### Rechte

- Außendienst: primär eigene Vorgänge/Aufgaben
- Admin: Teamansicht
- Provision nur gemäß bestehendem Recht sichtbar
- Service-seitige Sichtbarkeitsprüfung

### Persistenz / Datenschutz

- Lokale Stores `salesTasks` / `salesActivities` mit Schema- und Storage-Version
- Migration + Isolation beschädigter Einträge
- Keine Originaldokumente, keine OCR-Rohdaten, keine zweite Lead-/Offer-/Session-Wahrheit
- Spätere Serverpersistenz über Repository-Interfaces vorbereitet

### Bekannte Grenzen / Abgrenzung B04

- Kein E-Mail-Versand, keine externe Signaturplattform, keine BestPay-Aktivierungs-API
- Keine Cloud-Synchronisation, kein vollständiges DMS
- B04: Administration und Produktivbetrieb

## OCR-Produktionsreife: Bundle-Splitting und Asset-Verifikation (A11.3)

A11.3 bereitet die A11.2-OCR technisch für Produktion vor, ohne fachliche Logik zu verändern.

### Lazy Loading

- Der normale CRM-Start lädt **keinen Tesseract-Stack**
- `LazyBrowserOcrExtractionProvider` lädt OCR-Module erst beim ersten OCR-Aufruf
- `OfferBillingImportSection` wird per `React.lazy()` geladen
- PDF.js und PDF-Textprovider werden erst bei PDF-Verarbeitung dynamisch importiert
- Getrennte Chunks: `ocr-tesseract`, `billing-ocr-feature`, `pdf-processing`

### Same-Origin OCR-Assets

OCR-Assets liegen unter `public/ocr/` und werden vor Build kopiert:

- Worker: `ocr/worker/worker.min.js`
- Core/WASM: `ocr/core/tesseract-core-lstm.wasm(.js)`
- Sprachen: `ocr/lang/deu.traineddata.gz`, `ocr/lang/eng.traineddata.gz`

Quellen: `tesseract.js`, `tesseract.js-core`, `@tesseract.js-data/deu`, `@tesseract.js-data/eng`.

Die Dateien unter `public/ocr/` werden **nicht versioniert** (`.gitignore`). `predev` / `prebuild` bzw. `npm run copy:ocr-assets` erzeugen sie reproduzierbar aus `node_modules`.

`resolveBillingOcrAssetPaths()` setzt explizite Pfade – **keine jsDelivr-/CDN-Fallbacks** im produktiven Betrieb.

### Build-Verifikation

```bash
npm run build
npm run verify:ocr-build
```

Das Skript prüft: Hauptentry ohne Tesseract, OCR-Lazy-Chunks vorhanden, `dist/ocr`-Assets vorhanden, keine aktiven CDN-Pfade in Anwendungs-Chunks.

### Offline und PWA

- Same Origin ≠ garantiert offline
- PWA cached OCR-Assets per Runtime-Cache unter `/ocr/` (große Sprachdateien nicht im Precache)
- Nach erstem erfolgreichen Laden grundsätzlich offline nutzbar, abhängig vom Browser-/SW-Cache

### Abort-Stabilisierung

- Zentrale Helfer in `src/utils/abort.ts`
- Nutzerabbruch ist kontrollierter Zustand (`BILLING_OCR_ABORTED`), kein Systemfehler
- Tests: Request-Polyfill verhindert React-Router-/AbortSignal-Inkompatibilitäten in Vitest

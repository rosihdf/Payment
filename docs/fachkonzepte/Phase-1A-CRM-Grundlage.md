# Fachkonzept Phase 1A – CRM-Grundlage

**Status:** Umgesetzt (Produktionsabschluss Phase 1A)  
**Version:** 1.1 / Phase 1A  
**Stand:** 2026-08-02  
**Art:** Fachkonzept + Ist-Stand der Umsetzung (keine zweite CRM-Welt)  

**Verbindliche Grundlagen:**

- [`docs/AMRtech-Payment-Produktleitlinien.md`](../AMRtech-Payment-Produktleitlinien.md)
- Roadmap 1.1 (Phase 1: CRM)
- Gold Master `v1.0.0`

**Leitprinzip:** Keine zweite CRM-Welt. Alles bleibt in der bestehenden Kundenakte (`/leads/:id`). Bestehende Entitäten (`Lead`, `SalesActivity`, `SalesTask`, Dokument-Metadaten, Offer/Contract/Activation-Verknüpfungen) werden erweitert, nicht dupliziert.

---

## 0. Abgrenzung Phase 1A

| In Scope 1A | Explizit nicht in 1A |
|-------------|----------------------|
| Kundenakte als Hub finalisieren | Kundenportal (Phase 4) |
| Mehrere Ansprechpartner | Digitale Angebotsannahme / BestPay-Handoff-Kanal (Phase 2) |
| Aktivitäten manuell erfassen + Timeline | Dashboards / Forecast (Phase 3) |
| Aufgaben in der Akte pflegen | Mailversand / Mailintegration |
| Kommunikation nur dokumentieren | Eigener Vertragsgenerator |
| Dokumente in der Akte bündeln (Metadaten) | Neue Navigation „CRM“ als Parallelwelt |
| Interne Notizen | Offline / Push / Mobile-Sonderfeatures |
| Besuchsberichte als Aktivitätstyp | Provision neu berechnen (nur Anzeige/Verweis) |

---

## 1. Ziel

### Warum?

Der interne BestPay-Vertrieb der AMRtech UG braucht in der Kundenakte einen vollständigen Beziehungskontext: mehrere Ansprechpartner, nachvollziehbare Aktivitäten, Aufgaben, Besuche, dokumentierte Kommunikation und Notizen. Heute ist die Kundenakte vor allem eine **Lesesicht** auf Lead + Pipeline-Objekte; Erfassung von Kontakten/Aktivitäten/Aufgaben ist unvollständig oder außerhalb der Akte fragmentiert.

### Welches Problem?

- Ein Ansprechpartner auf dem Lead reicht für reale Betriebe nicht.
- Telefon, Mail, Besuch und Beratung werden nicht zuverlässig in einer Timeline geführt.
- Aufgaben sind oft nur sichtbar, nicht in der Akte pflegbar.
- Ohne zentrale Dokumentation entstehen Excel-Nebenwelten und Doppelpflege.

### Nutzen

| Rolle | Nutzen |
|-------|--------|
| **Außendienst** | Eine Akte für alles Relevante vor/nach dem Kundentermin; weniger Hilfsmittel; klare Wiedervorlagen und Kontaktdaten. |
| **Administration** | Nachvollziehbarkeit bei Übergaben, Vertretung und Qualitätskontrolle; gleiche Datenbasis wie der Außendienst. |
| **Kunde** | Indirekt: bessere Vorbereitung, weniger doppelte Rückfragen, konsistente Ansprechpartnerpflege – kein Kundenportal in 1A. |

**Nutzenprüfung (Leitlinien):** Erkennbarer Nutzen für Außendienst und Administration; Arbeit vereinfachen (eine Oberfläche, keine Doppelpflege).

---

## 2. Seiten

### Neue Seiten

| Seite | Pfad (Vorschlag) | Zweck |
|-------|------------------|--------|
| Keine eigenständige CRM-App | — | Verboten laut Leitlinien |
| Optional: Ansprechpartner-Dialog | Modal/Drawer in `/leads/:id` | Keine eigene Route nötig |
| Optional: Aktivitäts-/Aufgaben-Dialog | Modal/Drawer in `/leads/:id` | Keine eigene Route nötig |

Phase 1A führt **keine** neuen Hauptmenü-Routen für ein Parallel-CRM ein.

### Bestehende Seiten – Erweiterung

| Seite | Änderung |
|-------|----------|
| **Kundenakte** `/leads/:id` (`LeadDetailPage`) | Tab-Struktur finalisieren; Erfassen von Ansprechpartnern, Aktivitäten, Aufgaben, Notizen; Timeline mit Filter; Dokumente/Kommunikation; Verweise auf Angebot/Vertrag/Aktivierung/Provision |
| **Lead bearbeiten** `/leads/:id/edit` | Stammdaten bleiben hier; Primärkontakt-Sync mit Standard-Ansprechpartner (eine Wahrheit, siehe Kap. 4) |
| **Lead neu** `/leads/new` | Optional: ersten Ansprechpartner aus Kontaktfeldern anlegen (gleiche Daten, kein Zweitformular-Zwang) |
| **Arbeitsplatz** `/sales` | Unverändert als Einstieg; Links „Zur Kundenakte“ bleiben; keine zweite Task-Welt |
| **Angebot / Vertrag / Aktivierung** | Unverändert fachlich; Backlink „Zur Kundenakte“ bleibt; keine CRM-Duplikate |

### Navigation

| Bereich | Änderung 1A |
|---------|-------------|
| Sidebar „Kunden“ → `/leads` | Bleibt der Einstieg zur Kundenliste / Akte |
| Kein neuer Menüpunkt „CRM“ | Explizit verboten |
| Kundenakte-Tabs | Interne Navigation der Akte (siehe Kap. 3) |
| Deep-Links aus Offer/Contract/Activation | Bleiben |

---

## 3. Kundenakte – endgültige Struktur

**Eine Akte = ein Lead/Kunde** (`Lead` bleibt Anker-Entität).

### Tab-Reihenfolge (verbindlich für 1A)

| # | Tab | Inhalt |
|---|-----|--------|
| 1 | **Übersicht** | Stammdaten-Kurzinfo, Standardkontakt, Stand im Prozess (bestehendes `CustomerStand`/`CustomerPrimaryAction`), nächste Aufgabe, letzte 5 Timeline-Einträge, Schnellaktionen |
| 2 | **Ansprechpartner** | Liste aller Kontakte, Anlegen/Bearbeiten, Standardkontakt markieren |
| 3 | **Timeline** | Chronologische Aktivitäten inkl. Filter (Kommunikation, Besuche, System, …) |
| 4 | **Aufgaben** | Offene/erledigte Aufgaben zum Lead; Anlegen, Status ändern, Abschließen |
| 5 | **Notizen** | Interne Notizen (nicht kundenexponiert); getrennt von Timeline-Systemevents |
| 6 | **Dokumente** | Gebündelte Dokument-Metadaten zu Angeboten/Verträgen/Aktivierungen dieses Leads |
| 7 | **Beratung** | Bestehende Vergleichs-/Beratungssessions (1.0) – nur Verweis/Liste |
| 8 | **Angebote** | Liste/aktuelles Angebot – Verweis auf `/offers/:id` |
| 9 | **Verträge** | Interne Vertrags-/Statusobjekte nach Prozess – Verweis; kein Generator |
| 10 | **Aktivierungen** | Onboarding-Fälle – Verweis |
| 11 | **Provision** | Read-only Verweis/Status falls vorhanden; Detail weiter `/sales/commission` bzw. Admin |

### Mapping Bestand → Ziel

| Heute (1.0) | Ziel 1A |
|-------------|---------|
| Tabs: Übersicht, Beratung, Angebot, Vertrag, Aktivierung, Dokumente, Aufgaben & Verlauf | Aufspaltung: Timeline / Aufgaben / Notizen getrennt; Ansprechpartner neu; Provision-Tab als Verweis |
| Ein Kontakt auf Lead | Mehrere `Contact` + Standardkontakt spiegelt Lead-Kontaktfelder |
| Timeline max. 30, read-only | Timeline mit Filter + manuelle Erfassung |
| Tasks nur Anzeige | Tasks in Akte pflegbar |
| `Lead.notes` im Formular | Zusätzlich strukturierte interne Notizen; Lead.notes bleibt Kurzfeld Stammdaten oder wird als erste Notiz migriert (Entscheidung bei Umsetzung, eine Wahrheit) |

### Inhalte Übersicht (Kurz)

- Firma, Adresse, Branche, Status, Zuständigkeit (`assignedSalesUserId`)
- Standard-Ansprechpartner (Name, Telefon, Mail, Mobil)
- Prozessstand + primäre nächste Aktion (bestehende Ableitung)
- Offene Aufgaben-Anzahl + nächste Fälligkeit
- Letzte Aktivitäten
- Schnellaktionen: Anruf dokumentieren, Besuch dokumentieren, Aufgabe anlegen, Notiz

---

## 4. Ansprechpartner

### Regeln

- **Mehrere Ansprechpartner** pro Lead/Kunde: ja
- Genau **ein Standardkontakt** (`isPrimary = true`) pro Lead
- Der Standardkontakt ist die **eine Wahrheit** für die Kontaktfelder auf `Lead` (`contactFirstName`, `contactLastName`, `phone`, `email`) – Sync beim Setzen/Ändern des Primärkontakts (Richtung: Contact → Lead-Felder)
- Kein zweites paralleles Kontaktmodell außerhalb der Akte

### Daten (fachlich)

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| `id` | ja | |
| `leadId` | ja | Anker |
| `firstName` | ja | |
| `lastName` | ja | |
| `role` / Funktion | nein | z. B. Inhaber, Buchhaltung, IT, Filialleitung (Freitext + optionale Vorschlagswerte) |
| `email` | nein | |
| `phone` | nein | Festnetz |
| `mobile` | nein | Mobil |
| `notes` | nein | Kurznotiz zum Kontakt |
| `isPrimary` | ja | Standardkontakt |
| `isActive` | ja | Inaktive ausblenden, nicht löschen als Default |
| `createdAt` / `updatedAt` | ja | |
| `createdByUserId` | ja | |

### Rollen (Beispiele, nicht starr)

Inhaber · Geschäftsführung · Buchhaltung · Einkauf · IT · Filiale · Sonstiges (Freitext)

### UI-Verhalten

- Liste aktiv/inaktiv filterbar (Default: nur aktive)
- Primär setzen: bestätigt Wechsel, aktualisiert Lead-Kontaktfelder
- Löschen: nur wenn nicht Primär **oder** nach Umsetzen des Primärstatus; Soft-Deaktivierung bevorzugt

---

## 5. Aktivitäten

### Wahrheit

**Timeline = `SalesActivity`-Feed.** Keine zweite Activity-Historie.

### Aktivitätstypen Phase 1A

| Typ (fachlich) | Technische Zuordnung | Manuell erfassbar | Quelle |
|----------------|----------------------|-------------------|--------|
| Telefon | `call` (bestehend) | ja | User |
| Mail | `email` (bestehend) | ja | User (nur Doku, kein Versand) |
| Besuch | `visit` **neu** oder Mapping auf erweitertes `meeting` | ja | User – **Entscheidung:** neuer Typ `visit` (Besuchsbericht), `meeting` bleibt für sonstige Termine |
| Beratung | bestehend system/wizard-Typen + manuell optional `note` mit Kontext | vorwiegend System | Wizard/Leitfaden |
| Angebot | bestehende Offer-Events | System | OfferWorkflow |
| Freigabe | bestehende Approval-Events | System | Approval |
| Vertrag | bestehende Contract-Events | System | Contract-Services |
| Aktivierung | bestehende Activation-Events | System | Activation |
| Provision | bestehende Commission-Events | System | Commission |
| System | `isSystem` / diverse | nein | Services |
| Interne Notiz (kurz) | `note` | ja | User – längere Notizen siehe Kap. Notizen-Tab |

**Festlegung Fachkonzept:** Aktivitätstyp **`visit`** (Besuchsbericht) wird neu eingeführt. `meeting` bleibt für allgemeine Termine ohne Besuchscharakter.

### Felder Aktivität (fachlich)

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| `type` | ja | siehe oben |
| `title` | ja | Kurz |
| `description` | nein | Freitext / Besuchsbericht |
| `occurredAt` | ja | Wann passiert |
| `leadId` | ja (in Akte) | |
| `contactId` | nein | Verknüpfung Ansprechpartner |
| `offerId` / `contractId` / `activationId` / `taskId` | nein | bestehende FKs |
| `createdByUserId` | ja | |
| `isSystem` | ja | |
| `editable` | ja | System i. d. R. nicht editierbar |
| `sourceKey` | bei System | Dedup wie 1.0 |

### Besuchsbericht (Mindestinhalt in `description` oder strukturierte Zusatzfelder)

- Anlass / Ergebnis (Freitext)
- Optional: nächster Schritt (kann Task erzeugen – optional, nicht Pflicht)
- Optional: `contactId`

Keine Pflicht-Checklisten-Monster – Einfachheit vor Funktionsvielfalt.

---

## 6. Aufgaben

### Wahrheit

**Aufgaben = `SalesTask`.** Keine zweite Task-Liste. Eine aktive Follow-up-Regel pro Angebot bleibt wie in 1.0 (`sourceKey` / Dedup) – 1A ändert diese Regel nicht fachlich aufweichend.

### Typen (fachlich, auf bestehende `SalesTaskType` mappen)

| Fachlich | Mapping / Nutzung |
|----------|-------------------|
| Telefon | `callback` |
| Mail | `general` oder bestehender passender Typ; Label UI „Mail“ |
| Besuch | `general` mit UI-Label „Besuch“ **oder** neuer Typ `visit` – **Empfehlung:** neuer Task-Typ `visit` nur wenn klar getrennt nötig, sonst `general` + Titel |
| Nachfassen | `follow_up_offer` (angebotbezogen) / `callback` |
| Freigabe | `review_approval` (i. d. R. System) |
| Aktivierung | `check_activation` / handover-Typen (System) |
| Sonstiges | `general` |

Bestehende automatische Typen bleiben erhalten und erscheinen in der Akte.

### Status / Priorität / Fälligkeit / Verantwortlicher

| Attribut | Werte (1.0 beibehalten) |
|----------|-------------------------|
| Status | `open`, `in_progress`, `done`, `cancelled` |
| Priorität | `normal`, `high`, `urgent` |
| Fälligkeit | `dueAt` (+ optional lokale Zeit wie bestehend) |
| Verantwortlicher | `assigneeUserId` |
| Abschluss | `completedAt`, `completedByUserId`, `completionNote` |

### Regeln in der Akte

- Anlegen manueller Aufgaben mit `leadId` (und optional Offer/Contact)
- Statuswechsel und Abschließen in der Akte
- Filter: offen / erledigt / meine / alle zum Lead
- Keine parallele „Wiedervorlagen“-Entität – Wiedervorlage = Aufgabe mit Fälligkeit

---

## 7. Timeline

### Darstellung

- Chronologisch absteigend (`occurredAt`, dann `createdAt`)
- Einträge = Aktivitäten (manuell + System)
- Erledigte Aufgaben erscheinen **nicht** doppelt als eigene Timeline-Spur, außer es gibt bereits ein Activity-Event dazu (1.0-Verhalten beibehalten; keine zweite Wahrheit)

### Filter (1A)

| Filter | Werte |
|--------|--------|
| Typ-Gruppe | Kommunikation (`call`, `email`) · Besuch (`visit`) · Notiz · Prozess (Angebot/Freigabe/Vertrag/Aktivierung/Provision) · System · Alle |
| Zeitraum | von–bis |
| Suche | Titel/Beschreibung (Text) |
| Nur manuell / nur System | optional Toggle |

### Verknüpfungen

- Klick auf verknüpftes Angebot/Vertrag/Aktivierung/Aufgabe → bestehende Detailroute
- Anzeige Ansprechpartner-Name wenn `contactId` gesetzt

### Performance / Einfachheit

- Initiale Seite z. B. 50 Einträge, „Mehr laden“
- Kein separates Timeline-Produkt neben Activities

---

## 8. Dokumente

### Wahrheit

Bestehende Dokument-Metadaten (`SalesDocument`, `OfferDocument`, …) – **keine** zweite Dokumentenablage. Keine Binärdaten-Pflicht in LocalStorage (1.0-Regel bleibt).

### In der Kundenakte gebündelt nach Lead

Aggregation über alle Angebote/Verträge/Aktivierungen des Leads (wie heute angelegt, ggf. vervollständigen).

### Dokumenttypen (fachlich, Anzeige)

| Typ | Quelle |
|-----|--------|
| Angebots-PDF / Angebotsdokument | Offer-Dokumente |
| Vertragsbezogene Dokumente | Contract-Dokumentmetadaten (Statusnachweis, keine Generator-UI in 1A) |
| Aktivierungs-/Onboarding-Dokumente | Activation |
| Bilder / sonstige Dateien | Metadaten sofern Typ existiert |
| Notizen als Datei | nur wenn bereits als Dokument registriert – sonst Notizen-Tab |

### 1A-Leistung

- Liste in der Akte mit Typ, Dateiname, Bezug (Angebot/Vertrag/…), Datum, Ersteller
- Deep-Link zur bestehenden Dokumentansicht
- **Kein** Upload-Monster / kein neues DMS – Upload nur soweit 1.0-Mechanismen bereits existieren und lead-zuordenbar gemacht werden

---

## 9. Kommunikation

### Prinzip

**Keine Mailintegration. Kein Telefonie-Provider. Nur Dokumentation.**

| Kanal | Erfassung |
|-------|-----------|
| Telefon | Aktivität `call` – wer, wann, Kurzinhalt, optional Ansprechpartner |
| E-Mail | Aktivität `email` – Betreff/Inhalt stichwortartig, Richtung (eingehend/ausgehend) als Text oder Kennzeichen im Description-Schema |
| Persönlich / Besuch | `visit` |
| Sonstige Absprache | `note` oder `meeting` |

### Nicht in 1A

- SMTP/IMAP
- Versand aus der App
- Automatischer Mail-Import
- Chat-Produkt parallel zur Timeline

Kommunikation **ist** die gefilterte Timeline-Gruppe „Kommunikation“.

---

## 10. Rollen

Rollen 1.0: `admin`, `field_service`.

| Aktion | Außendienst (`field_service`) | Administrator (`admin`) |
|--------|-------------------------------|-------------------------|
| Kundenakte sehen | Eigene / zugewiesene Leads (bestehende Sichtbarkeitsregeln beibehalten bzw. klar dokumentieren bei Umsetzung) | Alle |
| Stammdaten bearbeiten | ja (im Rahmen bestehender Rechte) | ja |
| Ansprechpartner anlegen/bearbeiten | ja | ja |
| Ansprechpartner deaktivieren | ja | ja |
| Primärkontakt setzen | ja | ja |
| Aktivitäten manuell anlegen/bearbeiten (eigene editierbare) | ja | ja |
| System-Aktivitäten löschen | nein | nein (Audit) |
| Manuelle Aktivitäten löschen/korrigieren | eigene, wenn `editable` | ja wenn `editable` |
| Aufgaben anlegen | ja | ja |
| Aufgaben bearbeiten / abschließen | zugewiesen oder eigene Anlage; Admin alle | ja |
| Aufgaben löschen/stornieren | `cancelled` statt Hard-Delete bevorzugt | ja |
| Interne Notizen | ja | ja |
| Dokumente sehen | ja (Metadaten) | ja |
| Provision in Akte | lesen | lesen |

**Kunde (Portalrolle):** nicht in 1A. Interne Notizen niemals kundenexponiert (Vorbereitung Phase 4).

---

## 11. Datenmodell (fachlich, keine Migration)

### Bestehende Entitäten (weiterführen)

```
Lead 1──* Offer
Lead 1──* Contract
Lead 1──* ActivationCase
Lead 1──* SalesActivity
Lead 1──* SalesTask
Offer / Contract / Activation ──o SalesDocument (Metadaten)
```

### Neu / zu erweitern (fachlich)

```
Lead 1──* Contact
Contact.isPrimary ──sync──> Lead.contact*
SalesActivity.contactId? → Contact
SalesActivity.type += visit
SalesTask: Nutzung in Akte (ggf. type-Erweiterung nur wenn nötig)
InternalNote (optional eigene Entität) ODER SalesActivity note + Tab-Filter
```

### Empfehlung InternalNote

**Variante A (bevorzugt, eine Wahrheit):** Interne Notizen = `SalesActivity` mit `type = note` und Kennzeichen `visibility = internal` (neues Feld) bzw. Konvention „immer internal“. Tab „Notizen“ filtert diese Activities.  
**Variante B:** Eigene Tabelle `internal_notes (id, leadId, body, createdBy, timestamps)` – nur wenn Notizen klar von Timeline-Darstellung getrennt werden müssen.

**Fachentscheid für Freigabe:** Variante A, sofern UI den Notizen-Tab klar hält und System-Events nicht vermischt.

### Contact (fachliche Tabelle)

`contacts`: Felder aus Kap. 4; FK `lead_id`; Unique-Constraint: genau ein `is_primary` pro Lead (partiell).

### Keine neuen Wahrheiten für

- Pipeline-Phase (bleibt Ableitung)
- Offer/Contract/Activation-Status (bleiben Domänenservices)
- Provision (bleibt Commission-Domäne)

---

## 12. Workflows

### 12.1 Lead → Kundenakte nutzen

1. Lead existiert (Liste `/leads` oder Neuanlage).  
2. Öffnen `/leads/:id`.  
3. Übersicht zeigt Stand + nächste Aktion.  
4. Außendienst arbeitet in Tabs der **gleichen** Akte.

### 12.2 Ansprechpartner pflegen

1. Tab Ansprechpartner → Neu.  
2. Daten speichern (`isActive=true`).  
3. Optional „Als Standard“ → Lead-Kontaktfelder aktualisieren.  
4. Inaktiv setzen statt löschen, wenn Historie/Bezug existiert.

### 12.3 Telefon / Mail dokumentieren

1. Schnellaktion oder Timeline → Aktivitätstyp wählen.  
2. Zeitpunkt, Kurztext, optional Kontakt.  
3. Speichern → sofort in Timeline.  
4. Optional: Aufgabe „Nachfassen“ mit Fälligkeit erzeugen (ein Klick, kein Zwang).

### 12.4 Besuch dokumentieren

1. Aktivität `visit`.  
2. Besuchsberichtstext, optional Kontakt.  
3. Speichern.  
4. Optional Aufgabe für nächsten Schritt.

### 12.5 Aufgabe

1. Tab Aufgaben → Neu (Typ, Priorität, Fälligkeit, Assignee, Bezug).  
2. Bearbeiten / In Arbeit / Erledigt (+ Abschlussnotiz).  
3. Storno = `cancelled`.  
4. Automatische Tasks aus 1.0 bleiben; Dedup/`sourceKey` unverändert.

### 12.6 Dokumente einsehen

1. Tab Dokumente → Liste aus verknüpften Domänen.  
2. Öffnen über bestehende Dokumentroute.  
3. Kein paralleles Hochladen „ins CRM“.

### 12.7 Übergang in den Vertriebsprozess

1. Primäre Aktion aus Übersicht (bestehend: Beratung/Angebot/…).  
2. Nach Rückkehr erscheinen System-Activities in der Timeline.  
3. Kein zweiter Prozess – Kapitel 4 Produktleitlinien.

---

## 13. UI (nur Aufbau, kein Design)

### Kundenakte-Shell

```
[ Kopf: Firmenname | Status | Zuständig | Zurück zu Kunden ]
[ Prozessstand + Primäraktion ]
[ Tab-Leiste: Übersicht | Ansprechpartner | Timeline | Aufgaben | Notizen |
  Dokumente | Beratung | Angebote | Verträge | Aktivierungen | Provision ]
[ Tab-Inhalt ]
```

### Übersicht

```
[ Stammdaten-Kachel ] [ Standardkontakt ] [ Nächste Aufgabe ]
[ Schnellaktionen: Telefon | Besuch | Aufgabe | Notiz ]
[ Letzte Aktivitäten (5) → Link Timeline ]
```

### Ansprechpartner

```
[ Filter aktiv ] [ Neu ]
[ Liste: Name | Rolle | Telefon | Mobil | Mail | Primär | Aktionen ]
```

### Timeline

```
[ Filter Typ | Zeitraum | Suche ]
[ Liste chronologisch: Icon Typ | Titel | Zeit | User | Verknüpfung ]
[ Mehr laden ]
```

### Aufgaben

```
[ Filter Status | Meine ] [ Neu ]
[ Liste: Titel | Typ | Prio | Fällig | Assignee | Status | Aktionen ]
```

### Dialoge

Ein Dialogsystem (Leitlinien): einheitliche Modals für Contact / Activity / Task / Note – keine Sonder-UI-Inseln.

Mobile zuerst: Tabs horizontal scrollbar; Schnellaktionen erreichbar ohne Desktop-only-Muster.

---

## 14. Tests (fachlich, später umzusetzen)

| ID | Fachlicher Test |
|----|-----------------|
| T1 | Mehrere Ansprechpartner pro Lead speicherbar |
| T2 | Genau ein Primärkontakt; Sync auf Lead-Kontaktfelder |
| T3 | Inaktiver Kontakt nicht als Primär setzbar ohne Reaktivierung |
| T4 | Manuelle Activities `call`, `email`, `visit`, `note` erscheinen in Timeline |
| T5 | System-Activities unverändert dedupliziert (`sourceKey`) |
| T6 | Timeline-Filter Typ/Zeitraum/Suche liefert erwartete Teilmenge |
| T7 | Aufgabe anlegen/status/abschließen in Akte; sichtbar im Workspace falls Lead-bezogen |
| T8 | Keine zweite Task-Entität; Follow-up-Dedup pro Angebot bleibt |
| T9 | Dokumentliste aggregiert nur Metadaten des Leads |
| T10 | Keine Mail-API / kein Versand-Pfad |
| T11 | Interne Notizen nicht in kundenrelevanten Exporten (Vorbereitung) |
| T12 | field_service vs admin Rechte gemäß Kap. 10 |
| T13 | Keine neue Nav-Route „CRM“ |
| T14 | Regression: bestehende LeadDetail-Tabs Angebot/Vertrag/Aktivierung/Beratung |

---

## 15. Risiken

| Risiko | Stufe | Vermeidung zweiter Wahrheiten |
|--------|-------|-------------------------------|
| Zweite CRM-App / Nav | hoch | Nur `/leads/:id` erweitern |
| Kontaktfelder Lead vs Contact divergieren | hoch | Primärkontakt = Sync-Quelle für Lead-Felder |
| Timeline ≠ Activities | hoch | Eine Activity-Tabelle / ein Feed |
| Aufgaben doppelt (Workspace vs Akte) | mittel | Dieselbe `SalesTask`-Quelle |
| Notizen parallel zu `Lead.notes` | mittel | Variante A + Migrationsregel bei Umsetzung |
| Dokumente erneut ablegen | mittel | Nur Aggregation bestehender Metadaten |
| Scope-Creep Portal/Handoff | hoch | Klar in Kap. 0 ausgeschlossen |
| Besuch vs Meeting Verwechslung | niedrig | Typ `visit` fachlich getrennt |

---

## 16. Definition of Done (Phase 1A)

Ausgerichtet an Produktleitlinien Kap. 5 und 9:

- [x] Fachkonzept freigegeben (dieses Dokument)
- [x] Datenmodell freigegeben
- [x] UI-Aufbau freigegeben (Kap. 13)
- [x] Workflows freigegeben (Kap. 12)
- [x] Rollen geprüft (Kap. 10)
- [x] Tests definiert (Kap. 14)
- [x] Umsetzung fertig
- [x] Tests grün
- [x] Smoke-Test erfolgreich
- [x] Dokumentation aktualisiert
- [x] Commit
- [x] Deployment
- [ ] Fachliche Abnahme *(Product Owner)*

---

## 17. Ist-Stand Umsetzung (Phase 1A)

### Umgesetzt

| Bereich | Ist |
|---------|-----|
| **Kundenakte** | Einzige CRM-Zentrale unter `/leads/:id`; Tabs in freigegebener Reihenfolge; eine führende nächste Aktion; keine neue Nav/Route |
| **Datenmodell** | `Contact` (Domain + Local/Supabase-Repo); `SalesActivity` um CRM-/Prozess-Typen erweitert; `SalesTask` mit CRM-Typen; Notizen = Activity `type: note` |
| **Timeline** | Manuelle + automatische Einträge; stabile `sourceKey`-Dedup; Gruppierung Heute/Gestern/Diese Woche/Älter; Volltextsuche; Schnellaktionen |
| **Aufgaben** | Pflege in Kundenakte; Arbeitsplatz unverändert; keine globale Aufgabenseite |
| **Dokumente** | Metadaten-Aggregation nach Typ (Angebote/Verträge/Aktivierungen/Sonstige); kein Upload/DMS |
| **Wizard** | Kundenschritt vereinfacht (Suche + Weiter / Minimalanlage / ohne Kunde); zentrale Anzeigenamen via `getLeadDisplayName` |
| **Migration** | `supabase/migrations/20260802160000_lead_contacts.sql` – additiv, RLS, ein aktiver Primärkontakt je Lead |
| **Tests** | `phase1aCrmBlock1/2/3` (+ UI), Display-Name- und Wizard-Prospect-Tests |

### Nicht in 1A (unverändert ausgeschlossen)

Zweite CRM-Welt, neue Navigation, Upload-DMS, Mailintegration, Provision-/Angebots-/Freigabelogik-Umbau, Kundenportal.

---

## Anhang – Leitlinien-Check (Cursor / Composer)

| Prüfung | Ergebnis |
|---------|----------|
| Passt zur Produktvision? | Ja – internes BestPay-Vertriebs-CRM |
| Zweiter Workflow? | Nein – unterstützt Lead→…→Provision |
| Zweite Datenquelle? | Nein – Contact neu, Activities/Tasks erweitert |
| Doppelte Pflege? | Primärkontakt-Sync verhindert Drift |
| Goldene Regeln? | Ein Prozess, eine Akte, eine Bedienlogik |
| Nutzen Kunde/AD/Admin? | Ja (Kunde indirekt) |
| Arbeit vereinfachen? | Ja – eine Akte statt Hilfsmittel |

---

## Freigabe

| Feld | Wert |
|------|------|
| Dokument | `docs/fachkonzepte/Phase-1A-CRM-Grundlage.md` |
| PO-Freigabe Implementierung | erteilt (Umsetzung Blocks 1–4) |
| Fachliche Abnahme | ausstehend |
| Nächster Schritt | Fachliche Abnahme; danach Phase 1 Rest / Phase 2 laut Roadmap |

---

*Ende Fachkonzept Phase 1A – CRM-Grundlage.*

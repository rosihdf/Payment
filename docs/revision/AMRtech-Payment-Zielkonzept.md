# AMRtech Payment – Zielkonzept

**Stand:** August 2026  
**Status:** Konzept (noch nicht implementiert)

---

## 1. Leitbild

Eine **verkaufsnahe, mobile-first Vertriebs-PWA** auf unveränderter technischer Basis:

- Ein Beratungsweg, ein Navigationsmodell, ein UI-System
- Jedes fachliche Datum hat **genau eine führende Quelle**
- Backend (Supabase, Engines, RLS) bleibt; Frontend und Workflow werden **kontrolliert neu gebaut**

---

## 2. Strategische Entscheidung

### Variantenbewertung

| Kriterium | A: Weiter reparieren | B: Frontend-Neubau (empfohlen) | C: Komplettneubau |
|-----------|---------------------|--------------------------------|-------------------|
| Risiko weiterer Regressionen | Hoch | Mittel | Hoch (Migration) |
| Aufwand | Scheinbar gering, kumuliert hoch | 8–12 Wochen strukturiert | 6+ Monate |
| Backend-Wiederverwendung | 100 % | 95 % | 30–50 % |
| Testbarkeit | Schlecht (Monolithen) | Gut (Schichten) | Gut |
| Parallelbetrieb möglich | Ja (instabil) | Ja (Feature-Flags) | Nein |
| Altlasten | Akkumulieren | Werden entfernt | Verschwinden |
| **Empfehlung** | ❌ | ✅ **Variante B** | ❌ |

**Entscheidung: Variante B** – kontrollierter Frontend- und Workflow-Neubau im bestehenden Repository, Domain/Services/Repositories bleiben.

---

## 3. Ziel-Navigation

### Hauptnavigation (5 Punkte, unverändert in Struktur)

| Punkt | Route | Beschreibung |
|-------|-------|--------------|
| Arbeitsplatz | `/sales` | Tagesplan, offene Fälle, Hauptaktionen |
| Kunden | `/leads` | Suche, Liste, Einstieg Kundenakte |
| Beratung | `/advice` | Hub + Wizard (ein Flow) |
| Verwaltung | `/admin` | Admin-Bereich (nur mit Berechtigung) |
| Profil | `/profile` | Benutzer, App-Info, Update-Check (APK) |

**Keine zweite Navigation** für CRM, Provision oder Vertrieb.

### Kundenakte (Ziel: 6 Tabs)

| Tab | Inhalt |
|-----|--------|
| **Übersicht** | Gesamtstand, eine Hauptaktion, Kennzahlen |
| **Kontakte** | Ansprechpartner |
| **Vorgänge** | Timeline + Aufgaben + Notizen (ein Formular-Kontext) |
| **Beratung & Angebote** | Sessions, Angebote, Status |
| **Verträge & Aktivierung** | Verträge, Aktivierungen, Fortschritt |
| **Dokumente** | PDFs, Uploads |

Provision: Link in Übersicht oder dedizierter Admin-/Sales-Bereich, **kein leerer Tab**.

### Admin-Provision (Ziel: 5 statt 7 Seiten)

| Seite | Inhalt |
|-------|--------|
| Übersicht | KPIs, Schnellzugriff |
| Standardprovisionen | Regeln bearbeiten |
| Mitarbeiter & Vereinbarungen | Zuordnungen |
| Provisionsfälle | Fälle + Aktionen + Zahlungen (zusammengelegt) |
| Historie & Audit | Events (read-only) |

Entfallen als eigene Seiten: Sonderzahlungen (→ Modal in Fälle), Abrechnung & Zahlungen (→ Tab in Fälle), Overview-Duplikat-Tabelle.

---

## 4. Ziel-Beratungsworkflow

### Schritt 1 – Kunde

**Zweck:** Wer wird beraten?

| Modus | Pflicht | Optional |
|-------|---------|----------|
| Bestehenden Kunden suchen | Lead-Auswahl | — |
| Neuen Kunden anlegen | Firma **oder** Name | Telefon, E-Mail |
| Ohne Kunden rechnen | Moduswahl | — |

- Keine technische ID sichtbar
- Keine interne Zuordnung im UI
- Autosave: erst bei fachlicher Eingabe (Lead gewählt / Name eingegeben)

### Schritt 2 – Ausgangssituation

**Zweck:** Nur Ist-Zustand der Payment-Kosten

| Feld | Pflicht | Quelle |
|------|---------|--------|
| Erfassungsart (Modus) | Ja | `wizard.costCaptureMode` |
| Monatliche Ist-Gesamtkosten | Ja (manual/no_costs) | `manualInput.monthlyTotalCostsCents` |
| Monatlicher Kartenumsatz | **Nein in diesem Schritt** | — (nur via Billing-Baseline) |
| Abrechnung einlesen | Optional | `billingImportSessionId` → Baseline |

**Modi:**
- `manual` – Kosten manuell (0 € erlaubt)
- `billing_import` – OCR/Import optional
- `no_current_costs` – explizit 0 €, keine Payment-Lösung

**Kartenumsatz wird hier nicht abgefragt** (Verhinderung Doppelabfrage).

### Schritt 3 – Bedarf

**Zweck:** Nur zukünftiger Bedarf

| Feld | Pflicht | Anmerkung |
|------|---------|-----------|
| Monatlicher Kartenumsatz | Ja | **Einzige** Umsatz-Abfrage |
| Monatliche Transaktionen | Empfohlen | — |
| Branche | Optional | → auch Lead.industry |
| Terminalanzahl | Ja | — |
| Laufzeitpräferenz | Optional | Default 36 |
| Card-Mix (girocard/debit/credit/other) | Optional | Default 60/10/25/5 |
| Payment-Usage (stationary/mobile/ecommerce/softPos) | Optional | — |
| Einsatzort / Kassensystem / Zubehör | Optional (Phase 2+) | Lead-Felder |

**Keine Ist-Kostenerfassung** in diesem Schritt.

### Schritt 4 – Empfehlung

**Zweck:** Transparente Empfehlung, keine leeren Formulare

- **Automatische Berechnung** beim Betreten (Default-Szenario)
- **Eine führende Empfehlung** hervorgehoben
- Max. 3–5 Alternativen mit verständlicher Begründung
- Kein manuelles „Szenario anlegen“ als Pflicht
- Szenario-Duplikat nur als **Experten-Option** (Laufzeit/Terminal-Variante)
- Bei 0 € Ist-Kosten: „Kein Vergleich mit bisherigen Kosten möglich“

### Schritt 5 – Angebot

**Zweck:** Angebot erzeugen und Freigabe

- Ausgewählte Lösung + transparente Kosten
- Abweichungen und Freigabepflicht sichtbar
- **Eine Hauptaktion:** „Angebotsentwurf erzeugen“
- Freigabe als Unterflow (nicht eigener Wizard-Schritt)

### Schritt 6 – Prüfung und Nachfassen

**Zweck:** Kunde prüft, Vertrieb folgt nach

- Versand (PDF/E-Mail)
- **Genau eine Wiedervorlage**
- Rückfrage / Änderungswunsch (Kundenlink)
- Annahme
- Hinweis auf externen BestPay-Handoff

---

## 5. Schritt-Validierung (Ziel)

| Schritt | Blockiert wenn | Fehlermeldung (Beispiel) |
|---------|----------------|---------------------------|
| 1 Kunde | Kein Modus / kein Lead / kein Name | „Bitte Kunde wählen oder minimal erfassen“ |
| 2 Ausgangslage | Kein Modus | „Bitte wählen Sie, wie die aktuelle Situation erfasst werden soll“ |
| 2 manual | Kosten fehlen | „Bitte monatliche Ist-Kosten eingeben (0 € ist zulässig)“ |
| 2 import | Baseline nicht bestätigt | „Bitte Abrechnung prüfen und bestätigen“ |
| 3 Bedarf | Kein Umsatz | „Bitte monatlichen Kartenumsatz erfassen“ |
| 4 Empfehlung | Keine Variante gewählt | „Bitte eine Empfehlung auswählen“ |
| 5 Angebot | Kein Angebot | „Bitte Angebotsentwurf erzeugen“ |
| 6 Abschluss | — | Immer erlaubt |

---

## 6. Ziel-Architektur (Frontend)

```
src/
  app/                    ← Shell, Router, Provider (bestehend, erweitern)
  components/
    ui/                   ← NEU: Button, Dialog, StatusBadge, FormLayout
    data/                 ← ResponsiveTable, DataList (Cards)
    domain/               ← OfferSections, BillingImport (bestehend, migriert)
  features/
    advice/               ← NEU: Wizard (ersetzt calculator/)
    workspace/            ← SalesWorkspace (umbenennen/verschieben)
    crm/                  ← Lead, Kundenakte (aus lead/ extrahieren)
    offer/                ← Behalten
    admin/                ← Behalten, UI-System anwenden
  domain/                 ← UNVERÄNDERT (Engines, Typen)
  services/               ← UNVERÄNDERT (ggf. schlanke API für neues UI)
  repositories/           ← UNVERÄNDERT
  styles/
    tokens.css            ← Erweitert
    breakpoints.css       ← NEU
```

### Alt-/Neu-Trennung während Umbau

- Feature-Flag `VITE_ADVICE_V2=true` → neuer Wizard unter `/advice`
- Alte `SalesWizardPage` bleibt bis Phase 8 erreichbar unter `/advice/legacy` (intern)
- Nach Abnahme: Legacy entfernen

---

## 7. Datenfluss (Ziel)

```
Lead (CRM-SoT)
  ↕ Zuordnung
BestPayComparisonSession (Beratungs-SoT in-flight)
  → CustomerCostBaseline (Ist-Kosten aus Billing)
  → CustomerNeed (derived, nie direkt editiert)
  → RecommendationRecord
  → Offer + customerSnapshot (eingefroren)
  → Contract → Activation
  → CommissionCase
```

---

## 8. Fehler- und Erfolgskommunikation

| Situation | Verhalten |
|-----------|-----------|
| Validierung | Inline am Feld + Schritt-Zusammenfassung |
| Speichern fehlgeschlagen | Toast + Feldwerte bleiben |
| Speichern erfolgreich | Toast + Dialog schließen + Liste reload |
| Netzwerk/RLS | Deutsche Meldung, technisches Detail nur Console |
| Leerer Zustand | EmptyState mit einer Hauptaktion |

---

## 9. Offene PO-Entscheidungen

| # | Thema | Optionen |
|---|-------|----------|
| 1 | Kundenakte Tabs | 5 vs. 6 vs. 11 (Empfehlung: 6) |
| 2 | Szenario-Duplikat | Experten-Option vs. entfernen |
| 3 | Manuelles Angebot (`/offers/new`) | Behalten vs. nur via Beratung |
| 4 | Commission-Seiten | 5 vs. 7 |
| 5 | Branche erfassen | Schritt 1 vs. Schritt 3 |
| 6 | Legacy-Wizard-Zeitraum | Parallel bis Phase 8 vs. sofort umschalten |
| 7 | APK-Update | Manueller Download vs. In-App-Check (ProfilePage) |

---

## 10. Erfolgskriterien (Gesamtprojekt)

- Beratung in ≤6 Schritten ohne Feld-Duplikate abschließbar
- Keine Seite mit `scrollWidth > clientWidth` auf 360 px (außer explizite Scroll-Tabellen)
- Provision vollständig admin-editierbar mit sichtbarem Feedback
- Keine technischen IDs in Vertriebs-UI
- PWA- und APK-Smoke grün auf identischem Web-Build
- Alt-UI vollständig entfernt (Phase 8)

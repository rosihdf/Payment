# Phase 2B – Abschlussbericht: Originaldokumente gegen Commercial Truth

**Projekt:** amrtech-payment-leads  
**Basis Phase 1:** `5f26d73`  
**Basis Phase 2:** `9144c75`  
**Phase 2B:** Originalabgleich + Korrektur unbelegter 250-€-Regel  
**Datum:** 2026-08-08  

---

## 1. Gesuchte Originaldateien

| Datei | Status | Pfad |
|---|---|---|
| `Provisionsodell.pptx` | **Gefunden** (Schreibweise „odell“, nicht „modell“) | `/Users/micha/Downloads/Provisionsodell.pptx` sowie `…/Zusammenfassung Zusammenarbeit Berlin/Provisionsodell.pptx` |
| `Provisionsodell(1).pptx` | **Nicht gefunden** | Home-Verzeichnis durchsucht |
| `Flyer BP (Marc).pdf` | **Gefunden** | `/Users/micha/Downloads/Zusammenfassung Zusammenarbeit Berlin/Flyer BP (Marc).pdf` |
| `Blanko Angebote.pdf` | **Gefunden** | `/Users/micha/Downloads/Zusammenfassung Zusammenarbeit Berlin/Blanko Angebote.pdf` |
| `Anlage 3 zum Handelsvertretervertrag_Provisionsmodell.pdf` | **Gefunden** | `/Users/micha/Downloads/Anlage 3 zum Handelsvertretervertrag_Provisionsmodell.pdf` |

**Extraktion:** `forensics/phase2b-original-extract.json` (python-pptx + pdfplumber)

---

## 2. PPT – Provisionsregeln (exakt)

Quelle: `Provisionsodell.pptx`, Folien 2–4

### 2.1 Klassisches Modell

| Position | Entgelt | Bemerkung |
|---|---:|---|
| Terminalvertrag + ACQ | 300 € | Vertrag **größer** 36 Monate |
| Terminalvertrag | 200 € | Vertrag **kleiner** 36 Monate |
| ACQ-Vertrag | 150 € | (ohne Laufzeitqualifikation) |

**Beispielrechnung (Folie 2):** 10× Terminal+ACQ = 10×300 € = 3.000 € → **Kombinationsposition**, nicht 200 € + 150 € kumulativ.

**Offene Fachfragen (PPT allein):**

| Frage | Befund |
|---|---|
| Terminal + ACQ bei <36 kumulativ? | **Nein** laut Beispiel; nur Kombi-Position oder Einzelpositionen |
| 300 € bei >36 eine Kombinationsposition? | **Ja** (Beispiel) |
| Exakt 36 Monate? | **Weder >36 noch <36** → **UNGEKLÄRT** |
| „Größer“ vs. „kleiner“ inkl./exkl.? | PPT nutzt strikt „größer“ / „kleiner“ ohne „ab“ / „bis einschließlich“ → **offene Fachentscheidung** |
| Weitere Folien/Anmerkungen? | Folie 7 nur „Fragen euerseits“ – keine Klärung zu 36 Monaten |

### 2.2 Variables Modell – Fixbeträge

| Position | Entgelt | Bemerkung |
|---|---:|---|
| Terminalvertrag + ACQ | 150 € | Vertrag größer 36 Monate |
| Terminalvertrag | 100 € | Vertrag kleiner 36 Monate |
| ACQ-Vertrag | 100 € | |

### 2.3 Variables Modell – laufende Beteiligung

**Angebot 1 (Folie 3):**

| Position | Beteiligung | Schwelle |
|---|---:|---|
| Transaktionsbeteiligung | 30 % | ab 0,039 € |
| Clearing | 30 % | ab 0,014 € |
| Terminalbeteiligung | 30 % | ab 12,00 € |

**Angebot 2 (Folie 3):**

| Position | Beteiligung | Schwelle |
|---|---:|---|
| Girokartenbeteiligung | 30 % | ab 0,30 % |
| Transaktionen | 0,01 € | bei VK 0,04 € |

Folie 5 verweist auf externen **Provisionsrechner-Excel** – nicht im Repo.

### 2.4 Zubehör (Folie 4)

| Position | VK | Bemerkung |
|---|---:|---|
| Bonrollen | 0,99 € | je Rolle (50 Stk./Paket) |
| SIM-Karte | 4,95 € | monatlich |
| Terminalhülle | 39,95 € | CCV A77 / A920 / A960 |
| Halterung | 89,95 € | einmalig |
| Displaylogo & Logodruck | 149,95 € | einmalig |
| Zubehörprovision | 20 % | des VK-Preises |

---

## 3. Vertragsanlage vs. PPT

Quelle: `Anlage 3 zum Handelsvertretervertrag_Provisionsmodell.pdf`

| Regel | PPT | Vertragsanlage | Konflikt? | Vorgeschlagene fachliche Interpretation |
|---|---|---|---|---|
| Vertragsabschluss Fixbetrag klassisch Terminal+ACQ >36 | 300 € | — | — | Nur PPT klassisch |
| Vertragsabschluss Fixbetrag klassisch Terminal <36 | 200 € | — | — | Nur PPT klassisch |
| Vertragsabschluss Fixbetrag klassisch ACQ | 150 € | — | — | Nur PPT klassisch |
| Vertragsabschluss Payment (variabel) | Terminal+ACQ 150 € (>36), Terminal 100 € (<36), ACQ 100 € | **150 € pauschal** „Vertragsabschluss Payment“ für Modell 1 **und** 2 | **Ja** | **Offene Fachentscheidung:** Vertrag vereinfacht auf 150 €; PPT differenziert nach Vertragstyp und Laufzeit. Zeitliche Gültigkeit / welches Modell gilt wann unklar. |
| Transaktionsbeteiligung 30 % ab 0,039 € | Angebot 1 | Modell 1 | Nein | Übereinstimmung |
| Clearing 30 % ab 0,014 € | Angebot 1 | Modell 1 | Nein | Übereinstimmung |
| Terminalbeteiligung 30 % ab 12,00 € | Angebot 1 | Modell 1 | Nein | Übereinstimmung |
| Girokartenbeteiligung 30 % ab 0,30 % | Angebot 2 | Modell 2 | Nein | Übereinstimmung |
| Transaktionen 0,01 € bei VK 0,04 € | Angebot 2 | Modell 2 | Nein | Übereinstimmung |
| Zubehör 20 % VK | PPT Folie 4 | — | — | Nur PPT; Vertrag schweigt |
| Exakt 36 Monate | weder >36 noch <36 | — | — | **Offene Fachentscheidung** |

**Hinweis:** PDF-Überschrift „Anlage 2“ vs. Dateiname „Anlage 3“ – interne Nummerierung prüfen.

---

## 4. Laufzeitmatrix (Blanko Angebote.pdf)

| Produkt / Seite | Dokumentierte Laufzeit | Andere Laufzeiten möglich | Quelle |
|---|---|---|---|
| Mietkasse T2 (Blanko) | ___ Monate (Freifeld) | ja, auf Anfrage | S. 1 |
| Mietkasse V3 (Blanko) | ___ Monate | ja, auf Anfrage | S. 2 |
| Mietkasse A920 (Blanko) | ___ Monate | ja, auf Anfrage | S. 3 |
| Mietkasse A77 (Blanko) | ___ Monate | ja, auf Anfrage | S. ~8 |
| EC-Terminal A920 (Blanko) | ___ Monate | Fairnessgarantie | S. ~10 |
| EC-Terminal A77 (Blanko) | ___ Monate | Fairnessgarantie | S. ~11 |
| EC-Terminal A960 (Blanko) | ___ Monate | Fairnessgarantie | S. ~12 |
| EC-Terminal Mobile Premium (Blanko) | ___ Monate | Fairnessgarantie | S. ~13 |
| EC-Terminal Base Next (Blanko) | ___ Monate | Fairnessgarantie | S. ~14 |
| Mietkasse T2 (ausgefüllt) | **36 Monate** | ja, auf Anfrage | S. ~15–16 |
| EC-Terminal Mobile Premium (ausgefüllt) | **48 Monate** | — | S. ~17 |
| EC-Terminal Base Next (Blanko, wiederholt) | ___ Monate | Fairnessgarantie | S. ~18 |

**24 Monate:** In Blanko Angebote **nicht** als Standard-Laufzeit für A920/EC-Terminals dokumentiert.

**Folgerung für UI/CommercialConfig:** Globales `[24, 36]`-Array ist **nicht** durch Blanko für A920 abgedeckt. Laufzeiten müssen **produktbezogen** modelliert werden (Blanko, 36, 48, frei/auf Anfrage).

**Phase-2-Stand (unverändert in 2B):** `pricingCatalogSeed.ts` enthält weiterhin Standard-Terms 24 + 36 Monate ohne Produktbezug → **UNGEKLÄRT / Korrektur ausstehend**.

---

## 5. Flyer BP (Marc).pdf – Tarifmatrix

### Classic (A920)

| Position | Flyer | Seed (`bestPayTariffs.ts`) | Status |
|---|---:|---:|---|
| Miete A920 | 9,95 € | 995 ct | ✓ |
| Servicepauschale | 7,95 € | 795 ct | ✓ |
| Transaktion | 0,079 € | 79 (Tsd.-Cent) | ✓ |
| Clearing | 0,019 € | 19 | ✓ |
| Gesamt | 17,90 € | berechenbar | ✓ |

### Flat

| Position | Flyer | Seed | Status |
|---|---:|---:|---|
| Servicepauschale | 7,95 € | 795 ct | ✓ |
| Transaktion | 0,039 € | 39 | ✓ |
| Clearing | inklusive | `girocardClearingIncluded: true` | ✓ |
| Girocard | 0,249 % | 249 BPS | ✓ |
| Debit (Maestro/Vpay) | 0,89 % / Flat 0,99 % | 890 / 990 BPS | ✓ |
| Kredit | 1,19 % / Flat 0,99 % | 1190 / 990 BPS | ✓ |
| Non-EWR Markup | +1,49 % | — | **Engine: fehlt** (Assumption-Hinweis in Projection) |
| Commercial Card Markup | +1,59 % | — | **Engine: fehlt** |

### Einmal / Zubehör

| Position | Flyer | Seed (`bestPayProducts.ts`) | Status |
|---|---:|---:|---|
| Aufschaltung | 79,95 € | 7995 ct | ✓ |
| SIM | 4,95 € | 495 ct | ✓ |
| Hülle | 39,95 € | 3995 ct | ✓ |
| Halterung | 89,95 € | 8995 ct | ✓ |
| Display/Logodruck | 149,95 € | 14995 ct | ✓ |
| Bonrollen 50 Stk. | 49,50 € (= 0,99 €/Rolle) | 4950 ct Paket | ✓ |

---

## 6. Phase-2-Code vs. Originale (ORIGINAL → CONFIG → ENGINE → TEST)

| Regel | Original | Domain Config | Engine | Test |
|---|---|---|---|---|
| Classic Terminal+ACQ >36 → 300 € | PPT Folie 2 | `commissionCatalogSeed` `…_gt36` | `commissionCalculationEngine` | `commissionCalculationEngine.test.ts` |
| Classic Terminal <36 → 200 € | PPT | `…_terminal_lt36` | Engine | Test |
| Classic ACQ → 150 € | PPT | `…_acq_only` | Engine | Test |
| **Classic Terminal+ACQ = 36 → 250 €** | **Nicht belegt** | **entfernt in 2B** | **blockiert `exact_36`** | **T5 blockiert** |
| Variable Fixbeträge 150/100/100 | PPT | Seed variable rules | Engine | Demo helpers |
| Variable Tx 30 % ab 0,039 € | PPT + Vertrag M1 | Seed `variable_transaction` | Engine | Demo |
| Variable Clearing 30 % ab 0,014 € | PPT + Vertrag M1 | Seed `variable_clearing` | Engine | Demo |
| Variable Terminal 30 % ab 12 € | PPT + Vertrag M1 | Seed **ohne 12-€-Schwelle** | Engine | **Lücke** |
| Giro 30 % ab 0,30 % (M2) | PPT Angebot 2 + Vertrag M2 | **fehlt im Seed** | — | **Lücke** |
| Tx 0,01 € bei VK 0,04 € (M2) | PPT + Vertrag M2 | **fehlt im Seed** | — | **Lücke** |
| Zubehör 20 % | PPT | Seed accessory rules | Engine | — |
| Laufzeiten 24/36 global | **nicht Blanko-A920** | `pricingCatalogSeed` | `getStandardCommercialContractTerms()` | `commercialPhase2` T2 |
| Flat Markups +1,49 / +1,59 % | Flyer | — | `calculateCommercialProjection` Hinweis only | — |
| Flyer Classic/Flat Preise | Flyer | `bestPayTariffs.ts` | `calculateCommercialProjection` | `commercialPhase2` T1–T4 |

---

## 7. 250-€-Fix – Beleg?

| Frage | Antwort |
|---|---|
| 250 € in PPT? | **Nein** |
| 250 € in Vertragsanlage? | **Nein** |
| 250 € in Flyer / Blanko? | **Nein** |
| 250 € in Phase-2-Seeds vor 2B? | **Ja** (`commission_rule_classic_terminal_acq_lte36`) – **Code-abgeleitet, nicht originalbelegt** |

**Maßnahme Phase 2B:** Regel entfernt; exakt 36 Monate wieder **blockiert** mit Finding `COMMISSION_TERM_AMBIGUOUS_36_MONTHS`. Weder 0 € noch 250 € als Ersatzwahrheit.

---

## 8. In Phase 2B korrigierte Werte

| Änderung | Vorher (Phase 2) | Nachher (2B) |
|---|---|---|
| Terminal+ACQ bei 36 Mon. | 250 € (lte36-Regel) | **blockiert / UNGEKLÄRT** |
| `termClassification` | `lte_36_inclusive` | `exact_36` wieder getrennt |
| Demo-/Production-Seed lte36 | 250 € Regel | **entfernt** |
| Tests T5 / Engine-Test 36M | erwartete 250 € | erwarten Block + Finding |

**Nicht korrigiert (bewusst offen):** globales 24/36-Laufzeit-Array, variable Modell-2-Regeln, Terminal-Schwelle 12 €, Flat-Markups in Engine.

---

## 9. Weiterhin UNGEKLÄRT

1. **Exakt 36 Monate** – klassisch Terminal+ACQ: 300 €, 200+150 kumulativ, eigener Betrag, oder andere Interpretation von „größer/kleiner“?
2. **Provisionsodell(1).pptx** – fehlende Datei; Abweichung zur Haupt-PPT unbekannt.
3. **Welches variables Modell (1 vs. 2)** gilt pro Angebot/Tarif?
4. **Vertrag 150 € pauschal** vs. **PPT gestaffelt** – welche Quelle ist maßgeblich?
5. **Laufzeiten pro Produkt** – kein globales 24/36; Blanko + 36 (T2) + 48 (Mobile Premium) + frei.
6. **Flat Non-EWR / Commercial Card Markups** in Kostenprojektion.
7. **Provisionsrechner-Excel** (PPT Folie 5) – nicht ausgewertet.

---

## 10. Tests

```
npm test -- --run src/test/commissionCalculationEngine.test.ts src/test/commercialPhase2.test.ts
→ 14/14 bestanden (nach 2B-Korrektur)
```

---

## 11. Commit

Phase-2B-Commit: Entfernung unbelegter 250-€-Regel, Wiederherstellung 36-Monats-Blockade, Abschlussbericht.

---

## 12. Fazit

| Frage | Antwort |
|---|---|
| **Phase 2 jetzt fachlich belastbar?** | **Nein** – Originale ausgewertet, aber Laufzeit-UI, variable Modell-2-Regeln, 36-Monats-Provision und PPT↔Vertrag-Konflikte offen |
| **Bereit für Phase 3?** | **Nein** – zuerst Fachentscheidungen zu 36 Monaten, Laufzeitmatrix pro Produkt, variables Modell 1/2, Vertrag vs. PPT |

**Keine Phase 3**, kein Push, kein Release, kein Version-Bump.

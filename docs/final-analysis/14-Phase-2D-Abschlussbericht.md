# Phase 2D – PPT-Provisionslogik fachlich abschließen

**Stand:** Nach Commit `fix(commercial): finalize PPT commission contract rules`  
**Basis:** Phase 2C `508a613`  
**Version:** unverändert `1.0.27 / 10043`  
**Push / Release:** nein  

---

## Fachentscheidungen des Auftraggebers (verbindlich übernommen)

1. **Provisionsodell.pptx** ist die operative Provisionswahrheit für den Außendienst (AD).
2. **36 abgeschlossene Monate** erfüllen bereits die lange Laufzeitstufe (`termMonths >= 36 → long_term`).
3. **Terminalvertrag** und **ACQ-only** sind unterschiedliche, **nicht addierbare** Vertragsarten.
4. PPT-Provisionszeilen sind **Vertragskonstellationen**, keine frei kombinierbaren Provisionselemente.

Die Vertragsanlage zum Handelsvertretervertrag bleibt als Dokumentations-/Vertragsquelle erhalten und wurde **nicht** gelöscht.

---

## Technische Umsetzung (Kern)

| Bereich | Maßnahme |
|--------|----------|
| Vertragskonstellation | `CommissionContractConfiguration`: `terminal_acq_long_term`, `terminal_short_term`, `acq_only` |
| Laufzeit | `classifyCommissionContractTerm()`: `<36 → short_term`, `>=36 → long_term` |
| Regeln | Seed/Matching über `contractConfiguration`, keine Term-Filter auf Fixregeln, keine Addition |
| Konflikt | `commissionSourceConflict.ts`: PPT-Priorität + 36=long_term als `resolved_*`, keine offenen Blocker |
| Ambiguity | `COMMISSION_TERM_AMBIGUOUS_36_MONTHS`, `commissionAmbiguousTermMonths`, `PROVISION_TERM_AMBIGUOUS_36_MONTHS` entfernt |
| Handoff | `CommercialSelectionHandoff.contractConfiguration` + `commissionPlanKind` |
| Recommendation | `resolveCommissionContractConfigurationFromCandidate()` für Provisionsvorschau ohne Heuristik-Addition |

---

## Abschlussbericht (Checkliste)

### Quellenpriorität

| Prüfpunkt | Status |
|-----------|--------|
| PPT operative Commission Truth | **ja** |
| Vertragsanlage weiterhin dokumentiert | **ja** |
| alter Source-Conflict aufgelöst | **ja** (`getOpenCommissionSourceConflicts()` leer) |

### Laufzeit

| Monate | Klassifikation |
|--------|----------------|
| 35 | `short_term` |
| 36 | `long_term` |
| 48 | `long_term` |
| AMBIGUOUS vollständig entfernt | **ja** |

### Klassisch

| Konstellation | Provision |
|---------------|----------:|
| Terminal+ACQ >=36 | **300 €** |
| Terminal <36 | **200 €** |
| ACQ-only | **150 €** |
| Addition ausgeschlossen | **ja** (K5: ≠ 350 €) |

### Variabel (Fix)

| Konstellation | Provision |
|---------------|----------:|
| Terminal+ACQ >=36 | **150 €** |
| Terminal <36 | **100 €** |
| ACQ-only | **100 €** |
| Addition ausgeschlossen | **ja** |

### Laufende Provision

| Modell | Status |
|--------|--------|
| Modell 1 vollständig (Tx/Clearing/Terminal-Schwellen) | **ja** |
| Modell 2 vollständig (Giro + Tx 0,01/0,04) | **ja** |
| Zubehör 20 % separat | **ja** |

### Handoff

| Prüfpunkt | Status |
|-----------|--------|
| Vertragskonstellation explizit vorhanden | **ja** |
| Recommendation → Commercial eindeutig nachvollziehbar | **ja** (Kandidat + Handoff-Typ) |

### Regression

| Altlast | Status |
|---------|--------|
| 250-€-Altregel (36M) | **weg** |
| 36-Ambiguous | **weg** |
| globale 24/36-Wahrheit in Commercial-Terms | **weg** (produktbezogene Capability) |

---

## Tests & Build

| Prüfung | Ergebnis |
|---------|----------|
| Neue Tests `commercialPhase2D.test.ts` | **20 Tests grün** |
| Commission / Commercial / Recommendation (Phase 2D-Kern) | **74 Tests grün** |
| Gesamte Vitest-Suite | **1120 passed**, 6 failed (Wizard-Navigation ×3, Remote-RPC ×3 – außerhalb Phase-2D-Kern) |
| TypeScript + Production Build | **grün** |
| `git diff --check` | **grün** |

---

## Git

- **Commit:** (siehe `git log -1` nach Abschluss)
- **Gepusht:** nein
- **Version:** unverändert

---

## Entscheidung

| Frage | Antwort |
|-------|---------|
| Phase 2 fachlich und technisch abgeschlossen | **ja** |
| Bereit für Phase 3 Offer-Materialisierung + Commercial Freeze | **ja** (nach Freigabe; 6 nicht provisionsbezogene Suite-Fails optional separat) |

---

*Historische Berichte Phase 2B/2C wurden nicht umgeschrieben.*

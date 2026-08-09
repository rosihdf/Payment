# Phase 3 – Offer-Materialisierung + Commercial Freeze

**Stand:** 2026-08-09  
**Commit:** `feat(offers): materialize commercial snapshot and line items` (lokal, nicht gepusht)  
**Version:** unverändert `1.0.27 / 10043`

---

## Ursache Altzustand

### Warum `items: []`

In `createOfferFromComparison()` wurde das Angebot mit hardcodiert `items: []` erzeugt. Es flossen nur `variant.tariffId` und Metadaten ein – kein `CommercialSelectionHandoff`, kein Kandidat aus dem Recommendation-Record, keine Materialisierung.

### Live-Daten bei Anzeige

- **Tarif-Snapshot:** beim Erstellen aus aktuellem Katalog (`createTariffSnapshotFromTariff`)
- **Positionen:** leer → UI zeigte Tarif + Preise, aber „Keine Positionen vorhanden“
- **Totals:** `calculateOfferTotals` addierte leere Items + Tarif-Fixkosten (Doppelstruktur ohne echte Positionen)
- **Provision:** `OfferCommissionSection` lud Live-Berechnung über `commissionCalculationService`
- **Kunde:** Snapshot beim Erstellen aus Lead, danach bei manuellem Lead-Wechsel überschreibbar

---

## Commercial Snapshot

### Struktur (`OfferCommercialSnapshot`, Schema v1)

| Bereich | Inhalt |
|---------|--------|
| **Identität** | tariffId/Name, productId/Name, terminalModel, deploymentMode, contractConfiguration, contractTermMonths, terminalCount |
| **Need** | vollständiger `CustomerNeed`-Snapshot |
| **Kunde** | `OfferCustomerSnapshot` (Dokumentname, Kontakt, Adresse, leadId) |
| **Konditionen** | `CommercialConfig` (Fix/variabel/einmalig) |
| **Projektion** | `CommercialProjectionResult` inkl. breakdown, missingCommercialData |
| **Provision** | eingefrorene `CommissionCalculationResult`-Preview + ruleIds |
| **Quellen** | Session, Recommendation-Record, Kandidat, Katalogversionen, calculatedAt |

### Versionierung

- `schemaVersion: 1` (`OFFER_COMMERCIAL_SNAPSHOT_VERSION`)
- `status: 'frozen' | 'legacy_unfrozen'`

### Persistenz

- Feld `commercialSnapshot` am `Offer`-Objekt → JSONB `offers.data`
- Keine destructive DB-Migration

### ID-/Source-Verknüpfung

- `offer.id`, `offerNumber`, `leadId`
- `sourceComparisonSessionId`, `sourceScenarioId`
- `recommendationLink.recommendationRecordId`, `selectedCandidateId`
- `sources.catalogVersions`, pricing/commission calculation IDs

---

## Items (Materialisierung)

Aus Snapshot via `materializeCreateOfferItemsFromCommercialSnapshot()`:

| Typ | Beispiele |
|-----|-----------|
| **Fix monatlich** | Terminalmiete, Servicepauschale, Kontoführung, SIM |
| **Variabel (Prognose)** | Transaktionsentgelt, Clearing, Kartenentgelt – Kondition + Need-Prognose in Description |
| **Einmalig** | Aufschaltung, Hardware (Produktposition) |

Kondition und Prognose werden getrennt dargestellt (z. B. „0,079 € je Transaktion“ + „bei 100 Vorgängen ≈ …“).

---

## Freeze

| Aspekt | Eingefroren |
|--------|-------------|
| Pricing / Konditionen | **Ja** – `commercialConfig` + `projection` im Snapshot |
| Provision Preview | **Ja** – `commission.preview` im Snapshot |
| Customer Snapshot | **Ja** – beim Offer-Create aus Lead, im Snapshot gespeichert |
| Recommendation-Änderung beeinflusst bestehendes Offer | **Nein** |

Nach Erstellung: keine stillen Katalog-Nachladungen für Konditionen/Provision. `calculateOfferTotals` nutzt bei `status: frozen` die Snapshot-Projektion (kein Doppelzählen Tarif + Items).

---

## Legacy

| Frage | Antwort |
|-------|---------|
| Alte Offers lesbar | **Ja** – `commercialSnapshot: null`, normalize ohne Absturz |
| Heutige Preisrekonstruktion | **Nein** – Legacy bleibt `legacy_unfrozen`, UI-Hinweis in Offer-Detail |

---

## Realfall AMRtech UG

Flow: Beratung/Vergleich → Calculate → Lead → Offer Draft

- Kunde aus Lead-Snapshot
- `items.length > 0`
- `commercialSnapshot.status === 'frozen'`
- Laufzeit, deploymentMode, Projektion, Provision im Snapshot
- Reload identisch
- Tarif-Preisänderung im Katalog: bestehendes Offer unverändert (F1)

---

## Tests

| Suite | Ergebnis |
|-------|----------|
| Neu: `offerCommercialSnapshot.test.ts` | 6 Tests (Materialisierung, F1, F3, F5, Realfall, Idempotenz) |
| `bestPayComparisonServiceA114.test.ts` | erweitert: items + frozen snapshot |
| Gesamt `npm test` | **1128 passed \| 4 skipped** |
| TypeScript / Build | grün |
| `git diff --check` | grün |

---

## Git

- Commit: `feat(offers): materialize commercial snapshot and line items`
- **Nicht gepusht**

---

## Entscheidung

| Frage | Antwort |
|-------|---------|
| Phase 3 vollständig | **Ja** |
| Bereit für Phase 4 (Workflow / PDF / UX) | **Ja** – PDF-Mapper nutzt bereits Snapshot-Totals; vollständiges PDF-Design folgt in Phase 4 |

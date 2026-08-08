# Phase 2C – Abschlussbericht

**Basis:** Phase 1 `5f26d73`, Phase 2 `9144c75`, Phase 2B `484a9b5`  
**Commit:** Phase 2C (lokal, kein Push)  
**Datum:** 2026-08-08  

---

## 1. Produktbezogene Laufzeitlogik

Neue Domain: `src/domain/commercial/commercialTermCapability.ts`

Zentrale API: **`getCommercialTermOptions(productId, { tariffId? })`**

Struktur pro Produkt/Tarif:
- `documentedTermsMonths`
- `customTermAllowed`
- `termSourceReference`
- `commissionAmbiguousTermMonths` (36 für PPT-Schwellen)
- `legacyReadableMonths` ([24] – lesbar, nicht anbieten)

UI (`NeedStep`) liest nur noch aus dieser API – kein hardcodiertes `[24, 36]`.

---

## 2. Wo 36 / 48 belegt

| Kontext | Dokumentierte Laufzeit | Custom/on-request |
|---|---|---|
| `product_speedypay_t2` | **36** | ja |
| `PRODUCT_EC_MOBILE_PREMIUM_ID` | **48** | nein |
| A920-Tarife (Classic/Flat) | — | ja (Blanko EC A920) |
| Mietkassen V3, A920-Register, CCV A920/A77/A960 | — | ja |

---

## 3. Globales 24/36 entfernt

| | |
|---|---|
| **Entfernt?** | **Ja** |
| `pricingCatalogSeed`: `isStandard: false` für alle Terms | ✓ |
| Kein globales Angebot 24/36 in UI | ✓ |
| 24 als `contract_term_24` (historisch) im Katalog | ✓ lesbar |
| 48 als `contract_term_48` ergänzt | ✓ |

---

## 4. Modell 1 vollständig

Plan: `variable_model_1` (`commission_plan_variable_model_1`)

| Regel | Schwelle | Status |
|---|---|---|
| Transaktionsbeteiligung 30 % | ab 0,039 € (39 Tsd.-Cent) | ✓ |
| Clearing 30 % | ab 0,014 € | ✓ |
| Terminalbeteiligung 30 % | **ab 12,00 € (1200)** | ✓ neu |

---

## 5. Modell 2 vollständig

Plan: `variable_model_2` (`commission_plan_variable_model_2`)

| Regel | Status |
|---|---|
| Girokartenbeteiligung 30 % ab 0,30 % | ✓ |
| Transaktionen 0,01 € bei VK 0,04 € | ✓ |

Modell 1 und 2 **nicht vermischt** – separate Pläne und Versionen.

---

## 6. Flat-Markups

`commercialMarkupCatalog.ts`:
- Non-EWR +1,49 % (1490 BPS)
- Commercial Card +1,59 % (1590 BPS)

Projektion: **keine pauschale Vollumsatz-Berechnung** – `hasFlatMarkupVolumeBasis()` liefert `false`, Missing-Codes `commercial.flatNonEwrMarkup` / `commercial.flatCommercialMarkup`.

---

## 7. Exakt 36 Monate

| Aspekt | Status |
|---|---|
| Vertragslaufzeit 36 wählbar (z. B. T2) | ja |
| Provision exakt 36 | **UNGEKLÄRT** – `COMMISSION_TERM_AMBIGUOUS_36_MONTHS` blockiert |
| Keine erfundene Provisionszahl | ja |

---

## 8. PPT ↔ Vertrag-Konflikt

`commissionSourceConflict.ts` – Konflikte **offen**, nicht aufgelöst:
- **A:** Vertragsabschluss PPT (gestaffelt) vs. Vertragsanlage (150 € pauschal)
- **B:** Exakt 36 Monate Provision

Keine automatische 150-/200-/300-Logik zur Konfliktverdeckung.

---

## 9. Tests

```
commercialPhase2C.test.ts   15/15
commercialPhase2.test.ts     8/8
productionCatalogBootstrap   7/7
commissionCalculationEngine  6/6
```

---

## 10. Fazit

| Frage | Antwort |
|---|---|
| **Phase 2 technisch vollständig vorbereitet?** | **Ja** – Laufzeiten, Provision-Seeds, Flat-Markups, Konfliktdokumentation |
| **Phase 2 fachlich final?** | **Nein** – Fachentscheidungen A + B offen |
| **Bereit für Phase 3?** | **Nein** |

### Verbleibende Fachentscheidungen

**A)** Welche Provisionsquelle ist beim Vertragsabschluss verbindlich: **PPT** oder **Vertragsanlage**?

**B)** Welche Provisionsregel gilt **exakt bei 36 Monaten** Laufzeit?

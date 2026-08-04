# AMRtech Payment – Feldmatrix

**Stand:** August 2026  
**Regel:** Jedes fachliche Datum hat **genau eine führende Quelle**. Anzeige elsewhere ist read-only oder derived.

Legende:
- **SoT** = Source of Truth (führend)
- **Erfassung** = wo der Nutzer eingibt
- **Anzeige** = wo read-only gezeigt wird
- ⚠️ = Doppelabfrage im Ist-Zustand

---

## 1. Kunde / CRM

| Feld (canonical) | Typ | SoT | Erfassung (Ziel) | Erfassung (Ist) | Anzeige | Änderbar nach Angebot |
|----------------|-----|-----|------------------|-----------------|---------|----------------------|
| Firma | string | `Lead.companyName` | Wizard Schritt 1 / LeadForm | prospect + LeadForm | Kundenakte, Angebot | Ja (CRM) |
| Ansprechpartner | string | `Lead.contactFirstName/LastName` | Wizard Schritt 1 / LeadForm | prospect + LeadForm | Kundenakte | Ja |
| Telefon | string | `Lead.phone` | Wizard / LeadForm | optional | Kundenakte | Ja |
| E-Mail | string | `Lead.email` | Wizard / LeadForm | optional | Kundenakte | Ja |
| Straße, PLZ, Ort | string | `Lead.street/postalCode/city` | LeadForm | LeadForm | Kundenakte | Ja |
| Branche | string | `Lead.industry` | **Schritt 3 Bedarf** | ⚠️ need (nicht prospect) | Kundenakte, Need | Ja |
| Aktueller Anbieter | string | `Lead.currentProvider` | **Schritt 2** (neu) | LeadForm only | Kundenakte | Ja |
| Notizen | string | `Lead.notes` | Kundenakte Vorgänge | Timeline/Notes | Kundenakte | Ja |
| Wiedervorlage | date | `Lead.nextFollowUpAt` | Kundenakte / Arbeitsplatz | Tasks | Arbeitsplatz | Ja |
| Status | enum | `Lead.status` | LeadForm (edit) | Admin/Edit | Kundenakte | Ja |
| Zuständiger AD | ref | `Lead.assignedSalesUserId` | System / Admin | System | Kundenakte | Ja |

### Contact (Ansprechpartner-Entität)

| Feld | SoT | Erfassung |
|------|-----|-----------|
| Name, Rolle, Telefon, E-Mail | `Contact` | Kundenakte Tab Kontakte |

---

## 2. Ausgangssituation (Ist-Kosten)

| Feld | Typ | SoT | Erfassung (Ziel) | Erfassung (Ist) | Beeinflusst |
|------|-----|-----|------------------|-----------------|-------------|
| Erfassungsart | enum | `wizard.costCaptureMode` | Schritt 2 | Schritt 2 (seit Hotfix) | Validierung |
| Monatliche Ist-Gesamtkosten | cents | `manualInput.monthlyTotalCostsCents` **oder** `CustomerCostBaseline` | Schritt 2 manual / Billing | costs + Comparison | Vergleich, Need |
| Monatlicher Kartenumsatz (Ist) | cents | `CustomerCostBaseline.monthlyCardVolumeCents` | **Nur Billing** | ⚠️ auch costs manual + need | Need (prefill) |
| Monatliche Fixkosten | cents | Baseline | Billing | Billing | Need |
| Terminalkosten | cents | Baseline | Billing | Billing | Need |
| Transaktionskosten | cents | Baseline | Billing | Billing | Need |
| Clearing-Kosten | cents | Baseline | Billing | Billing | Need |
| Card-Mix (Ist) | % | Baseline | Billing | Billing | Need (prefill) |
| Transaktionsanzahl (Ist) | int | Baseline | Billing | Billing | Need (prefill) |

**Ziel-Regel Schritt 2:** Nur `monthlyTotalCostsCents` + Modus. Umsatz kommt aus Billing-Baseline als **Prefill** in Schritt 3, nicht als Eingabe in Schritt 2.

---

## 3. Bedarf (Zukunft)

| Feld | Typ | SoT | Erfassung (Ziel) | Erfassung (Ist) | Beeinflusst |
|------|-----|-----|------------------|-----------------|-------------|
| Monatlicher Kartenumsatz | cents | `manualInput.monthlyCardVolumeCents` | **Schritt 3** (einzige Abfrage) | ⚠️ costs + need | Recommendation |
| Monatliche Transaktionen | int | `manualInput.monthlyTransactions` | Schritt 3 | need | Recommendation |
| Durchschnittsbon | cents | `manualInput.averageTransactionValueCents` | Schritt 3 (optional) | Baseline prefill | Recommendation |
| Terminalanzahl | int | `manualInput.terminalCount` | Schritt 3 | ⚠️ need + Szenario | Recommendation, Pricing |
| Laufzeitpräferenz | months | `manualInput.preferredTermMonths` | Schritt 3 | ⚠️ need + Szenario | Recommendation |
| Girocard-Anteil | % | `manualInput.girocardPercent` | Schritt 3 | need | Recommendation |
| Debit-Anteil | % | `manualInput.debitPercent` | Schritt 3 | need | Recommendation |
| Kredit-Anteil | % | `manualInput.creditPercent` | Schritt 3 | need | Recommendation |
| Sonstige | % | `manualInput.otherPercent` | Schritt 3 | need | Recommendation |
| Payment stationary | bool | `manualInput.paymentUsage.stationary` | Schritt 3 | need | Recommendation |
| Payment mobile | bool | `manualInput.paymentUsage.mobile` | Schritt 3 | need | Recommendation |
| Payment ecommerce | bool | `manualInput.paymentUsage.ecommerce` | Schritt 3 | need | Recommendation |
| Payment softPos | bool | `manualInput.paymentUsage.softPos` | Schritt 3 | need | Recommendation |
| Branche | string | `Lead.industry` ← sync from need | Schritt 3 | need → manualInput | Recommendation |

### Lead-Bedarf-Felder (CRM, optional sync)

| Feld | SoT | Sync aus Wizard |
|------|-----|-----------------|
| `Lead.monthlyCardTurnoverCents` | Lead | Bei Lead-Zuordnung aus `manualInput` |
| `Lead.requiredTerminalCount` | Lead | Bei Lead-Zuordnung |
| `Lead.paymentUsage` | Lead | Bei Lead-Zuordnung |
| `Lead.cardMix` | Lead | Bei Lead-Zuordnung |

**Naming-Konsolidierung (Ziel):** Domain-Mapping `monthlyCardVolumeCents` ↔ `monthlyCardTurnoverCents` → ein Canonical Name intern, Mapping an Repository-Grenze.

---

## 4. Empfehlung / Vergleich

| Feld | SoT | Erfassung | Anzeige |
|------|-----|-----------|---------|
| Empfohlene Variante | `session.selectedCandidateId` / Szenario | Schritt 4 (Auswahl) | Schritt 4–6 |
| Berechnete Varianten | `session.result.variants[]` | berechnet | Schritt 4 |
| Monatliche BestPay-Kosten | `variant.monthlyTotalCostsCents` | berechnet | Schritt 4–5 |
| Ersparnis | `variant.savingsMonthlyCents` | berechnet (null bei 0 € Ist) | Schritt 4 |
| Provision (intern) | `variant.commissionTotalCents` | berechnet | Schritt 4–5 (nur berechtigt) |
| Szenario-Config | `wizard.scenarios[].config` | Experten-Option | Schritt 4 |

**Regel:** `CustomerNeed` wird **nie direkt** in UI editiert – immer aus ManualInput + Baseline + Lead abgeleitet via `buildCustomerNeedForComparison()`.

---

## 5. Angebot

| Feld | SoT | Erfassung | Nach Versand |
|------|-----|-----------|--------------|
| Angebotsnummer | `Offer.offerNumber` | System | immutable |
| Titel | `Offer.title` | Wizard / OfferForm | editierbar bis Versand |
| Kunde (Snapshot) | `Offer.customerSnapshot` | bei Create aus Lead | **immutable** |
| Tarif/Hardware | `Offer.tariffSnapshot`, `items[]` | aus Variante | Versionierung |
| Gültig bis | `Offer.validUntil` | Wizard / OfferForm | editierbar |
| Workflow-Status | `Offer.workflowStatus` | System (Workflow) | read-only UI |
| Empfehlungslink | `Offer.recommendationLink` | aus Session | read-only |
| Interne Notizen | `Offer.internalNotes` | OfferForm / Workflow | editierbar |

---

## 6. Provision

| Feld | SoT | Erfassung | Anzeige |
|------|-----|-----------|---------|
| Standard-Regelbetrag | `CommissionRule.fixedAmountCents` | Admin Models | Admin, Berechnung |
| Standard-Prozentsatz | `CommissionRule.percentTenthsOfBasisPoint` | Admin Models | Admin |
| Mitarbeiter-Anteil | `CommissionRuleOverride.sharePercent` | Admin Assignments | Admin, Case |
| Provisionsfall-Status | `CommissionCase.status` | Admin Cases | Admin, Sales (read) |
| Endbetrag | `CommissionCase.endAmountCents` | berechnet | Admin, Sales |
| Sonderzahlung | `CommissionBonusPayment` | Admin (Modal) | Case |

---

## 7. Doppelabfragen (Ist → Ziel)

| Feld | Ist: Abfrage 1 | Ist: Abfrage 2 | Ziel |
|------|----------------|----------------|------|
| Monatlicher Kartenumsatz | costs (optional) | need (Pflicht) | **Nur need** |
| Terminalanzahl | need | Szenario-Config | need → Szenario erbt Default |
| Laufzeit | need | Szenario-Config | need → Szenario erbt Default |
| Branche | — (prospectDraft leer) | need | need → Lead.industry |
| Ist-Gesamtkosten | costs | Comparison need | Nur costs |
| Card-Mix | LeadForm | need | need (Wizard); LeadForm (CRM direkt) |

---

## 8. Prefill-Regeln (Ziel)

| Quelle | Ziel | Wann |
|--------|------|------|
| Billing-Baseline | need (Umsatz, Transaktionen, Card-Mix) | Nach Baseline-Bestätigung |
| Lead | need (Umsatz, Terminals, Branche) | Bei Lead-Zuordnung Schritt 1 |
| need | Szenario-Config | Beim ersten Szenario |
| Lead | Offer.customerSnapshot | Bei Angebot-Create |

---

## 9. Felder ohne UI (nur System)

| Feld | SoT | Verwendung |
|------|-----|------------|
| `session.id` | UUID | URL-Parameter (nicht als Label) |
| `offerId`, `leadId` | UUID | Links intern; UI zeigt Nummern |
| `schemaVersion` | Session | Migration |
| `inputFingerprint` | Result | Stale-Erkennung |
| `engineVersion` | Pricing/Commission | Audit |

**Regel:** Vertriebs-UI zeigt **fachliche Nummern** (`offerNumber`, `contractNumber`, `activationNumber`), nie UUID-Fragmente.

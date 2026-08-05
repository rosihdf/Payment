# 05 – Angebotserzeugung: Pfad, Voraussetzungen, Abhängigkeiten

Nur Ist-Zustand. Keine Änderungen.

## 5.1 Vollständiger Pfad

```
Beratung (prospect → costs → need)
  → RecommendationStep: calculateScenario
      → RecommendationService → Kandidatengenerierung → evaluatePricing pro Kandidat
      → recommendation_records
  → Variante wählen: selectScenarioVariant
  → OfferStep: createOffer
      → bestPayComparisonService.createOfferFromComparison
      → offerService.createOffer            → offers
      → offerWorkflowService.ensureInitialVersion → offer_versions
  → (optional) Freigabe: acknowledgeApproval → offer_workflow_events
  → ClosingStep: Kundenlink / PDF / Versand
      → offer_share_links → Worker /api/public/offers/:token
      → offer_documents
```

Pricing ist **kein** eigener Wizardschritt; die Preisbewertung läuft pro Kandidat innerhalb der Empfehlungs-Engine.

## 5.2 Voraussetzungen für „Empfehlung berechnen"

### Session-/Rollenvoraussetzungen

| Voraussetzung | Beleg |
|---|---|
| Sitzung und Szenario existieren | `salesWizardService.ts:672-678` |
| Umsatz **oder** bestätigte Kostenbasis: `monthlyCardVolumeCents` oder `annualCardVolumeCents` oder `costBaselineId` | `salesWizardService.ts:699-708` |
| Rolle `admin` oder `field_service` | `recommendationService.ts:298-300` |
| `terminalCount > 0`, mindestens ein `paymentUsage`-Flag | `domain/.../customerNeed.ts:86-118`, `buildCustomerNeedForComparison.ts:31-77` |

### Katalogvoraussetzungen und deren realer Zustand

| Tabelle | Rolle | Zeilen (Produktion) | Zustand |
|---|---|---|---|
| `tariffs` | Kandidatengenerierung (`candidateGeneration.ts:119-123`) | 2 | beide `active` |
| `products` | Hardwarezuordnung (`candidateGeneration.ts:125-129`) | 19 | alle `active` |
| `contract_terms` | Laufzeitauswahl (`candidateGeneration.ts:85-108`) | 2 | `contract_term_24`, `contract_term_36`, beide `active` |
| `price_books` | Container | 1 | `price_book_bestpay_v1` |
| `price_book_versions` | **veröffentlichte** Version am Stichtag (`versionResolution.ts:8-64`) | 1 | `price_book_version_bestpay_v1`, **`published`**, `validFrom = 2026-01-01`, `validTo = null` |
| `price_rules` | Regeln zur Preisbuchversion (`pricingEvaluationEngine.ts:340-371`) | 3 | alle `active`, ab `2026-01-01` |
| `recommendation_weight_sets` | optionale Gewichtung | 1 | vorhanden |
| Commission-Katalog | optionale Provisionsvorschau | 15 Regeln | vorhanden |

### Verhalten bei `PRICE_BOOK_NOT_FOUND`

| Stufe | Wirkung | Beleg |
|---|---|---|
| Finding | `blocking: true` | `pricingEvaluationEngine.ts:317-326` |
| Freigabe | `approvalBlocked: true` | `pricingEvaluationEngine.ts:244-251,267` |
| Prüfklasse | `reviewClass: 'critical'` | `pricingEvaluationEngine.ts:214-218` |
| Kandidat | Status `blocked` | `candidateEligibility.ts:138-143` |
| UI | filtert nur `eligible`/`limited` → **keine Varianten sichtbar** | `salesWizardService.ts:724-726` |
| Rückgabe | `calculateScenario` liefert trotzdem `ok: true` | `salesWizardService.ts:796` |
| Anzeige | bleibt „Noch keine Empfehlung berechnet" | `RecommendationStep.tsx:50,128-131` |

**Bewertung:** Der Zustand ist in Produktion **nicht** eingetreten – das Preisbuch ist veröffentlicht und gültig. Das Muster ist aber ein systematischer Schwachpunkt: ein blockierender Fehler wird als Erfolg zurückgegeben und dem Nutzer als „noch nichts berechnet" angezeigt. Im Demo-Modus (und damit in allen E2E-Tests) ist der Katalog leer (`e2e/helpers.ts:41-45` seedet ihn erst) – Tests und Produktion verhalten sich hier unterschiedlich.

## 5.3 Voraussetzungen und Blocker für „Angebotsentwurf erzeugen"

| Ebene | Blocker | Beleg | fachlich notwendig |
|---|---|---|---|
| UI | Button deaktiviert ohne `selectedVariant` | `OfferStep.tsx:137-138` | ja |
| UI | Hinweis „Bitte zuerst eine Empfehlung wählen" | `OfferStep.tsx:133-134` | ja |
| Wizard | `selectedScenarioId` + `session.result` + `session.selectedCandidateId` | `salesWizardService.ts:840-841` | ja (wird nach `calculateScenario` automatisch gesetzt, Zeilen 791-795) |
| Persistenz | **`leadId` Pflicht** | `bestPayComparisonService.ts:733-734` | **fragwürdig** – anonyme Beratung darf rechnen (`AdviceWizardPage.tsx:211-212`), aber kein Angebot erzeugen |
| Persistenz | `result.stale` blockiert ohne `allowStale` | `bestPayComparisonService.ts:739-740` | teilweise – schützt vor veralteten Preisen, erzwingt aber Neuberechnung ohne Hinweis |
| Persistenz | Variante muss in `result.variants` enthalten sein | `bestPayComparisonService.ts:754-758` | ja |
| Persistenz | Idempotenz: bestehendes `session.offerId` → sofort OK | `bestPayComparisonService.ts:730-731` | positiv |
| Angebot | Leadzugriff (`forbidden`) | `offerService.ts:381-385` | ja |
| Angebot | Tarif muss `active` sein | `offerService.ts:403-410` | ja |
| Angebot | Tarif **oder** Positionen | `offerValidation.ts:138-143` | ja (Wizard liefert Tarif) |
| Navigation | Schritt `offer` ohne `offerId` blockiert Weiter | `AdviceWizardPage.tsx:252-254`, `salesWizardService.ts:351-358` | ja |

**Freigabe blockiert `createOffer` nicht.** Sie greift erst bei Navigation, Abschluss und Kundenlink.

Da der Wizard in Produktion die Sitzung nicht persistieren kann (Dokument 04), ist `createOffer` derzeit ohnehin unerreichbar. Das einzige Angebot in der Datenbank (`offer_test_p1b_smoke_20260802`, `offerNumber = TEST-P1B-20260802`) ist ein manuell eingefügter Testdatensatz vom 2026-08-02 21:50 UTC.

## 5.4 Statusmodelle

| Nr. | Modell | Werte | Ort |
|---|---|---|---|
| 1 | `Offer.status` (Legacy) | `draft \| completed \| cancelled` | `domain/offer/offer.ts:6` |
| 2 | `Offer.workflowStatus` | 17 Zustände | `domain/offer/offerWorkflow.ts:2-18` |
| 3 | `OfferVersion.workflowStatus` | Spiegel je Version | `domain/offer/offerVersion.ts:54`, Updates `offerWorkflowService.ts:438,573` |
| 4 | `OfferPresentationGroup` | 7 UI-Gruppen (dokumentiert abgeleitet) | `offerPublicationReadiness.ts:7-24,58-87` |
| 5 | `ShareStatus` | `active \| expired \| revoked \| superseded` | `domain/offer/offerShare.ts:5-12` |
| 6 | Session-/Empfehlungsstatus | `calculated`, `recommendation_selected`, `offer_created`; `RecommendationRecord.status` | `bestPayComparisonService.ts:654,675,813`, `bestPayRecommendationEngine.ts:237-246` |

Mapping Legacy ↔ Workflow:

```165:179:src/domain/offer/offerWorkflow.ts
export function syncLegacyOfferStatus(workflowStatus: OfferWorkflowStatus): 'draft' | 'completed' | 'cancelled' {
```

Jede Transition schreibt beide Felder (`offerWorkflowService.ts:350-356`).

### Belegte Widersprüche

| Nr. | Widerspruch | Beleg |
|---|---|---|
| 1 | `Offer.workflowStatus` und `OfferVersion.workflowStatus` können auseinanderlaufen, weil Versionen eigene Updates bei Approve/Sent erhalten | `offerWorkflowService.ts:438,573` |
| 2 | **Zwei Freigabewahrheiten:** Szenario-`approval` in der Session (`salesWizardService.ts:754-769`) gegen `pricing_evaluations`-Repository in `detectApprovalRequired` (`offerWorkflowService.ts:216-219`). `pricing_evaluations` hat **0 Zeilen** – Wizard-Angebote ergeben damit `approvalRequired = false`, obwohl die Engine standardmäßig `adminReviewRequired: true` setzt (`pricingEvaluationEngine.ts:262-267`). Die Freigabepflicht ist faktisch ausgeschaltet. |
| 3 | `wizard.approvalAcknowledgedAt` ist im Code als deprecated markiert, wird aber weiter für die UI-Wiederaufnahme gelesen | `salesWizardService.ts:129,901-902` |
| 4 | `getWizardWorkflowView.approved` mischt Workflow-Status und versionsbezogene Events | `offerWorkflowService.ts:289-300` |

Reale Datenlage: `offers` = 1 Zeile mit `status = draft` **und** `workflowStatus = ready_to_send`. Das ist laut `syncLegacyOfferStatus` konsistent (alles außer accepted/aktiv ist `draft`), zeigt aber, dass `Offer.status` fachlich nichts aussagt.

## 5.5 Versionierung und Freigabe

| Aspekt | Verhalten | Beleg |
|---|---|---|
| Initialversion | bei Angebotserstellung erzwungen | `offerWorkflowService.ts:119-158` |
| Snapshot | `buildOfferVersionSnapshot` | `domain/offer/offerVersion.ts:13-48` |
| Neue Version | invalidiert Freigabe, Reset auf `draft` | `offerWorkflowService.ts:161-204` |
| Freigabe | **versionsbezogen** über Events | `offerWorkflowService.ts:241-244,402,436` |
| Erzwungen bei | `goNext` im Schritt `approval` (`salesWizardService.ts:360-374`), `completeWizard` (`914-932`), Kundenlink über `publicationAllowed` (`offerShareService.ts:77-82`, `offerPublicationReadiness.ts:142-173`) |
| Nicht erzwungen bei | `createOffer` |
| Auto-Sprung | `submitForApproval` ohne Pflicht → `draft → ready_to_send` | `offerWorkflowService.ts:388-397` |

Reale Datenlage: `offer_versions` = 1, `offer_workflow_events` = 1, `pricing_evaluations` = **0**, `approval_rules` = 3.

**Kernrelevante Bewertung:** Die Freigabe kann den Kernpfad an drei Stellen blockieren (Navigation, Abschluss, Kundenlink), aber nicht die Angebotserzeugung selbst. Da `pricing_evaluations` leer ist, greift die Blockade aktuell nirgends – das ist kein Verdienst des Designs, sondern eine Folge fehlender Daten.

## 5.6 Kundenlink

| Schritt | Detail | Beleg |
|---|---|---|
| Auslöser | `ClosingStep.tsx:96-115` → `offerShareService.createCustomerShareLink` |
| Vorbedingung | `publicationAllowed` | `ClosingStep.tsx:223-227` |
| Token | 32 Byte hex | `domain/offer/shareToken.ts:6-9` |
| Hash | SHA-256, im Worker gespiegelt | `shareToken.ts:12-15`, `workers/amrtech-payment/src/publicOfferApi.ts:27-31` |
| Tabelle | `offer_share_links` (3 Zeilen) | `offerShareService.ts:119-136` |
| URL | `/offer-review/{token}` | `offerShareService.ts:32-33` |
| Gültigkeit | 30 Tage | `offerShareService.ts:24-29,126` |

Worker-Endpunkte (`workers/amrtech-payment/src/index.ts:84-86`):

| Route | Handler |
|---|---|
| `GET /api/public/offers/:token` | `publicOfferApi.ts:163-246` |
| `POST …/questions` | `publicOfferApi.ts:249-339` |
| `POST …/change-requests` | `publicOfferApi.ts:342-429` |
| `GET …/pdf` | `publicOfferApi.ts:432-459` |

Benötigte Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`publicOfferApi.ts:51-53`). Fehlt der Service-Role-Key → HTTP 503 „misconfigured" (`publicOfferApi.ts:167-168`). Fehlt der Worker-Endpunkt (z. B. lokaler Dev-Server ohne Proxy) → Frontend zeigt „Service vorübergehend nicht erreichbar" (`OfferReviewPage.tsx:45-51`).

Freigabezustand nicht `approved/ready_to_send/sent` → HTTP 403 (`publicOfferApi.ts:7,200-201`). Veraltete Version gegenüber dem Share → Status `superseded` (`publicOfferApi.ts:204-215`).

RLS: `offer_share_links` ist nur für `authenticated` freigegeben; anonymer Zugriff läuft ausschließlich über den Worker mit Service-Role.

Reale Datenlage: 3 Share-Links, 2 Kundenfragen, 1 Änderungswunsch, 0 Kundenannahmen – alle zum Testdatensatz. Der Pfad ist also funktional belegt, aber nur mit Testdaten.

## 5.7 PDF

| Aspekt | Befund |
|---|---|
| Erzeugung | **clientseitig** mit jsPDF + jspdf-autotable (`domain/.../offerPdfRenderer.ts:1-2,114-367`). Kein html2canvas im Anwendungscode, kein Server-Rendering. |
| Persistenz | `offer_documents` (1 Zeile), `offerDocumentService.ts:252-266` |
| Voraussetzung Finaldokument | `offer.currentVersionId` muss gesetzt sein (`offerDocumentService.ts:229-234`) |
| Aufruf im Wizard | **keiner.** Weder `createOffer` noch der Wizard erzeugen ein PDF. |
| Kernrelevanz | **nein** |

## 5.8 Abhängigkeitsbewertung

### Zwingend für Angebotserzeugung aus der Beratung

| Teil | Grund | Beleg |
|---|---|---|
| Persistierte Beratungssitzung | ohne sie keine `result`/`selectedCandidateId` | Dokument 04 |
| Lead-Zuordnung (`leadId`) | harte Pflicht | `bestPayComparisonService.ts:733-734` |
| Umsatz oder Kostenbasis | Berechnungsvoraussetzung | `salesWizardService.ts:699-708` |
| `tariffs` + `products` aktiv | Kandidatengenerierung | `candidateGeneration.ts:119-129` |
| `contract_terms` | Laufzeitauswahl | `candidateGeneration.ts:85-108` |
| `price_book_versions` `published` + `price_rules` | sonst alle Kandidaten `blocked` | `pricingEvaluationEngine.ts:292-371` |
| `offers` + `offer_versions` | Persistenz + Initialversion | `offerService.ts:448-452`, `offerWorkflowService.ts:119-158` |
| Rolle `admin`/`field_service` | Berechnung | `recommendationService.ts:298-300` |

### Deaktivierbar, ohne die Angebotserzeugung zu zerstören

| Teil | Kopplung | Beleg |
|---|---|---|
| PDF / `offer_documents` | keine | separater Aufruf, `offerDocumentService.ts:158+` |
| Kundenlink / Worker Public API / `offer_share_links` | keine für den Entwurf | `ClosingStep.tsx:217-254` |
| Freigabe / `approval_rules` / `pricing_evaluations` | blockiert nur Navigation/Abschluss/Link, nicht `createOffer` | `offerWorkflowService.ts:216-219` |
| `completeWizard` | optionaler Abschluss | `salesWizardService.ts:906-954` |
| `sales_tasks` / `sales_activities` | optionale Nachverfolgung | `offerWorkflowService.ts:377-381,411` |
| Provisionsvorschau im Wizard | nur interne Anzeige | `bestPayRecommendationEngine.ts:177-190` |
| `recommendation_weight_sets` | Fallback-Scoring vorhanden | `bestPayRecommendationEngine.ts:118-131` |
| Abrechnungsimport (6 Tabellen) | Alternative: manueller Umsatz | `salesWizardService.ts:699-708` |
| `ContractService` bei Annahme | optional | `offerWorkflowService.ts:636-643` |
| Kundenfragen / Änderungswünsche / Annahmen / BestPay-Handoff | vollständig nachgelagert | eigene Tabellen, kein Rückbezug |
| Angebotsdokumentseiten, manuelles Angebotsformular (`/offers/new`, `/offers/:id/edit`) | vom Wizardpfad unabhängig | `router.tsx:92-95` |

## 5.9 Befundliste Angebot

| Nr. | Befund | Schwere |
|---|---|---|
| A1 | Der Angebotspfad ist in Produktion unerreichbar, weil die Beratung nicht persistiert (Dokument 04). Das einzige Angebot ist ein manuell eingefügter Testdatensatz. | blockierend (Folgefehler) |
| A2 | `createOffer` erfordert zwingend `leadId`, obwohl die Beratung anonym gerechnet werden darf. Fachlich fragwürdiger Blocker. | mittel |
| A3 | Blockierende Pricing-Findings werden als `ok: true` zurückgegeben und als „noch nichts berechnet" angezeigt. Fehlerursache für den Nutzer nicht erkennbar. | mittel |
| A4 | Sechs Statusmodelle, davon drei persistierte (`Offer.status`, `Offer.workflowStatus`, `OfferVersion.workflowStatus`). `Offer.status` ist fachlich informationslos. | mittel |
| A5 | Zwei Freigabewahrheiten; `pricing_evaluations` ist leer, dadurch ist die Freigabepflicht faktisch ausgeschaltet. | mittel |
| A6 | `result.stale` blockiert die Angebotserzeugung ohne Hinweis auf die nötige Neuberechnung. | niedrig |
| A7 | Der Katalog ist in Produktion vollständig und korrekt veröffentlicht (Preisbuchversion `published`, 2 Tarife, 19 Produkte, 2 Laufzeiten, 3 Preisregeln aktiv). Hier besteht **kein** Reparaturbedarf. | Negativbefund |
| A8 | PDF und Kundenlink sind vollständig abtrennbar und blockieren den Kern nicht. | Negativbefund |

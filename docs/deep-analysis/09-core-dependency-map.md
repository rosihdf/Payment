# 09 – Kernabhängigkeitskarte

Nur Ist-Zustand. Grundlage: Dokumente 01–08.

Der Kern umfasst die zehn vom Nutzer benannten Funktionen. Diese Karte zeigt, welche vorhandenen Bausteine dafür **unverzichtbar** sind und welche vollständig außen vor bleiben können.

## 9.0 Gesamtbild in Zahlen

| Ebene | Bestand | Für den Kern unverzichtbar | Anteil |
|---|---|---|---|
| Supabase-Tabellen | 58 | **17** | 29 % |
| Routeneinträge | 62 | **21** | 34 % |
| Services in `src/services/` | 84 | **19** | 23 % |
| Supabase-Repositories | 39 | **11** | 28 % |
| Domänenordner in `src/domain/` | 31 | **10** | 32 % |
| Postgres-Funktionen | 13 | **7** | 54 % |
| Trigger | 1 | 1 | 100 % |
| Storage Buckets / Edge Functions | 0 / 0 | – | – |

Etwa **70 % des vorhandenen Codes und Schemas sind für den gewünschten Kern nicht erforderlich.**

## 9.1 Kunden

*Kunden anzeigen, anlegen, bearbeiten, einem Betreuer zuweisen; Außendienst sieht exakt seine Kunden.*

### Tabellen

| Tabelle | Rolle | unverzichtbar |
|---|---|---|
| `leads` | führende Kundentabelle; Betreuer in `assigned_sales_user_id` (Spalte **und** `data->>'assignedSalesUserId'`) | **ja** |
| `profiles` | Betreuerauswahl, Rolle, Status; `user_id uuid` ist die Referenz | **ja** |
| `lead_contacts` | zusätzliche Kontaktpersonen | nein (Kundenfelder in `leads` reichen) |
| `sales_activities` | Audit „Kunde angelegt/zugewiesen" | nein |

### Services

| Datei | Rolle | unverzichtbar |
|---|---|---|
| `services/leadService.ts` | `searchLeads`, `createLead`, `updateLead`, Rollenfilter (Zeilen 218-224) | **ja** |
| `services/leadValidation.ts` | Pflichtfelder | **ja** |
| `domain/lead/normalizeLead.ts` | JSONB → Domänenobjekt; enthält den Demo-ID-Fallback `user_001` (Zeilen 133-135) | **ja** (mit Befund) |
| `repositories/supabase/SupabaseLeadRepository.ts` | Spalten-/JSONB-Synchronisation (Zeilen 18-29) | **ja** |
| `repositories/supabase/SupabaseUserRepository.ts` + `mapProfile.ts` | Profile laden | **ja** |
| `services/adminUserService.ts` / `adminUserApiClient.ts` | Benutzerverwaltung über Worker | **ja** (für Admin) |
| `services/leadDraftService.ts`, `leadEditDraftService.ts` | Formularentwürfe in `localStorage` | nein |
| `services/contactService.ts` | Kontaktpersonen | nein |
| `services/salesWorkspaceService.ts` + `salesDayWorkspace.ts` | Arbeitsplatz-Aggregation; **eigener, abweichender Filter** (Zeilen 182-187) | **nein** |
| `services/customerDocumentAggregationService.ts` | Dokumentaggregation in der Kundenakte | nein |

### Routen

| Route | unverzichtbar |
|---|---|
| `/leads` (`v2/crm/LeadsPage`) | **ja** |
| `/leads/new` (`v2/crm/NewLeadPage`) | **ja** |
| `/leads/:id/edit` (`v2/crm/EditLeadPage`) | **ja** – hat aktuell **kein Betreuerfeld** |
| `/leads/:id` (`v2/crm/LeadRecordPage`) | ja (Einstieg in die Beratung) |
| `/sales` (`v2/workspace/WorkspacePage`) | **nein** – enthält keine Kundenliste, `sales_tasks` ist leer |

### RLS-Funktionen

`is_active_user()`, `current_user_role()`, `is_admin()`, `can_access_lead(text)`

### Fehlende Bausteine

| Lücke | Beleg |
|---|---|
| Kein Betreuerfeld in `EditLeadPage`/`NewLeadPage` | Dok. 03, Abschnitt 3.5 |
| Kein Fremdschlüssel `leads.assigned_sales_user_id → profiles.user_id` | Dok. 07, Abschnitt 7.4 |
| Kein Index auf `leads.assigned_sales_user_id` | Dok. 07, Abschnitt 7.4 |
| Zwei unterschiedliche Rollenfilter (`leadService` vs. `salesWorkspaceService` vs. RLS) | Dok. 03, Abschnitt 3.4 |

## 9.2 Beratung

*Beratung mit manuellen Werten, mit 0 € Ist-Kosten, optional mit Abrechnungsimport.*

### Tabellen

| Tabelle | Rolle | unverzichtbar |
|---|---|---|
| `best_pay_comparison_sessions` | vollständige Sitzung als JSONB | **ja** |
| `leads` | Kundenbezug der Sitzung | **ja** |
| `tariffs` (2), `products` (19), `contract_terms` (2), `price_books` (1), `price_book_versions` (1), `price_rules` (3) | Katalog für die Berechnung, in Produktion **vollständig und `published`** | **ja** |
| `user_active_sessions` | Komfortzeiger „letzte Sitzung" | **nein** – Verursacher des blockierenden FK-Fehlers |
| `recommendation_records` | Empfehlungssnapshot | nein (Snapshot liegt zusätzlich in der Session) |
| `recommendation_weight_sets` | Scoring-Gewichte | nein (Codefallback vorhanden) |
| `pricing_evaluations` | persistierte Preisbewertung | nein (0 Zeilen, Freigabepflicht faktisch aus) |
| `billing_import_sessions`, `billing_source_documents`, `billing_extracted_fields`, `billing_period_records`, `billing_cost_line_items`, `customer_cost_baselines` | Abrechnungsimport | **nein** – optional, alle bis auf eine Testzeile leer |

### Services

| Datei | Rolle | unverzichtbar |
|---|---|---|
| `services/salesWizardService.ts` | Wizard-Orchestrierung, Schritte, Validierung, Angebotserzeugung (954 Zeilen) | **ja** – enthält den blockierenden Reihenfolgefehler (Zeilen 158-159) |
| `services/bestPayComparisonService.ts` | Sitzungs-CRUD, Berechtigungen, `updateManualInput` | **ja** |
| `repositories/supabase/SupabaseBestPayComparisonRepository.ts` | Persistenz, `setActiveSessionId` | **ja** |
| `services/bestPayComparisonStorageMigration.ts` | Normalisierung beim Lesen | **ja** |
| `domain/bestPayComparison/costCaptureMode.ts` | drei Modi + Validierung; nachweislich korrekt | **ja** |
| `domain/bestPayComparison/comparisonSummary.ts` | `resolveCurrentMonthlyCosts`, Baseline-Vorrang (Zeilen 90-98) | **ja** |
| `domain/pricingEngine/*`, `services/pricingEvaluationService.ts` | Preisberechnung | **ja** |
| `domain/recommendationEngine/*`, `services/recommendationService.ts` | Variantenbildung, Scoring | **ja** |
| `services/pricingCatalogMigration.ts`, `productCatalogMigration.ts`, `repositories/supabase/SupabasePricingCatalogRepository.ts`, `SupabaseProductRepository.ts`, `SupabaseTariffRepository.ts` | Katalogzugriff | **ja** |
| `services/billingImportService.ts` (952 Zeilen), `billingImportViews.ts`, `billingSessionFileStore.ts`, `billingDocumentSessionState.ts`, `domain/billingImportEngine/*` | OCR-Pipeline | **nein** – optional, bereits per Lazy-Import getrennt |
| `services/paymentComparisonService.ts`, `domain/calculator/*` | Vorgänger des Wizards | **nein** – Altlast |
| `services/salesTaskService.ts`, `salesActivityService.ts` | Aufgaben/Aktivitäten | nein |

### UI

| Datei | unverzichtbar |
|---|---|
| `v2/advice/AdviceEntry.tsx`, `AdviceWizardPage.tsx`, `AdviceHubPage.tsx` | **ja** |
| `v2/advice/useAdviceSession.ts` | **ja** – enthält den fehlenden `.catch` (Zeilen 54-93) |
| `v2/advice/formatters.ts` | **ja** – enthält den Dezimalfehler (Zeilen 8-22) |
| `v2/advice/steps/ProspectStep`, `CostsStep`, `NeedStep`, `RecommendationStep`, `OfferStep` | **ja** |
| `v2/advice/steps/ClosingStep.tsx` | nein (Nachfassen/BestPay-Übergabe) |
| `features/offer/OfferBillingImportSection.tsx` | nein (nur im Modus `billing_import`) |

### Routen

`/advice` ist die einzige nötige Route. Die sechs Altpfade (`/advice/quick`, `/sales/wizard`, `/calculator*`) sind reine Redirects.

### Frontend-Assets

`public/ocr/**` (Tesseract-Worker, Core, `deu`/`eng`-Sprachdaten) – live und in der APK vorhanden, HTTP 200. Nur für den optionalen Importmodus.

### Blockierende Lücke

Genau eine: die Schreibreihenfolge in `salesWizardService.persistWizardSession` gegen `user_active_sessions_comparison_session_id_fkey`. Ohne diese Korrektur ist der gesamte Beratungspfad und alles Nachfolgende unerreichbar.

## 9.3 Angebot

*Aus der Beratung ein Angebot erzeugen; Angebotsstatus pflegen.*

### Tabellen

| Tabelle | Rolle | unverzichtbar |
|---|---|---|
| `offers` | Angebot; führt `status` **und** `workflowStatus` parallel | **ja** |
| `offer_versions` | Versionssnapshot mit eigenem `workflowStatus` | **ja** (`createOffer` erzeugt sie zwingend) |
| `leads` | `createOffer` erfordert zwingend `leadId` | **ja** |
| `best_pay_comparison_sessions` | Quelle der Empfehlung | **ja** |
| `offer_workflow_events` | Audit der Statusübergänge | nein |
| `offer_documents` | PDF | **nein** |
| `offer_share_links`, `offer_customer_questions`, `offer_change_requests`, `offer_customer_acceptances` | Kundenlink und Rückkanal | **nein** |
| `bestpay_handoffs`, `sales_documents` | Übergabe/Dokumente | **nein** – 0 Zeilen |
| `approval_rules`, `pricing_evaluations` | Freigabe | **nein** – Freigabepflicht ist faktisch inaktiv |

### Services

| Datei | unverzichtbar |
|---|---|
| `services/offerService.ts`, `offerValidation.ts` | **ja** |
| `services/offerVersionService.ts` | **ja** (`ensureInitialVersion`) |
| `services/offerWorkflowService.ts` + `offerWorkflowStorageMigration.ts` | **ja** (Statuspflege) |
| `repositories/supabase/SupabaseOfferRepository.ts`, `SupabaseOfferVersionRepository.ts`, `SupabaseOfferWorkflowEventRepository.ts` | **ja** |
| `services/offerPdfRenderer.ts`, `offerDocumentService.ts`, `offerDocumentValidation.ts`, `offerDocumentStorageMigration.ts` | nein |
| `services/offerShareService.ts`, `offerAcceptanceService.ts`, `offerChangeRequestService.ts`, `offerCustomerQuestionService.ts` | nein |
| `services/bestPayHandoffService.ts` | nein |
| `services/approvalRuleService.ts` | nein |
| `workers/amrtech-payment` Route `/api/public/offers/:token` | nein |

### Routen

| Route | unverzichtbar |
|---|---|
| `/offers` | **ja** |
| `/offers/:id` (Detail + Workflow) | **ja** – enthält 8 Legacy-Sections, davon nur die Workflow-Section nötig |
| `/offers/new`, `/offers/:id/edit` | nein (manuelle Angebotserstellung außerhalb der Beratung) |
| `/offers/:id/preview`, `/offers/:offerId/documents/:documentId` | nein |
| `/offer-review/:token` | nein |

### RLS-Funktionen

`can_access_offer(text)`

### Blocker im Ist-Zustand

`createOffer` verlangt `leadId`, obwohl die Beratung anonym gerechnet werden darf (Dok. 05, A2). Blockierende Pricing-Findings werden als `ok: true` gemeldet (A3). Drei persistierte Statusmodelle, davon eines (`Offer.status`) fachlich informationslos (A4).

## 9.4 Provision

*Außendienst sieht eigene Provision; Admin verwaltet Standardprovision und individuelle Vereinbarungen.*

### Tabellen

| Tabelle | Rolle | unverzichtbar |
|---|---|---|
| `commission_plans` (2) | Provisionsplan | **ja** |
| `commission_rules` (15) | Standardregeln | **ja** – hat **kein** Zielfeld für `displaySharePercent` der UI |
| `commission_assignments` (3) | Zuordnung Vertreter → Plan | **ja** |
| `commission_assignment_versions` (3) | individuelle Overrides; Schreibpfad funktioniert nachweislich | **ja** |
| `commission_cases` (**0**) | Provisionsfälle – Datenquelle von „Meine Provision" | **ja** |
| `commission_calculations` (**0**) | eingefrorene Berechnung, entsteht über `freezeCalculation` | **ja** |
| `commission_plan_versions` (2) | Planversionen | nein |
| `commission_events` (3) | Audit | nein |
| `commission_bonus_payments` (0) | Sonderzahlungen | **nein** |
| `commission_payment_history` (0) | Auszahlungen | **nein** |

### Services

| Datei | unverzichtbar |
|---|---|
| `services/commissionAdminService.ts` (`getSalesOverview`, `getOverview`) | **ja** |
| `services/commissionCatalogAdminService.ts` (Zeilen 232-270 = Schreibpfad Standardregeln) | **ja** |
| `services/commissionCalculationService.ts` (`freezeCalculation`) | **ja** |
| `domain/commissionEngine/*`, `domain/commission/*` | **ja** |
| `repositories/supabase/SupabaseCommissionCatalogRepository.ts`, `SupabaseCommissionWorkflowRepository.ts`, `SupabaseCommissionCalculationRepository.ts` | **ja** |
| `services/commissionCatalogSeed.ts`, `commissionCatalogMigration.ts`, `commissionShareMigration.ts`, `commissionCalculationStorageMigration.ts` | **ja** (Bootstrap/Normalisierung) |
| `services/commissionCalculationViews.ts` | ja (Aufbereitung) |

### UI

| Datei | Zustand |
|---|---|
| `v2/commission/SalesCommissionPage.tsx` | v2 nativ, funktioniert – zeigt nur nichts an, weil `commission_cases` leer ist |
| `v2/commission/CommissionStandardsPage.tsx` | **v2-Shell** um `features/admin/commission/AdminCommissionModelsPage.tsx` und `AdminCommissionAssignmentsPage.tsx` |
| `features/admin/commission/AdminCommissionModelsPage.tsx` | Legacy; Formular ab Zeile 259 **nach** der Tabelle; rohe `<button>`; `displaySharePercent` wird nicht persistiert |
| `features/admin/commission/AdminCommissionAssignmentsPage.tsx` | Legacy; Formular ab Zeile 275 nach der Tabelle |
| `features/admin/commission/AdminCommissionCasesPage.tsx`, `…BonusPage`, `…SettlementPage`, `…OverviewPage`, `AdminCommissionLayout.tsx` | Legacy; Fälle/Bonus/Abrechnung nicht Kern |

### Routen

| Route | unverzichtbar |
|---|---|
| `/sales/commission` | **ja** |
| `/admin/commission/standards` | **ja** |
| `/admin/commission/overview` | ja |
| `/admin/commission`, `/admin/commission/cases`, `/bonus`, `/settlement` + 4 Redirects | nein |

### RLS-Funktionen

`is_active_commission_user()`, `can_access_commission_case(text)`, `owns_commission_rep(text)`

### Blockierende Lücke

`commission_cases` bleibt leer, solange kein Angebot aus der Beratung entsteht. Die Provision hängt damit vollständig am Beratungspfad (9.2). Zusätzlich: `displaySharePercent` wird validiert, aber nicht gespeichert (Dok. 06, P2).

## 9.5 Administration

*Admin verwaltet Stammdaten und Provision.*

### Tabellen

| Tabelle | unverzichtbar |
|---|---|
| `profiles` | **ja** (Benutzer, Rollen, Status) |
| `products` (19), `tariffs` (2), `contract_terms` (2) | **ja** |
| `price_books` (1), `price_book_versions` (1), `price_rules` (3) | **ja** |
| Provisionstabellen | siehe 9.4 |
| `approval_rules`, `document_templates`, `audit_entries`, `system_keepalive` | nein |
| `export_history`, `backup_history`, `data_migration_runs` | **nein** – alle 0 Zeilen |

### Services

| Datei | unverzichtbar |
|---|---|
| `services/adminUserService.ts`, `adminUserApiClient.ts` | **ja** (Worker-API mit Service-Role) |
| `services/productService.ts`, `productValidation.ts` | **ja** |
| `services/pricingEvaluationService.ts` + Katalog-Repos | **ja** |
| `services/productionCatalogBootstrapService.ts` | ja (Erstbefüllung) |
| `services/adminOverviewService.ts` | ja (Übersichtskacheln) |
| `services/approvalRuleService.ts`, `documentTemplateService.ts`, `auditService.ts`, `systemStatusService.ts`, `dataExportService.ts`, `dataDiagnosticService.ts`, `supabaseDataMigrationService.ts`, `demoDataService.ts` | nein |

### Routen

| Route | unverzichtbar |
|---|---|
| `/admin` | ja |
| `/admin/users` | **ja** |
| `/admin/catalog` | **ja** (Produkte, Tarife, Preisregeln) |
| `/admin/pricing` | **ja** (Preisbuchversion) |
| `/admin/products/manage/new`, `/admin/products/manage/:id/edit` | ja |
| `/admin/tariffs/new`, `/admin/tariffs/:id/edit` | ja |
| `/admin/commission/standards`, `/admin/commission/overview` | ja (9.4) |
| `/admin/roles`, `/approvals`, `/templates`, `/data`, `/audit`, `/system` + 3 Redirects | nein |

### Trigger und Funktionen

`profiles_privilege_guard` (Trigger) mit `enforce_profile_privilege_guard()`, `is_admin()`, `mark_profile_active_on_login()`

## 9.6 Querschnitt: unverzichtbare Infrastruktur

| Baustein | Rolle |
|---|---|
| `src/app/router.tsx`, `RequireAuth`, `RequireRole` | Routing und Zugriffsschutz |
| `src/v2/layout/AppShell.tsx` + `AppShell.module.css` | Rahmen, Navigation, Safe Areas (Token derzeit wirkungslos, Dok. 02) |
| `src/v2/ui/*` (`Button`, `FormField`, `Dialog`, `ResponsiveTable`, `StatusBadge`, `Card`, …) | v2-Designsystem |
| `src/v2/styles/tokens.css`, `breakpoints.css` | Tokens (in `features/` nur teilweise genutzt) |
| `src/services/supabaseAuthService.ts`, `src/config/appRuntimeConfig.ts` | Anmeldung, Laufzeitkonfiguration |
| `src/repositories/supabase/createOperationalRepositories.ts`, `supabaseTable.ts` | Repository-Verdrahtung |
| `src/domain/permission/*` | Rollenmatrix |
| `workers/amrtech-payment` | Auslieferung + Admin-Benutzer-API |
| `workers/amrtech-payment-downloads` | APK und `latest.json` |
| `src/domain/appUpdate/*`, `services/appUpdateService.ts` | Updateprüfung im APK |

## 9.7 Vollständig außen vor

| Bereich | Umfang | Belegter Grund |
|---|---|---|
| Verträge | 3 Tabellen, `services/contractService.ts` + Migration, 3 Repositories, 2 Routen, `v2/contract/*` | 0 Zeilen in allen Tabellen; kein Kernbezug |
| Aktivierung | 5 Tabellen, `services/activationService.ts` + Migration, 5 Repositories, 2 Routen, `v2/activation/*` | 0 Zeilen in allen Tabellen |
| Abrechnungsimport / OCR | 6 Tabellen, `billingImportService.ts` (952 Zeilen) + 4 Hilfsmodule, `domain/billingImportEngine/*`, `features/offer/OfferBillingImportSection` | optional; einzige Kopplung ist `session.costBaselineId`; bereits Lazy-Import |
| PDF und Kundenlink | 5 Tabellen, 6 Services, 3 Routen, Worker-Endpunkt | funktioniert, aber nicht Teil des Kerns |
| Provisionsfälle-Verwaltung, Bonus, Abrechnung | 3 Tabellen, 3 Routen, 4 Legacy-Panels | 0 Zeilen; Kern braucht nur die Außendienstsicht |
| Freigabe / Approval | `approval_rules`, `pricing_evaluations`, `approvalRuleService.ts`, `/admin/approvals` | `pricing_evaluations` leer → Pflicht faktisch inaktiv |
| Daten/Export/Backup/Migration | 3 Tabellen, 4 Services, 1 Route | alle Tabellen leer |
| Vorlagen, Audit, System, Rollenanzeige | 4 Tabellen, 4 Services, 4 Routen | nur Anzeige, kein Kernbezug |
| Arbeitsplatz / Tagesarbeit | `sales_tasks` (0), `sales_activities`, `salesWorkspaceService.ts`, `salesDayWorkspace.ts`, `/sales` | enthält keine Kundenliste; `sales_tasks` strukturell leer |
| Alter Rechner | `paymentComparisonService.ts`, `domain/calculator/*`, 5 Redirect-Routen | vollständig durch `salesWizardService` ersetzt |
| Demo-/Local-Datenpfad | 37 `Local*Repository`, `demoDataService.ts` | nur für Tests; **gleichzeitig die Ursache der Testblindheit** (Dok. 08) |

## 9.8 Kritische Pfadkette

Die zehn Kernfunktionen hängen in genau einer Reihenfolge zusammen:

| Stufe | Voraussetzung | Ist-Zustand |
|---|---|---|
| 1 | Kunde existiert und ist zugewiesen | **teilweise** – Kunden existieren, Zuweisung ist in der UI nicht möglich |
| 2 | Beratung persistiert die Sitzung | **blockiert** – FK-Fehler, 0 Zeilen |
| 3 | Kosten manuell oder 0 € erfassbar | blockiert durch Stufe 2, zusätzlich Dezimalfehler |
| 4 | Empfehlung berechenbar | Katalog vollständig, aber Stufe 2 blockiert |
| 5 | Angebot erzeugbar (`offers` + `offer_versions`) | blockiert durch Stufe 2; zusätzlich `leadId`-Pflicht |
| 6 | Angebotsstatus pflegbar | funktionsfähig, aber ohne Angebote wirkungslos |
| 7 | Provisionsberechnung einfrieren (`commission_calculations`) | blockiert durch Stufe 5 |
| 8 | Provisionsfall entsteht (`commission_cases`) | blockiert durch Stufe 7 |
| 9 | Außendienst sieht Provision | funktionsfähig, aber strukturell leer |
| 10 | Admin verwaltet Stammdaten und Provision | funktionsfähig mit Einschränkungen (P2, P3) |

**Sieben von zehn Kernfunktionen sind Folgefehler einer einzigen blockierten Stufe.** Stufe 2 ist der Engpass. Die Stufen 1, 6, 9 und 10 sind unabhängig davon reparaturbedürftig, aber nicht blockiert.

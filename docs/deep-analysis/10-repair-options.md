# 10 – Reparierbarkeit: Bewertung der Optionen A–D

Bewertung ausschließlich anhand der Dokumente 01–09. **Keine Empfehlung, keine Roadmap, keine Implementierung.**

## 10.0 Codebasis als Bezugsgröße

| Bereich | Dateien | Codezeilen |
|---|---|---|
| `src/services` | 84 | 23.948 |
| `src/domain` | 223 | 22.959 |
| `src/features` (Legacy) | 95 | 12.520 |
| `src/v2` | 80 | 11.607 |
| `src/repositories` (Supabase + Local + Interfaces) | 120 | 5.937 |
| `src/components` (Legacy-Basis) | 39 | 2.368 |
| `src/app` | 13 | 517 |
| **Produktivcode gesamt** | **654** | **79.856** |
| `src/test` | 163 | 24.264 |
| `e2e` | 5 | 655 |
| `workers` | 4 | 1.361 |

Aufwandsangaben sind Personentage (PT) einer Person mit Projektkenntnis, inklusive Test und Verifikation, ohne Deploy und Abnahme.

## 10.1 Befundliste als gemeinsame Grundlage

Alle vier Optionen müssen dieselben Befunde adressieren. Unterschiedlich ist nur, **wie**.

| ID | Befund | Schwere | Quelle |
|---|---|---|---|
| **F1** | `persistWizardSession` schreibt `user_active_sessions` vor `best_pay_comparison_sessions` → FK-Verletzung, Beratung nicht persistierbar | **blockierend** | Dok. 04 B1 |
| **F2** | Kein `.catch` in `ensurePersisted`/`withPersist`, alle UI-Aufrufe sind `void` → Fehler unsichtbar | **blockierend** | Dok. 04 B2 |
| **F3** | `centsToInput`/`parseEuroToCents` als kontrolliertes Paar → Dezimaleingabe unmöglich | hoch | Dok. 04 B3 |
| **F4** | Ein Serverumlauf pro Tastendruck, keine Entprellung, kein Merge-Schutz → Race | hoch | Dok. 04 B4 |
| **F5** | `disabled={busy}` an Feldern und Modusbuttons → Fokusverlust | mittel | Dok. 04 B5 |
| **F6** | `getSession` lädt alle Sitzungen, `save` liest vor jedem Schreiben | mittel | Dok. 04 B6 |
| **F7** | Kein Betreuerfeld in `NewLeadPage`/`EditLeadPage` → Zuweisung in der UI unmöglich | **blockierend für Kernfunktion 2** | Dok. 03 |
| **F8** | Drei unterschiedliche Rollenfilter: `leadService` (nur `assignedSalesUserId`), `salesWorkspaceService` (+ `createdByUserId`), RLS (+ `createdByUserId`) | hoch | Dok. 03 3.4 |
| **F9** | `/sales` rendert nur `dayWork`; `sales_tasks` = 0 Zeilen → Startbildschirm strukturell leer; `searchHits` berechnet, aber nicht gerendert | hoch | Dok. 03, Dok. 02 |
| **F10** | „Team"-Filter ist ein Admin-Alles-Schalter ohne Teammodell; `profiles.sales_team_id` überall NULL | mittel | Dok. 03 3.6 |
| **F11** | `normalizeLead` setzt bei fehlendem JSONB-Feld die Demo-ID `user_001` | mittel | Dok. 03, Dok. 07 |
| **F12** | `createOffer` erzwingt `leadId` | mittel | Dok. 05 A2 |
| **F13** | Blockierende Pricing-Findings werden als `ok: true` zurückgegeben | mittel | Dok. 05 A3 |
| **F14** | Drei persistierte Statusmodelle, `Offer.status` informationslos | mittel | Dok. 05 A4 |
| **F15** | `displaySharePercent` bei Standardregeln validiert, aber nicht persistiert | hoch | Dok. 06 P2 |
| **F16** | Bearbeitungsformulare aller drei Provisionspanels im DOM nach der Tabelle, ohne Scroll/Fokus | hoch | Dok. 06 P3, Dok. 02 |
| **F17** | Rohe, ungestylte `<button>` in 25 Dateien (~98 Vorkommen) → abweichende Höhen | mittel | Dok. 02 |
| **F18** | `min-width: 36rem` in drei Tabellen-CSS-Dateien + `orientation: portrait` → Mobilüberlauf ohne Ausweg | hoch | Dok. 02 |
| **F19** | `viewport-fit=cover` fehlt in `index.html` → Safe-Area-Tokens wirkungslos | mittel | Dok. 02 2.10 |
| **F20** | Zwei Buttonsysteme, zwei Tabellensysteme, zwei Dialogsysteme, drei Formularlayouts | mittel | Dok. 02 |
| **F21** | 13 v2-Seiten sind Shells um Legacy-Inhalte | mittel | Dok. 02 |
| **F22** | Kein Test läuft gegen eine Datenbank; Overflow-Assertion in jsdom strukturell wirkungslos; `matchMedia` immer Desktop | **blockierend für Verifizierbarkeit** | Dok. 08 |
| **F23** | Kein FK `leads.assigned_sales_user_id → profiles.user_id`, kein Index darauf | niedrig | Dok. 07 |
| **F24** | `user_active_sessions` ist eine reine Komforttabelle mit hartem, nicht-deferrable FK | mittel | Dok. 07 |
| **F25** | Testmüll in Produktion: Lead „2", `lead_test_p1b_smoke_20260802`, 1 Testangebot, 1 Testimportsitzung | niedrig | Dok. 03, Dok. 07 |
| **F26** | Alle 3 Kunden gehören dem Admin, der Außendienst-Account hat 0 Kunden | Datenlage | Dok. 03 |

### Negativbefunde – hier besteht nachweislich **kein** Reparaturbedarf

| Bereich | Beleg |
|---|---|
| 0-€-Validierung und Kostenmodus-Logik | `costCaptureMode.ts:27-64`, Test `costCaptureMode.test.ts:35-47` (Dok. 04 B9) |
| OCR-Assets und Auslieferung | live HTTP 200, in APK enthalten (Dok. 04 B10) |
| Produktionskatalog | Preisbuchversion `published`, 2 Tarife, 19 Produkte, 2 Laufzeiten, 3 Preisregeln aktiv (Dok. 05 A7) |
| Schreibpfad individuelle Provisionsvereinbarungen | Datensatz vom 04.08. mit 4 Overrides; Admin-RLS erlaubt Schreiben (Dok. 06 P10) |
| Historisierung eingefrorener Berechnungen | Katalogänderungen berühren Altfälle nicht (Dok. 06 P11) |
| Asset-/Releasekonsistenz | dist = APK = Live, SHA-256 identisch mit `latest.json` (Dok. 02 2.10) |
| Datenbankgesundheit | keine RLS-Verweigerungen, keine anderen Constraint-Verletzungen, keine Timeouts im Log (Dok. 07 7.6) |
| PWA-/APK-Update-Mechanik | strenge Manifestvalidierung, korrektes Live-Manifest (Dok. 02 2.10) |

## 10.2 Option A – Kern auf bestehendem Stand reparieren

Alle Befunde werden in den vorhandenen Dateien behoben. Keine neuen Oberflächen, keine neuen Services, kein Schemaeingriff außer optionalen Ergänzungen.

### Notwendige Änderungen

| Nr. | Änderung | Betroffene Dateien | Betroffene Tabellen |
|---|---|---|---|
| A-1 | Schreibreihenfolge in `persistWizardSession` umstellen: `persist` vor `setActiveSessionId` (Vorbild: `bestPayComparisonService.ts:184-186`) | `services/salesWizardService.ts:152-162` | `best_pay_comparison_sessions`, `user_active_sessions` |
| A-2 | Fehlerbehandlung ergänzen: `.catch` in `ensurePersisted`/`withPersist`, `advice.error` setzen, Toast; UI-Aufrufe von `void` auf behandelte Promises umstellen | `v2/advice/useAdviceSession.ts:54-117`, `v2/advice/AdviceWizardPage.tsx:346-348,367,440,444` | – |
| A-3 | Eingabefelder auf unkontrollierten Textzustand mit Commit bei `blur`/Entprellung umstellen; `centsToInput`/`parseEuroToCents` entkoppeln | `v2/advice/formatters.ts:8-22`, `v2/advice/steps/CostsStep.tsx:72-85`, `NeedStep.tsx:46-98` | – |
| A-4 | Entprellung und Merge-Schutz in `withPersist` (analog `patchProspect`, Zeilen 145-157) | `v2/advice/useAdviceSession.ts:95-117` | – |
| A-5 | `disabled={busy}` von Eingabefeldern entfernen, an Modusbuttons differenzieren | `CostsStep.tsx:60,126` | – |
| A-6 | `getSession` auf gezielte Einzelabfrage umstellen; redundantes `getById` in `save` entfernen | `services/bestPayComparisonService.ts:171`, `repositories/supabase/SupabaseBestPayComparisonRepository.ts:62-68` | `best_pay_comparison_sessions` |
| A-7 | Betreuerfeld (Profilauswahl) in Anlage- und Bearbeitungsformular ergänzen | `v2/crm/LeadForm.tsx`, `NewLeadPage.tsx`, `EditLeadPage.tsx`, `services/leadService.ts`, `leadValidation.ts` | `leads`, `profiles` |
| A-8 | Rollenfilter vereinheitlichen: eine Filterfunktion für `leadService`, `salesWorkspaceService` und RLS-Semantik | `services/leadService.ts:218-224`, `services/salesWorkspaceService.ts:182-187`, ggf. RLS-Policy auf `leads` | `leads` |
| A-9 | Startbildschirm: Kundenliste rendern oder `/sales` auf `/leads` umleiten; `searchHits` rendern | `v2/workspace/WorkspacePage.tsx:116-136`, `services/salesDayWorkspace.ts:108-237` | `leads` |
| A-10 | „Team"-Filter entfernen oder als „Alle Kunden (Admin)" umbenennen | `v2/crm/LeadsPage.tsx`, `services/leadService.ts` | – |
| A-11 | Demo-Fallback `user_001` aus dem Produktionspfad entfernen | `domain/lead/normalizeLead.ts:133-135` | `leads` |
| A-12 | `leadId`-Pflicht in `createOffer` prüfen und – falls fachlich gewollt – Zwang lösen oder verständlich melden | `services/salesWizardService.ts:829-854`, `services/offerService.ts` | `offers`, `leads` |
| A-13 | Pricing-Findings korrekt als Fehler durchreichen statt `ok: true` | `services/pricingEvaluationService.ts`, `v2/advice/steps/RecommendationStep.tsx` | – |
| A-14 | Statusmodelle konsolidieren: `Offer.status` stilllegen oder ableiten | `services/offerService.ts`, `offerWorkflowService.ts`, `v2/offer/OfferDetailPage.tsx` | `offers`, `offer_versions` |
| A-15 | `displaySharePercent` bei Standardregeln persistieren (Zielfeld in `commission_rules.data` ergänzen) | `services/commissionCatalogAdminService.ts:232-270`, `features/admin/commission/AdminCommissionModelsPage.tsx:59-78` | `commission_rules` |
| A-16 | Provisionsformulare als Dialog/Drawer oder oberhalb der Tabelle mit `scrollIntoView` + Fokus | `AdminCommissionModelsPage.tsx:224-385`, `AdminCommissionAssignmentsPage.tsx:252-336`, `AdminCommissionCasesPage.tsx:93-167` | – |
| A-17 | Rohe `<button>` in den Provisionspanels auf `v2/ui/Button` umstellen | 3 Provisionsdateien (~15 Vorkommen); vollständige Bereinigung betrifft 25 Dateien / ~98 Vorkommen | – |
| A-18 | Mobiles Tabellenverhalten: `min-width: 36rem` durch Kartenlayout/Spaltenpriorität ersetzen; Aktionsspalte fixieren | `AdminLayout.module.css:95-98`, `components/common/ResponsiveTable.module.css:78-88`, `v2/ui/ResponsiveTable.module.css:109-119,40-42` | – |
| A-19 | `viewport-fit=cover` in `index.html` ergänzen | `index.html:7` | – |
| A-20 | UI-Systeme zusammenführen: ein Tabellensystem, ein Dialogsystem, ein Formularlayout | `components/common/ResponsiveTable.tsx` + `v2/ui/ResponsiveTable.tsx`, `ConfirmDialog.tsx` + `v2/ui/Dialog.tsx`, `FormField.tsx` (2 Varianten) | – |
| A-21 | Optional: FK und Index auf `leads.assigned_sales_user_id`; `user_active_sessions`-FK auf `DEFERRABLE` oder Entfernung | Migration | `leads`, `user_active_sessions` |
| A-22 | Testfundament: Integrationstests gegen lokale Postgres-Instanz, Playwright-Mobile-Projekte mit Overflow-Assertion, realistischer `matchMedia`-Mock, Round-Trip-Tests | `src/test/setup.ts:36-47`, `v2ResponsiveViewport.test.tsx`, `playwright.config.ts`, neue Specs (T1–T8 aus Dok. 08) | alle Kerntabellen |

### Wiederverwendbar ohne Änderung

Preis- und Empfehlungsengine (`domain/pricingEngine`, `domain/recommendationEngine`, ~9.000 Zeilen), Provisionsengine (`domain/commissionEngine`), gesamter Katalogzugriff, Auth, Worker, Update-Mechanik, 17 Kerntabellen, alle RLS-Policies und Helper-Funktionen.

### Risiko

| Risiko | Bewertung |
|---|---|
| A-1 ist eine Zweizeilen-Umstellung mit sofort messbarem Effekt (Zeilen in `best_pay_comparison_sessions` > 0) | **niedrig** |
| A-3/A-4 greifen in den Eingabefluss aller Eurofelder ein; Regressionsgefahr in `NeedStep`, `CostsStep` und allen Formularen mit `centsToInput` | **mittel** |
| A-8 ändert Sichtbarkeitssemantik; falsche Vereinheitlichung kann Kunden ausblenden oder fremde Kunden zeigen | **mittel–hoch** |
| A-14 berührt drei persistierte Statusfelder mit bestehenden Daten (1 Angebot, 1 Version) | **mittel** |
| A-18/A-20 sind flächige CSS-/Komponentenumstellungen über 33 Feature-CSS-Module | **mittel–hoch** |
| A-22 ist Vorbedingung für die Verifizierbarkeit aller übrigen Punkte; ohne sie bleibt jede Reparatur unbelegt | **hoch, wenn ausgelassen** |
| Grundrisiko: 79.856 Zeilen Produktivcode bleiben in Betrieb, darunter ~70 % ohne Kernbezug – jede Änderung findet in einem großen, teils Legacy-Umfeld statt | **mittel** |
| Gegenrisiko: keine Datenmigration, keine Schemaänderung zwingend, kein Verlust bestehender Funktionen (PDF, Kundenlink, Verträge bleiben unberührt) | **senkend** |

### Aufwand

| Block | PT |
|---|---|
| A-1, A-2 (Beratung entsperren + Fehlersichtbarkeit) | 1–2 |
| A-3 bis A-6 (Eingabe, Entprellung, Performance) | 3–5 |
| A-7 bis A-11 (Kunden, Zuweisung, Filter, Startbildschirm) | 4–6 |
| A-12 bis A-14 (Angebot) | 3–5 |
| A-15, A-16, A-17 (Provision) | 3–5 |
| A-18 bis A-20 (UI-System, Mobil) | 6–10 |
| A-21 (Migration, optional) | 0,5–1 |
| A-22 (Testfundament T1–T8 + Infrastruktur) | 6–9 |
| **Summe** | **26–43 PT** |

Minimalvariante nur zur Entsperrung des Kerns (A-1 bis A-9, A-15, A-16, A-22 reduziert auf T1–T5): **12–18 PT**.

## 10.3 Option B – Kern mit neuen, kleinen Oberflächen auf bestehenden Services

Die Serviceschicht bleibt vollständig erhalten. Neu gebaut werden ausschließlich die Kernoberflächen; die defekten Legacy- und Shell-Seiten werden aus dem Routing genommen.

### Notwendige Änderungen

| Nr. | Änderung | Umfang |
|---|---|---|
| B-1 | Serviceseitige Blocker beheben – identisch zu A-1, A-6, A-11, A-12, A-13, A-15 | `salesWizardService.ts`, `bestPayComparisonService.ts`, `SupabaseBestPayComparisonRepository.ts`, `normalizeLead.ts`, `offerService.ts`, `pricingEvaluationService.ts`, `commissionCatalogAdminService.ts` |
| B-2 | Filterlogik einmalig zentralisieren (A-8) | `leadService.ts`, `salesWorkspaceService.ts` |
| B-3 | Neue Kundenoberfläche: Liste, Anlage, Bearbeitung **mit Betreuerfeld**, Detail | ~4 neue Seiten auf `leadService` |
| B-4 | Neue Beratungsoberfläche: 5 Schritte, mit korrektem Eingabemuster (unkontrolliert + Commit) und Fehleranzeige von Beginn an | ~6 neue Komponenten auf `salesWizardService` |
| B-5 | Neue Angebotsoberfläche: Liste, Detail mit Statuspflege | ~2 neue Seiten auf `offerService`/`offerWorkflowService` |
| B-6 | Neue Provisionsoberflächen: Außendienstsicht, Standardregeln, Mitarbeiterwerte | ~3 neue Seiten auf `commissionAdminService`/`commissionCatalogAdminService` |
| B-7 | Neue Adminoberflächen für Stammdaten oder Wiederverwendung der funktionierenden Legacy-Seiten (`/admin/catalog`, `/admin/pricing`, `/admin/users` sind funktional belegt) | Entscheidung pro Seite |
| B-8 | Ein Tabellen-/Dialog-/Formularsystem für die neuen Seiten; mobil zuerst, ohne `min-width: 36rem` | `v2/ui/*` erweitern |
| B-9 | `viewport-fit=cover` (A-19) | `index.html` |
| B-10 | 41 nicht benötigte Routen aus `router.tsx` entfernen oder auf einen Hinweis leiten | `src/app/router.tsx` (132 Zeilen) |
| B-11 | Testfundament wie A-22, zusätzlich E2E gegen die neuen Oberflächen | `src/test`, `e2e` |

### Wiederverwendbare Teile

| Baustein | Zeilen | Zustand |
|---|---|---|
| `src/services` (19 Kernservices) | Teil von 23.948 | funktionsfähig nach B-1 |
| `src/domain` (Pricing-, Recommendation-, Commission-Engine, Normalisierung) | Teil von 22.959 | unverändert nutzbar, durch ~104 Domänentests abgedeckt |
| `src/repositories` (11 Supabase-Repositories) | Teil von 5.937 | unverändert nutzbar |
| Supabase-Schema, 17 Kerntabellen, RLS, Helper-Funktionen | – | unverändert nutzbar |
| `v2/ui` Basiskomponenten, `AppShell`, Tokens | Teil von 11.607 | Basis für neue Seiten |
| Auth, Worker, Update-Mechanik, OCR-Assets | – | unverändert nutzbar |
| **Nicht mehr genutzt** | `src/features` 12.520 Zeilen (95 Dateien), 13 v2-Shells, `paymentComparisonService` + `domain/calculator`, Vertrags-/Aktivierungs-UI | bleibt im Repository, aus dem Routing entfernt |

### Risiko

| Risiko | Bewertung |
|---|---|
| Serviceschicht bleibt bewiesen funktionsfähig (Katalog, Engines, Provisionsschreibpfad, Historisierung) | **senkend** |
| Neue Oberflächen umgehen die vier UI-Ursachengruppen (F16–F21) statt sie zu sanieren | **senkend** |
| Servicesignaturen sind auf den Wizard zugeschnitten (`salesWizardService` 962 Zeilen mit eigener Schrittlogik); neue UI muss diesem Modell folgen oder es anpassen | **mittel** |
| Doppelte Wahrheiten in den Domänenobjekten (`manualInput` ↔ `prospectDraft` ↔ `Scenario.config` ↔ Baseline) bleiben bestehen | **mittel** |
| Zwei parallele Oberflächenwelten während der Umstellung, falls nicht konsequent umgeroutet | **mittel** |
| `src/features` bleibt als toter Code im Repository, Tests darauf laufen weiter grün und täuschen Abdeckung vor | **mittel** |
| Kein Schema-, kein Datenrisiko | **senkend** |

### Aufwand

| Block | PT |
|---|---|
| B-1, B-2 (Serviceblocker) | 3–5 |
| B-3 (Kunden, 4 Seiten) | 4–6 |
| B-4 (Beratung, 6 Komponenten) | 7–10 |
| B-5 (Angebot, 2 Seiten) | 3–4 |
| B-6 (Provision, 3 Seiten) | 4–6 |
| B-7 (Admin: Wiederverwendung + Anpassung) | 2–4 |
| B-8, B-9 (UI-Basis, mobil) | 4–6 |
| B-10 (Routing entschlacken) | 1–2 |
| B-11 (Tests + E2E) | 7–10 |
| **Summe** | **35–53 PT** |

## 10.4 Option C – Kern mit neuen Oberflächen und neuen kleinen Services auf bestehender DB

Schema und Daten bleiben unverändert. Neu gebaut werden Oberflächen **und** eine schlanke Service-/Zugriffsschicht direkt auf den 17 Kerntabellen. Die vorhandenen 84 Services und 39 Repositories werden für den Kern nicht mehr verwendet.

### Notwendige Änderungen

| Nr. | Änderung | Umfang |
|---|---|---|
| C-1 | Neue schlanke Zugriffsschicht für 17 Tabellen, ohne Local/Supabase-Doppelstruktur und ohne JSONB-Spiegelung als Anwendungslogik | ~17 Module |
| C-2 | Beratungslogik neu: Schrittmodell, Validierung, Sitzungsschreibung in korrekter Reihenfolge | ersetzt `salesWizardService` (962 Zeilen) |
| C-3 | Preis- und Empfehlungsberechnung **wiederverwenden** – `domain/pricingEngine` und `domain/recommendationEngine` sind reine Funktionen mit ~104 Domänentests | Adapter statt Neubau |
| C-4 | Provisionsberechnung **wiederverwenden** – `domain/commissionEngine` ebenso | Adapter |
| C-5 | Neue Oberflächen für Kunden, Beratung, Angebot, Provision, Admin | wie B-3 bis B-7 |
| C-6 | Ein einziges UI-System, mobil zuerst | wie B-8 |
| C-7 | Datenzugriff muss die bestehende JSONB-/Spalten-Doppelung korrekt bedienen, sonst divergieren `data` und Spalten | ~17 Module |
| C-8 | RLS-Semantik im neuen Zugriff exakt nachbilden (`can_access_lead`, `can_access_offer`, `owns_commission_rep`, `is_admin`) | Zugriffsschicht |
| C-9 | Routing auf 21 Kernrouten reduzieren | `router.tsx` |
| C-10 | Testfundament neu aufbauen, inklusive Integrationstests gegen echte Postgres-Instanz | `src/test`, `e2e` |

### Wiederverwendbare Teile

| Baustein | Bewertung |
|---|---|
| Supabase-Schema, 17 Kerntabellen, alle RLS-Policies, 7 Helper-Funktionen, 1 Trigger | **vollständig** |
| Produktionsdaten (2 Profile, 3 Kunden, vollständiger Katalog) | **vollständig, keine Migration** |
| `domain/pricingEngine`, `domain/recommendationEngine`, `domain/commissionEngine`, `domain/shared` | **vollständig** – reine Funktionen, hoher Testschutz |
| `domain/bestPayComparison/costCaptureMode.ts`, `comparisonSummary.ts` | **vollständig** – nachweislich korrekt |
| Auth (`supabaseAuthService`), Worker, Update-Mechanik, OCR-Assets | **vollständig** |
| `v2/ui`-Basiskomponenten, Tokens | teilweise |
| **Nicht mehr genutzt** | 84 Services (23.948 Zeilen) bis auf Auth, 39 Supabase- + 37 Local-Repositories (5.937 Zeilen), `src/features` (12.520 Zeilen), 163 Testdateien (24.264 Zeilen) |

### Risiko

| Risiko | Bewertung |
|---|---|
| Kein Schema-, kein Datenrisiko; bestehende Daten bleiben unangetastet | **senkend** |
| Die Rechenkerne mit dem höchsten Testschutz bleiben erhalten | **senkend** |
| Die Doppelung Spalte ↔ `data jsonb` muss in der neuen Zugriffsschicht erneut korrekt bedient werden; ein Fehler dort erzeugt still divergierende Wahrheiten – dasselbe Muster, das `normalizeLead` heute den Demo-Fallback greifen lässt | **hoch** |
| RLS-Semantik muss exakt nachgebildet werden; Abweichung erzeugt genau die Filterwidersprüche, die heute schon bestehen | **hoch** |
| Der bestehende Testkorpus (24.264 Zeilen) wird für den Kern wertlos; ohne Neuaufbau existiert keine Absicherung | **hoch** |
| Zwei parallele Servicewelten im Repository, gemeinsame Datenbank – Schreibkonflikte möglich, solange alte Routen aktiv sind | **mittel–hoch** |
| Umfang: `salesWizardService` (962), `bestPayComparisonService` (828) und die zugehörigen Repositories müssen fachlich vollständig nachgebaut werden, inklusive Schrittvalidierung und Angebotserzeugung | **hoch** |

### Aufwand

| Block | PT |
|---|---|
| C-1, C-7, C-8 (Zugriffsschicht 17 Tabellen inkl. JSONB und RLS-Semantik) | 8–12 |
| C-2 (Beratungslogik neu) | 8–12 |
| C-3, C-4 (Adapter auf bestehende Engines) | 3–5 |
| C-5 (Oberflächen Kunden/Beratung/Angebot/Provision/Admin) | 18–26 |
| C-6 (UI-System) | 4–6 |
| C-9 (Routing) | 1–2 |
| C-10 (Testfundament neu) | 10–15 |
| **Summe** | **52–78 PT** |

## 10.5 Option D – Kern mit neuem minimalen Schema und Datenübernahme

Neues, minimales Schema ohne JSONB-Doppelung, neue Services, neue Oberflächen. Bestehende Daten werden übernommen.

### Notwendige Änderungen

| Nr. | Änderung | Umfang |
|---|---|---|
| D-1 | Neues Schema für den Kern: Kunden, Beratungssitzung, Katalog, Angebot, Provision – geschätzt 12–15 Tabellen mit echten Spalten statt `data jsonb` | Migration |
| D-2 | Echte Fremdschlüssel auf Benutzer (`profiles.user_id uuid`), einheitlicher ID-Typ statt `text`/`uuid`-Mischung | Migration |
| D-3 | Neue RLS-Policies und Helper-Funktionen für das neue Schema | Migration |
| D-4 | Indizes auf allen Filterfeldern (u. a. Betreuer) | Migration |
| D-5 | Datenübernahme: 2 Profile, 3 Kunden (davon 2 Testmüll), 2 Tarife, 19 Produkte, 2 Laufzeiten, 1 Preisbuch + 1 Version, 3 Preisregeln, 2 Provisionspläne, 15 Regeln, 3 Assignments, 3 Assignment-Versionen, 1 Angebot (Testdatensatz) | Migrationsskript |
| D-6 | Neue Services auf dem neuen Schema | ersetzt die Kernservices |
| D-7 | Preis-, Empfehlungs- und Provisionsengine **wiederverwenden** – reine Funktionen, benötigen nur neue Eingabeadapter | Adapter |
| D-8 | Neue Oberflächen für alle fünf Kernbereiche | wie C-5 |
| D-9 | Ein UI-System, mobil zuerst | wie B-8 |
| D-10 | Testfundament neu, inklusive Migrationstests | `src/test`, `e2e` |
| D-11 | Umgang mit dem Altschema: 58 Tabellen bleiben bestehen (Verträge, Aktivierung, OCR, PDF, Kundenlink hängen daran) oder werden stillgelegt | Entscheidung |

### Zu übernehmende Datenmenge

| Bereich | Zeilen |
|---|---|
| Profile | 2 |
| Kunden | 3 (davon 1 mit Firmenname „2", 1 explizit Testdatensatz) |
| Katalog (Tarife, Produkte, Laufzeiten, Preisbuch, Version, Regeln) | 28 |
| Provision (Pläne, Versionen, Regeln, Assignments, Assignment-Versionen, Events) | 28 |
| Angebot (Angebot, Version, Workflow-Events, Dokument, Sharelinks, Fragen, Änderungswunsch) | 12 |
| Beratungssitzungen | **0** |
| Provisionsfälle, Berechnungen, Verträge, Aktivierungen, OCR-Daten | **0** |
| **Gesamt fachlich relevant** | **~73 Zeilen** |

Die Datenübernahme ist damit trivial. `best_pay_comparison_sessions` = 0 Zeilen bedeutet: es existiert **keine** produktive Beratungshistorie, die migriert werden müsste.

### Risiko

| Risiko | Bewertung |
|---|---|
| Datenmenge minimal (~73 fachlich relevante Zeilen), keine Beratungshistorie, keine Provisionsfälle → Migrationsrisiko real gering | **senkend** |
| Neues Schema beseitigt die Ursachen F1, F11, F23, F24 strukturell (keine Kind-vor-Eltern-Falle, keine JSONB-Doppelung, echte FKs, Indizes) | **senkend** |
| Vollständiger Neubau von Schema, RLS, Services und UI – die einzige Option ohne belegte Bewährungsgrundlage in Produktion | **hoch** |
| Neue RLS-Policies sind ungetestet; die aktuelle RLS ist nachweislich fehlerfrei (keine Verweigerungen im Log) und würde aufgegeben | **hoch** |
| Bestehende Nebenfunktionen (PDF, Kundenlink mit 3 aktiven Sharelinks, öffentliche Angebotsansicht, OCR-Pipeline) hängen am Altschema und müssten entweder mitmigriert oder stillgelegt werden | **hoch** |
| Zwei Schemata in einer Datenbank während der Umstellung | **mittel–hoch** |
| Rückweg: Migration muss reversibel sein; Produktionsdatenbank enthält bereits Testmüll, der nicht mitgenommen werden sollte | **mittel** |
| Alle 25 bestehenden Migrationen bleiben in der Historie; das Schema wurde in zwei Tagen aufgebaut, eine erneute schnelle Modellierung birgt dasselbe Risiko | **mittel** |

### Aufwand

| Block | PT |
|---|---|
| D-1 bis D-4 (Schema, FKs, RLS, Indizes) | 5–8 |
| D-5 (Datenübernahme ~73 Zeilen) | 1–2 |
| D-6 (Services neu) | 12–18 |
| D-7 (Engine-Adapter) | 3–5 |
| D-8 (Oberflächen) | 18–26 |
| D-9 (UI-System) | 4–6 |
| D-10 (Tests inkl. Migrationstests) | 12–18 |
| D-11 (Altschema stilllegen oder parallel betreiben) | 2–5 |
| **Summe** | **57–88 PT** |

## 10.6 Vergleich

| Kriterium | A | B | C | D |
|---|---|---|---|---|
| Aufwand gesamt | **26–43 PT** | 35–53 PT | 52–78 PT | 57–88 PT |
| Aufwand bis Kern nutzbar (F1/F2 behoben) | **1–2 PT** | 3–5 PT | 8–12 PT | 18–25 PT |
| Schemaänderung | optional (A-21) | keine | keine | **vollständig** |
| Datenmigration | keine | keine | keine | ~73 Zeilen |
| Wiederverwendung Services | vollständig | vollständig | nur Engines | nur Engines |
| Wiederverwendung UI | vollständig (saniert) | nur `v2/ui`-Basis | nur `v2/ui`-Basis | nur `v2/ui`-Basis |
| Wiederverwendung Tests | vollständig + Ausbau | teilweise | gering | gering |
| Beseitigt UI-Doppelsysteme (F17–F21) strukturell | nein, nur durch Sanierung | **ja** | **ja** | **ja** |
| Beseitigt JSONB-Doppelwahrheit (F11, F24) strukturell | nein | nein | nein | **ja** |
| Beseitigt Filterwidersprüche (F8) strukturell | nein, durch Vereinheitlichung | teilweise | teilweise | **ja** |
| Behält bewährte RLS | **ja** | **ja** | ja (nachgebildet) | nein |
| Behält Nebenfunktionen (PDF, Kundenlink, OCR) | **ja** | ja (Routing) | teilweise | gefährdet |
| Toter Code danach | ~0 | 12.520 Zeilen `features` + Shells | ~66.000 Zeilen | ~66.000 Zeilen + Altschema |
| Höchstes Einzelrisiko | flächige CSS-/Komponentensanierung (A-18/A-20) | Servicemodell ist auf den alten Wizard zugeschnitten | JSONB- und RLS-Semantik erneut korrekt nachbilden | neues Schema und neue RLS ohne Bewährung |
| Verifizierbarkeit ohne A-22/B-11/C-10/D-10 | keine | keine | keine | keine |

### Gemeinsame Voraussetzung aller vier Optionen

**F22 (Testfundament) muss in jedem Fall behoben werden.** Ohne Integrationstests gegen eine echte Datenbank und ohne echte Layout-/Overflow-Prüfung ist bei jeder der vier Optionen nicht belegbar, ob der Kern funktioniert. Genau diese Lücke hat die aktuelle Lage erzeugt: 1073 grüne Tests bei einem in Produktion unbenutzbaren Kern. Der Aufwand dafür beträgt in allen Optionen 6–18 PT und ist in den Summen enthalten.

### Belastbare Feststellungen ohne Wertung

| Feststellung | Beleg |
|---|---|
| Ein einziger Reihenfolgefehler blockiert 7 von 10 Kernfunktionen. Seine Behebung kostet in Option A 1–2 PT. | Dok. 04 4.0, Dok. 09 9.8 |
| Die Datenbank ist gesund. Es gibt keinen Befund, der eine Schemaneuentwicklung technisch erforderlich macht. | Dok. 07 7.6, 7.7 |
| Die Rechenkerne (Pricing, Recommendation, Commission) sind in allen vier Optionen wiederverwendbar und durch ~104 Domänentests abgedeckt. | Dok. 09 |
| Der Produktionskatalog ist vollständig und veröffentlicht. Keine Option muss Stammdaten neu aufbauen. | Dok. 05 A7, Dok. 07 |
| Es existiert keine produktive Beratungshistorie (0 Sitzungen) und kein Provisionsfall (0 Fälle). Die Datenlage spricht gegen kein Vorgehen. | Dok. 07 7.2 |
| Die UI-Doppelsysteme (2 Buttonsysteme, 2 Tabellensysteme, 2 Dialogsysteme, 3 Formularlayouts, 13 v2-Shells) sind der Umfangstreiber in Option A und entfallen in B, C, D. | Dok. 02 2.9, 2.11 |
| ~70 % des Produktivcodes und des Schemas sind für den Kern nicht erforderlich. Nur Option A behält alles davon in Betrieb. | Dok. 09 9.0, 9.7 |
| APK, PWA und lokaler Build sind bit-identisch. Keine Option muss Plattformunterschiede behandeln; ein einzelnes fehlendes Meta-Attribut ist der einzige plattformspezifische Befund. | Dok. 02 2.10 |

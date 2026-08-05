# 07 – Datenbank-Gesamtinventur Supabase `vohnqrftkuefkugabcob`

Erhebung am 2026-08-04 über MCP (`list_tables`, `execute_sql`, `list_migrations`, `get_advisors`, `list_edge_functions`, `get_logs`).
**Keine Änderungen vorgenommen.** Alle Abfragen waren lesend.

## 7.1 Objektübersicht

| Objektart | Anzahl | Bemerkung |
|---|---|---|
| Tabellen (`public`) | **58** | alle mit `rls_enabled = true` |
| Views | **0** | keine |
| Funktionen (`public`) | **13** | alle Helper für RLS bzw. Keepalive |
| RPCs (extern aufrufbar) | 13 | identisch mit den Funktionen, via `/rest/v1/rpc/*` |
| Trigger (nicht intern) | **1** | `profiles_privilege_guard` auf `profiles` |
| Storage Buckets | **0** | keine |
| Edge Functions | **0** | keine |
| Realtime-Publikation | **0 Tabellen** | `supabase_realtime` enthält keine Tabelle |
| Migrationen | **25** | erste `20260801140903`, letzte `20260802213926 phase1b_sales_process` |

### Funktionen

| Name | Argumente | Zweck |
|---|---|---|
| `is_admin()` | – | Rollenprüfung für RLS |
| `is_active_user()` | – | aktives Profil |
| `is_active_commission_user()` | – | aktives Profil für Provision |
| `current_user_role()` | – | Rolle des Aufrufers |
| `can_access_lead(p_lead_id text)` | text | Leadzugriff |
| `can_access_offer(p_offer_id text)` | text | Angebotszugriff |
| `can_access_contract(p_contract_id text)` | text | Vertragszugriff |
| `can_access_activation(p_activation_id text)` | text | Aktivierungszugriff |
| `can_access_commission_case(p_case_id text)` | text | Fallzugriff |
| `owns_commission_rep(p_rep_id text)` | text | eigener Vertreterbezug |
| `mark_profile_active_on_login()` | – | setzt `last_access_at` |
| `enforce_profile_privilege_guard()` | – | Triggerfunktion für `profiles` |
| `touch_system_keepalive(p_token text)` | text | Keepalive über Cron |

### Migrationen

```
20260801140903 core_profiles_leads_tariffs_products
20260801140905 system_keepalive
20260801152724 profile_login_activation_and_rls
20260801181110 harden_rpc_execute_grants
20260801194755 operational_domains
20260801200028 operational_domains_tables
20260801200036 operational_domains_helpers
20260801211837 production_baseline_catalog
20260801211930 production_baseline_catalog
20260801214159 production_baseline_catalog_20260801230000
20260801214222 production_baseline_catalog_products
20260801214332 production_baseline_catalog_products_20260801230000
20260801214347 production_baseline_catalog_rest_20260801230000
20260801214353 production_baseline_catalog_tariffs_fix
20260801214804 production_baseline_catalog_20260801230000_idempotent
20260801222523 production_baseline_catalog_tariffs_20260801230000
20260801230651 commission_workflow_20260802000000
20260801233218 commission_rls_20260802103000
20260801234611 enable_operational_domains_rls_20260802120000
20260801235006 operational_domains_rls_policies_20260802120100
20260801235029 operational_domains_rls_policies_20260802120100_b
20260802004407 fix_profile_activation_trigger_20260802130000
20260802012957 commission_provision_2_standards
20260802150154 lead_contacts
20260802213926 phase1b_sales_process
```

Auffällig: **neun** Migrationen tragen Varianten des Namens `production_baseline_catalog` (u. a. `_fix`, `_idempotent`, `_rest`, `_b`). Das gesamte Schema wurde in **zwei Tagen** (01.–02.08.2026) aufgebaut. Nacharbeitsmigrationen deuten auf iteratives Reparieren statt geplanter Modellierung.

## 7.2 Tabelleninventur

Spalte „Kern" = wird für Kunden/Beratung/Angebot/Provision/Admin benötigt.
Spalte „doppelte Wahrheit" = derselbe fachliche Wert existiert zusätzlich an anderer Stelle (typischerweise in `data jsonb` **und** als Spalte, oder in zwei Tabellen).

### Basis / Identität

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `profiles` | Benutzerprofil, Rolle, Status | 2 | **ja** | nein | nein | **ja** | `sales_team_id` bei beiden NULL, ungenutzt |
| `system_keepalive` | Cron-Keepalive | 1 | nein | nein | nein | ja | **RLS aktiv, aber keine Policy** (Advisor `rls_enabled_no_policy`); `touch_system_keepalive` ist für `anon` ausführbar |

### Kunden

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `leads` | Kunden | 3 | **ja** | nein | **ja** – 5 Felder als Spalte **und** in `data` | **ja** | kein FK auf `profiles`; kein Index auf `assigned_sales_user_id`; alle 3 Kunden gehören dem Admin |
| `lead_contacts` | Kontaktpersonen | 1 | teilweise | nein | ja (`data`) | ja | – |

### Beratung / Vergleich

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `best_pay_comparison_sessions` | vollständige Beratungssitzung als JSONB | **0** | **ja** | nein | ja (`lead_id`/`offer_id` als Spalte und in `data`) | ja | **Schreibpfad defekt** (Dok. 04) |
| `user_active_sessions` | Zeiger auf aktive Sitzung pro Nutzer | **0** | nein (Komfort) | nein | nein | **bedingt** | **Verursacht den blockierenden FK-Fehler**; reine Komforttabelle mit hartem FK |
| `recommendation_records` | Empfehlungssnapshot | 1 | teilweise | nein | ja | ja | einzige Zeile ist Testdatensatz, `status = incomplete` |
| `recommendation_weight_sets` | Scoring-Gewichte | 1 | nein (Fallback vorhanden) | nein | nein | ja | – |
| `pricing_evaluations` | persistierte Preisbewertungen | **0** | nein | nein | **ja** – konkurriert mit Session-`approval` | bedingt | leere Tabelle schaltet die Freigabepflicht faktisch aus (Dok. 05) |

### Abrechnungsimport / OCR

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `billing_import_sessions` | Importsitzung | 1 (Testdatensatz) | nein (optional) | nein | ja | ja | – |
| `billing_source_documents` | Quelldokumente | 0 | nein | nein | nein | ja | nie genutzt |
| `billing_extracted_fields` | OCR-Felder | 0 | nein | nein | nein | ja | nie genutzt |
| `billing_period_records` | Abrechnungsperioden | 0 | nein | nein | nein | ja | nie genutzt |
| `billing_cost_line_items` | Gebührenpositionen | 0 | nein | nein | nein | ja | nie genutzt |
| `customer_cost_baselines` | bestätigte Ist-Kosten | 0 | nein (optional) | nein | **ja** – konkurriert mit `manualInput.monthlyTotalCostsCents`, hat stillen Vorrang | ja | stiller Vorrang gegenüber Manuelleingabe |

### Katalog / Preise

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `tariffs` | Tarife | 2 (beide `active`) | **ja** | nein | ja (`data`) | **ja** | – |
| `products` | Produkte/Hardware | 19 (alle `active`) | **ja** | nein | ja | **ja** | – |
| `contract_terms` | Laufzeiten 24/36 | 2 (`active`) | **ja** | nein | ja | **ja** | – |
| `price_books` | Preisbuch | 1 | **ja** | nein | ja | **ja** | – |
| `price_book_versions` | Version, `published` ab 2026-01-01 | 1 | **ja** | nein | ja | **ja** | Mehrdeutigkeit würde `PRICE_BOOK_NOT_FOUND` erzeugen – derzeit eindeutig |
| `price_rules` | 3 Preisregeln, `active` | 3 | **ja** | nein | ja | **ja** | – |

### Angebot

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `offers` | Angebote | 1 (Testdatensatz) | **ja** | nein | **ja** – `status` und `workflowStatus` parallel | **ja** | `Offer.status` fachlich informationslos |
| `offer_versions` | Versionssnapshots | 1 | **ja** | nein | **ja** – eigener `workflowStatus` | ja | kann von `offers.workflowStatus` abweichen |
| `offer_workflow_events` | Workflow-Audit | 1 | teilweise | nein | nein | ja | – |
| `offer_documents` | PDF-Dokumente | 1 | nein | nein | nein | ja | – |
| `offer_share_links` | Kundenlinks | 3 | nein | nein | nein | ja | anon-Zugriff nur über Worker mit Service-Role |
| `offer_customer_questions` | Kundenfragen | 2 | nein | nein | nein | ja | – |
| `offer_change_requests` | Änderungswünsche | 1 | nein | nein | nein | ja | – |
| `offer_customer_acceptances` | Kundenannahmen | 0 | nein | nein | nein | ja | nie genutzt |
| `bestpay_handoffs` | Übergabe an BestPay | 0 | nein | nein | nein | ja | nie genutzt |
| `sales_documents` | Vertriebsdokumente | 0 | nein | **ja** | nein | bedingt | nie genutzt, Zweck überlappt mit `offer_documents` |

### Provision

| Tabelle | Zweck | Zeilen | Kern | Altlast | doppelte Wahrheit | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|---|
| `commission_plans` | Provisionsplan | 2 | **ja** | nein | ja | **ja** | – |
| `commission_plan_versions` | Planversionen | 2 | teilweise | nein | ja | ja | – |
| `commission_rules` | Standardregeln | 15 | **ja** | nein | ja | **ja** | `displaySharePercent` der UI hat hier **kein** Zielfeld (Dok. 06) |
| `commission_assignments` | Zuordnung Vertreter → Plan | 3 | **ja** | nein | ja | **ja** | 2 von 3 Zeilen sind Bootstrap/Default ohne Version |
| `commission_assignment_versions` | individuelle Overrides | 3 | **ja** | nein | nein | **ja** | funktioniert nachweislich |
| `commission_calculations` | eingefrorene Berechnungen | **0** | **ja** | nein | nein | ja | nie genutzt |
| `commission_cases` | Provisionsfälle | **0** | **ja** | nein | nein | ja | **leer → „Meine Provision" immer leer** |
| `commission_events` | Audit | 3 | teilweise | nein | nein | ja | – |
| `commission_bonus_payments` | Sonderzahlungen | 0 | nein | nein | nein | ja | nie genutzt |
| `commission_payment_history` | Auszahlungen | 0 | nein | nein | nein | ja | Lücke bei fehlender Referenz (Dok. 06) |

### Nachgelagerte Domänen (vollständig unbenutzt)

| Tabelle | Zweck | Zeilen | Kern | Altlast | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|
| `contracts` | Verträge | 0 | nein | **ja** | ja | Route `/contracts` zeigt auf leere Tabelle |
| `contract_versions` | Vertragsversionen | 0 | nein | **ja** | ja | – |
| `contract_terminations` | Kündigungen | 0 | nein | **ja** | ja | – |
| `activation_cases` | Aktivierungen | 0 | nein | **ja** | ja | Route `/activations` zeigt auf leere Tabelle |
| `activation_checklists` | Checklisten | 0 | nein | **ja** | ja | – |
| `activation_applications` | Anträge | 0 | nein | **ja** | ja | – |
| `activation_hardware` | Hardware | 0 | nein | **ja** | ja | – |
| `activation_blockers` | Blocker | 0 | nein | **ja** | ja | – |

### Vertriebssteuerung und Verwaltung

| Tabelle | Zweck | Zeilen | Kern | Altlast | weiterverwendbar | Risiko |
|---|---|---|---|---|---|---|
| `sales_tasks` | Aufgaben | **0** | nein | nein | ja | **leer → Arbeitsplatz „Überfällig/Heute" strukturell immer leer** (Dok. 03) |
| `sales_activities` | Aktivitäten | 10 | nein | nein | ja | kein `advice_started`-Eintrag → Beleg für Dok. 04 |
| `audit_entries` | Audit | 9 | nein | nein | ja | – |
| `approval_rules` | Freigaberegeln | 3 | nein | nein | ja | – |
| `document_templates` | Vorlagen | 2 | nein | nein | ja | – |
| `export_history` | Exporte | 0 | nein | **ja** | ja | Route `/admin/data` zeigt auf leere Tabellen |
| `backup_history` | Backups | 0 | nein | **ja** | ja | – |
| `data_migration_runs` | Migrationsläufe | 0 | nein | **ja** | ja | – |

## 7.3 Auswertung

| Kategorie | Anzahl Tabellen |
|---|---|
| Gesamt | 58 |
| Für den Kern benötigt | **17** |
| Vollständig leer (0 Zeilen) | **28** |
| Als Altlast eingestuft (leer + kein Kernbezug + eigene Route/Domäne stillgelegt) | **11** |
| Mit doppelter Wahrheit (Spalte ↔ `data`, oder konkurrierende Tabelle) | **~30** (alle Tabellen mit `data jsonb` + gespiegelten Spalten) |
| Nur Testdaten enthaltend | 6 (`offers`, `offer_versions`, `offer_workflow_events`, `offer_documents`, `billing_import_sessions`, `recommendation_records`) |

### Kernrelevante Tabellen (17)

`profiles`, `leads`, `lead_contacts`, `best_pay_comparison_sessions`, `tariffs`, `products`, `contract_terms`, `price_books`, `price_book_versions`, `price_rules`, `offers`, `offer_versions`, `commission_plans`, `commission_rules`, `commission_assignments`, `commission_assignment_versions`, `commission_cases`

## 7.4 Strukturelle Befunde

### Durchgängiges JSONB-Muster

Nahezu jede Tabelle folgt dem Schema `id text PK`, einige gespiegelte Filterspalten, `data jsonb NOT NULL`, `created_at`, `updated_at`. Beispiel `leads`: `company_name`, `status`, `assigned_sales_user_id`, `created_by_user_id` existieren als Spalte **und** in `data`. Synchron gehalten wird das ausschließlich vom Anwendungscode (`SupabaseLeadRepository.ts:18-29`). Es gibt keinen Trigger und keinen Check, der Divergenz verhindert.

Konsequenz: `normalizeLead.ts:133-135` kann bei fehlendem JSONB-Feld die Demo-ID `user_001` einsetzen, obwohl die Spalte korrekt gefüllt ist – zwei Wahrheiten, eine davon falsch.

### Typinkonsistenz Benutzer-IDs

`profiles.user_id` ist `uuid`. Alle referenzierenden Felder (`leads.assigned_sales_user_id`, `created_by_user_id`, `user_active_sessions.user_id`, `commission_assignments.data->>'salesRepresentativeId'`) sind `text`. RLS castet explizit `auth.uid()::text`. Es existiert **kein einziger Fremdschlüssel auf `profiles`** – verwaiste Zuordnungen sind schemaseitig erlaubt.

### Fremdschlüssel und Schreibreihenfolge

49 Fremdschlüssel im Schema. Der kritische:

| Constraint | Definition | Problem |
|---|---|---|
| `user_active_sessions_comparison_session_id_fkey` | `FOREIGN KEY (comparison_session_id) REFERENCES best_pay_comparison_sessions(id) ON DELETE SET NULL` | Der Anwendungscode schreibt das **Kind vor dem Eltern** (`salesWizardService.ts:158-159`) → blockierender Laufzeitfehler, Dok. 04 |

Weitere Kandidaten mit derselben Struktur, aktuell unauffällig weil ungenutzt:

| Constraint | Risiko |
|---|---|
| `customer_cost_baselines_session_id_fkey` → `billing_import_sessions` | Baseline muss nach der Importsitzung geschrieben werden |
| `offer_versions_offer_id_fkey` → `offers` (CASCADE) | `ensureInitialVersion` läuft nach `createOffer` – korrekt |
| `offer_share_links_offer_version_id_fkey` → `offer_versions` | Link nach Version – korrekt |
| `activation_cases_lead_id_fkey` / `contracts_lead_id_fkey` | `ON DELETE RESTRICT` – Kundenlöschung wird blockiert, sobald Verträge existieren |

Auf `commission_assignments` und `commission_assignment_versions` existieren **keine** Fremdschlüssel – deshalb funktioniert der dortige Kind-vor-Eltern-Schreibvorgang (Dok. 06).

### Indizes

Keine expliziten Indizes über die Primärschlüssel und FK-Indizes hinaus erhoben. Insbesondere fehlt ein Index auf `leads.assigned_sales_user_id`, obwohl RLS und Clientfilter darauf filtern. Bei 3 Zeilen ohne Wirkung, bei Wachstum relevant.

## 7.5 Sicherheitsbefunde (Supabase Advisor)

| Level | Befund | Bewertung |
|---|---|---|
| INFO | `public.system_keepalive` hat RLS aktiviert, aber **keine Policy** | Tabelle ist damit für `authenticated` faktisch gesperrt; Zugriff nur über `SECURITY DEFINER`-RPC |
| **WARN** | `public.touch_system_keepalive(p_token text)` ist als `SECURITY DEFINER` für **`anon`** ausführbar | öffentlich aufrufbarer Schreibpfad, nur durch Token geschützt. Bewusste Entscheidung für den Cron-Keepalive, aber die einzige anonyme Schreiboperation im System |
| WARN | 12 weitere `SECURITY DEFINER`-Funktionen sind für `authenticated` ausführbar (`is_admin`, `can_access_*`, `owns_commission_rep`, `mark_profile_active_on_login`, …) | erwartbar für RLS-Helper; `mark_profile_active_on_login` ist die einzige mit Schreibwirkung |
| WARN | Leaked-Password-Protection (HaveIBeenPwned) ist **deaktiviert** | Auth-Härtung fehlt |

Keine Fehler der Stufe ERROR. RLS ist auf **allen 58** Tabellen aktiviert.

## 7.6 Laufzeitfehler im Produktionslog

Der Postgres-Log enthält als **einzige** wiederkehrende Fehlerklasse:

```
ERROR: insert or update on table "user_active_sessions"
       violates foreign key constraint "user_active_sessions_comparison_session_id_fkey"
```

| Cluster | Zeitpunkt (CEST) | Umfang |
|---|---|---|
| 1 | 2026-08-03 16:06:48 – 16:06:50 | 6 Einträge |
| 2 | 2026-08-04 12:44:47 – 12:48:20 | über 60 Einträge |

Sonstige Logeinträge sind ausschließlich `checkpoint`-Meldungen und ein `could not receive data from client`. Es gibt **keine** RLS-Verweigerungen, **keine** Constraint-Verletzungen anderer Tabellen und **keine** Timeout-Fehler.

**Bewertung:** Die Datenbank selbst ist gesund. Der einzige protokollierte Anwendungsfehler ist der Reihenfolgefehler aus Dokument 04 – und der tritt bei jeder Nutzung der Beratung erneut auf.

## 7.7 Gesamtbewertung Datenbank

| Aspekt | Bewertung |
|---|---|
| Schemaqualität | brauchbar. Konsistentes JSONB-Muster, RLS überall aktiv, saubere Helper-Funktionen, nachvollziehbare Versionierung. |
| Datenqualität Kern | **unzureichend, aber intakt.** 2 Profile, 3 Kunden (alle beim Admin), vollständiger Preiskatalog. Keine korrupten oder verwaisten Datensätze. |
| Datenmenge | minimal. 28 von 58 Tabellen leer. Nichts, was gegen eine Neustrukturierung sprechen würde. |
| Altlast | 11 Tabellen (Verträge, Aktivierung, Export/Backup/Migration, `sales_documents`) ohne jeden Datensatz und ohne Kernbezug. |
| Doppelte Wahrheiten | strukturell in ~30 Tabellen (Spalte ↔ `data`), fachlich kritisch in 4 Fällen: Angebotsstatus (3 Ebenen), Freigabe (Session ↔ `pricing_evaluations`), Ist-Kosten (Manuell ↔ Baseline), Bedarfsfelder (`manualInput` ↔ `prospectDraft` ↔ `Scenario.config`). |
| Sicherheit | akzeptabel. Ein öffentlich ausführbarer Schreib-RPC (Keepalive, tokengeschützt), fehlende Leaked-Password-Protection, eine Tabelle mit RLS ohne Policy. |
| Sicher weiterverwendbar | **ja.** Die 17 kernrelevanten Tabellen sind strukturell tragfähig und enthalten korrekte Daten. Ein neues Schema ist zur Behebung der gemeldeten Fehler **nicht** erforderlich. |
| Hauptrisiko | genau ein Fremdschlüssel (`user_active_sessions_comparison_session_id_fkey`) blockiert in Kombination mit falscher Schreibreihenfolge den gesamten Beratungspfad. |

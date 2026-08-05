# 06 – Provisionsfluss

Nur Ist-Zustand. Keine Änderungen.

## 6.0 Hauptbefund vorweg

**Das Speichern individueller Mitarbeiterwerte funktioniert in der Datenbank nachweislich.** Die Wahrnehmung „Provisionen lassen sich nicht zuverlässig bearbeiten" hat drei andere, belegbare Ursachen: das Bearbeitungsformular erscheint unterhalb der Tabelle ohne Scroll- oder Fokusführung, ein Formularfeld wird angezeigt und validiert, aber nie gespeichert, und mehrere Ladefehler bleiben ohne jede Rückmeldung.

Beleg für funktionierende Persistenz (`commission_assignments`, 3 Zeilen):

| id | salesRepresentativeId | currentVersionId | Anzahl Overrides | erstellt | geändert |
|---|---|---|---|---|---|
| `commission_assignment_production_default` | `system_bootstrap` | – | – | 2026-08-01 21:10 | 2026-08-01 21:10 |
| `commission_assignment_default` | `ef9cba97-…` (Admin) | – | – | 2026-08-01 21:35 | 2026-08-01 21:35 |
| `commission_assignment_c9c55257-…` | `35b167e8-…` (Außendienst) | `commission_assignment_version_17821cf7-…` | **4** | 2026-08-03 13:58 | **2026-08-04 10:53** |

Der letzte Datensatz wurde am Analysetag um 10:53 UTC aktualisiert und trägt vier gespeicherte Regel-Overrides. Der Schreibpfad ist intakt.

## 6.1 Funktionsübersicht UI → Service → Tabellen

| Funktion | UI-Komponente | Service-Call | Lesen | Schreiben |
|---|---|---|---|---|
| Admin-Übersicht | `features/admin/commission/AdminCommissionOverviewPage.tsx:11-144`, eingebettet via `v2/commission/CommissionOverviewPage.tsx:36` | `ensureDefaultAssignments`, `getOverview` | `commission_cases`, `commission_calculations`, `commission_rules`, `commission_assignments`, `commission_bonus_payments`, `profiles`, `offers` | `commission_assignments` + `commission_assignment_versions` (nur automatisch) |
| Standardprovisionen | `features/admin/commission/AdminCommissionModelsPage.tsx:81-389` | `getCatalog`, `seedDefaultCatalog`, `upsertStandardRule` | `commission_plans`, `commission_plan_versions`, `commission_rules` | `commission_rules`; Seed auch Plans/Versionen |
| Mitarbeiterwerte | `features/admin/commission/AdminCommissionAssignmentsPage.tsx:22-342` | `ensureDefaultAssignments`, `listRepresentativeAssignments`, `getAssignmentDetail`, `saveAssignment`, `resetAssignmentOverrides` | `commission_assignments`, `commission_assignment_versions`, `commission_rules`, `profiles` | **INSERT** `commission_assignment_versions`, **UPSERT** `commission_assignments` |
| Provisionsfälle | `features/admin/commission/AdminCommissionCasesPage.tsx:13-199` | `getOverview`, `transitionCase` | `commission_cases`, `commission_calculations` | `commission_cases`, `commission_payment_history`, `commission_events` |
| Sonderzahlung | `features/admin/commission/AdminCommissionBonusPage.tsx:15-147` | `getBonusPayments`, `createBonusPayment`, `updateBonusStatus` | `commission_bonus_payments` | `commission_bonus_payments`, `commission_events` |
| Abrechnung/Auszahlung | `features/admin/commission/AdminCommissionPaymentsPage.tsx:9-55` | `getPaymentHistory` | `commission_payment_history` | – (Schreiben nur über Fälle) |
| Historie | `features/admin/commission/AdminCommissionHistoryPage.tsx:9-59` | `getEvents` | `commission_events` | – |
| Außendienst „Meine Provision" | `v2/commission/SalesCommissionPage.tsx:13-91` | `getSalesOverview` | `commission_cases`, `commission_bonus_payments` (auf `context.userId` gefiltert) | – |

Repository-Zuordnung: `SupabaseCommissionCatalogRepository.ts:49-99`, `SupabaseCommissionWorkflowRepository.ts:100-177`, `SupabaseCommissionCalculationRepository.ts:72-120`.

## 6.2 Reale Datenlage

| Tabelle | Zeilen | Bewertung |
|---|---|---|
| `commission_plans` | 2 | Stammdaten vorhanden |
| `commission_plan_versions` | 2 | vorhanden |
| `commission_rules` | 15 | Standardregeln vorhanden |
| `commission_assignments` | 3 | inkl. 1 echter Mitarbeiterzuordnung mit 4 Overrides |
| `commission_assignment_versions` | 3 | Versionierung greift |
| `commission_events` | 3 | Audit-Trail greift |
| `commission_calculations` | **0** | nie eine Berechnung eingefroren |
| `commission_cases` | **0** | **kein einziger Provisionsfall** |
| `commission_bonus_payments` | 0 | leer |
| `commission_payment_history` | 0 | leer |

**Folge:** `/sales/commission` („Meine Provision") liest ausschließlich `commission_cases` und `commission_bonus_payments`. Beide sind leer, die Seite ist für jeden Nutzer zwangsläufig leer – unabhängig von gespeicherten Prozentwerten. Kernanforderung 9 („Außendienst sieht eigene Provision") ist damit nicht erfüllbar, solange keine Fälle entstehen. Fälle entstehen nur über `freezeCalculation` (`commissionCalculationService.ts:388-464`), das seinerseits ein Angebot aus der Beratung voraussetzt – siehe Dokumente 04 und 05.

## 6.3 Bearbeiten: Standardprovisionen

| Aspekt | Befund | Beleg |
|---|---|---|
| „Bearbeiten"-Button | in `ResponsiveTable.renderActions`, setzt nur `setSelectedId(rule.id)` | `AdminCommissionModelsPage.tsx:231-235` |
| Buttonstil | **rohes, ungestyltes `<button>`** | `AdminCommissionModelsPage.tsx:232` |
| DOM-Position des Formulars | Tabellen bei Zeilen 224-257, Formular bei **Zeilen 259-386** – also **nach beiden Tabellen** | Codeprüfung |
| Scroll-/Fokusführung | **keine** – kein `scrollIntoView`, kein `focus()`, kein Anker | Codeprüfung |
| Draft laden | bei `load()` für jede Regel `toDraft(rule)` | `AdminCommissionModelsPage.tsx:107-111` |
| Speichern | `handleSave(selected.id)` → `upsertStandardRule` | `AdminCommissionModelsPage.tsx:378-380`, `128-166` |
| Reload nach Save | `await load()` + `setSelectedId(null)` | Zeilen 162, 158 |

### Belegter Fehler: Feld wird angezeigt, validiert, aber nie gespeichert

```59:78:src/features/admin/commission/AdminCommissionModelsPage.tsx
function toDraft(rule: CommissionRule): RuleDraft {
  return {
    ...
    displaySharePercent: String(COMMISSION_SHARE_DEFAULT),  // immer "100"
```

`displaySharePercent` wird **nie** aus dem Datensatz geladen, sondern hart auf `100` gesetzt. Beim Speichern wird der Wert validiert (`commissionCatalogAdminService.ts:232-235`), aber **nicht** persistiert: `CommissionRule` besitzt kein Anteilsfeld (`domain/commission/commissionRule.ts:29-55`), und der Schreibpfad übergibt es nicht (`commissionCatalogAdminService.ts:244-270`).

Für den Nutzer bedeutet das: Ein Prozentwert lässt sich eingeben, das Speichern meldet Erfolg, nach dem Reload steht wieder `100`. Das ist exakt das Muster „lässt sich nicht zuverlässig bearbeiten".

## 6.4 Bearbeiten: Mitarbeiterwerte

| Aspekt | Befund | Beleg |
|---|---|---|
| Öffnen | Button „**Anzeigen**" (nicht „Bearbeiten"), setzt `selectedUserId`, `model`, `setMessage(null)` | `AdminCommissionAssignmentsPage.tsx:259-270` |
| Buttonstil | rohes, ungestyltes `<button>` | Zeile 260 |
| DOM-Position | Liste Zeilen 246-273, Detailpanel **Zeilen 275-336** – nach der Liste | Codeprüfung |
| Scroll-/Fokusführung | **keine** | Codeprüfung |
| Daten laden | `useEffect` auf `selectedUserId`/`model` → `getAssignmentDetail` → `setRuleViews(detail.ruleViews)` | Zeilen 55-75, 64 |
| Speichern | `handleSave()` → `saveAssignment` | Zeilen 328-330, 85-122 |
| Reload | `await load()` + optional `getAssignmentDetail` | Zeilen 108, 110-115 |

### Welche Tabelle tatsächlich beschrieben wird

`commissionAdminService.saveAssignment` (`380-525`):

1. **INSERT** in `commission_assignment_versions` mit `ruleOverrides[]` (Zeilen 487, 493; Repository `SupabaseCommissionWorkflowRepository.ts:135-139`)
2. **UPSERT** in `commission_assignments` inkl. `currentVersionId` (Zeile 499; Repository `SupabaseCommissionCatalogRepository.ts:97-98`)

**Nicht** beschrieben werden `commission_rules`, `commission_plan_versions`, `commission_plans`. Die Trennung Unternehmensstandard (Rules) gegen individuelle Overrides (Assignment-Versionen) ist im Code **saubere Absicht und wird eingehalten**. Es liegt hier keine Tabellenverwechslung vor.

Reihenfolge Kind→Eltern ist unkritisch, weil auf `commission_assignments` und `commission_assignment_versions` **keine** Fremdschlüssel definiert sind (im Gegensatz zu `user_active_sessions`, Dokument 04).

### Draft-/Stale-Risiken

| Risiko | Befund | Beleg |
|---|---|---|
| Modellwechsel ohne Speichern | Wenn `options.model !== assignedModel`, werden Overrides auf Standard-100 % zurückgesetzt; individuelle Werte des anderen Modells erscheinen nicht | `commissionAdminService.ts:321-329` |
| Ohne Assignment | `getAssignmentDetail` liefert `assignment: null`, Default `validFrom: '2026-01-01'` bleibt stehen | `commissionAdminService.ts:326-329`, `AdminCommissionAssignmentsPage.tsx:28` |
| Reset | `handleReset` aktualisiert `ruleViews` optimistisch **ohne** erneutes `getAssignmentDetail` | Zeilen 135-146 |
| Nur Prozent | `toOverrides()` setzt `fixedAmountCents` und `percentTenthsOfBasisPoint` immer auf `null` → Euro-Ausnahmen über die UI unmöglich | Zeilen 77-83 |

## 6.5 Wird der Save-Handler ausgelöst?

| Aktion | Handler | Auslösung |
|---|---|---|
| Standardregel speichern | `handleSave` (`128-166`) | ja, Button Zeile 378 |
| Mitarbeiterwert speichern | `handleSave` (`85-122`) | ja, Button Zeile 328 |
| Fall-Transition | `runTransition` (`83-88`) | ja, Buttons 122-147 |
| Bonus anlegen | `handleCreate` (`39-61`) | ja, Button 80 |

Alle Save-Handler werden korrekt ausgelöst und alle Panels laden nach dem Speichern neu. Das Problem liegt nicht im Auslösen.

## 6.6 Stille Fehlerpfade

| Stelle | Beleg | Wirkung |
|---|---|---|
| Fälle laden | `AdminCommissionCasesPage.tsx:27-30` | Fehler ohne UI-Rückmeldung |
| Bonus laden | `AdminCommissionBonusPage.tsx:29-32` | still |
| Auszahlungen / Historie laden | `AdminCommissionPaymentsPage.tsx:16-19`, `AdminCommissionHistoryPage.tsx:16-19` | still |
| CSV-Export verboten | `v2/commission/CommissionOverviewPage.tsx:13-22` | keine Meldung |
| Übersicht verboten | `AdminCommissionOverviewPage.tsx:34-36` | generischer EmptyState ohne Grund |
| Audit nach Save | `commissionAdminService.ts:520-522`, `commissionCatalogAdminService.ts:297-299` | nur `console.error` |
| Bonus-Statuswechsel | `AdminCommissionBonusPage.tsx:114-131` | kein Fehler-Feedback |
| Zahlung ohne Referenz | `commissionAdminService.ts:873-886` – History-Eintrag nur wenn **beide**, `paymentDate` **und** `paymentReference`, gesetzt sind; sonst Status `paid` **ohne** History und ohne Hinweis | Datenlücke |
| Kürzung bei Freigabe | `AdminCommissionCasesPage.tsx:164-174` + `commissionAdminService.ts:860-862,889-895` – bei `reserved → released` wird eine eingetragene Kürzung **ignoriert** | stiller Datenverlust |
| `context === null` | `AdminCommissionOverviewPage.tsx:30-32`, `AdminCommissionModelsPage.tsx:90` | leere UI ohne Erklärung |
| `handleSeed` verboten | `AdminCommissionModelsPage.tsx:124` | zeigt rohen Fehlercode statt `commissionErrorLabel` |

## 6.7 Prozentabbildung 0–100 %

| Konzept | Speicherort | Typ / Regel |
|---|---|---|
| `sharePercent` | `CommissionRuleOverride` (`domain/commission/commissionRuleOverride.ts:18`) | Integer 0–100, `isValidCommissionSharePercent` (`commissionShare.ts:8-16`) |
| Standardwert | `COMMISSION_SHARE_DEFAULT = 100` | `commissionShare.ts:6` |
| Eurorundung | `Math.round((standardAmountCents * sharePercent) / 100)` | `commissionShare.ts:29` |
| `percentTenthsOfBasisPoint` | `CommissionRule` (`commissionRule.ts:47`) | variable Prozentregeln, UI teilt durch 100 (`AdminCommissionModelsPage.tsx:44,69-70`) |
| `fixedAmountCents` | `CommissionRule` bzw. Override | Standardbetrag in Cent |
| Normalisierung | `normalizeOverrideToShareTruth` (`commissionRuleOverride.ts:68-136`) | Euro → Prozent wenn möglich, sonst Euro-Ausnahme |

| Vermischungsrisiko | Befund |
|---|---|
| `displaySharePercent` in Standardregeln | editierbar, validiert, **nicht persistiert** (6.3) |
| Mitarbeiter-UI | sendet nur `sharePercent`, nie `fixedAmountCents` → Euro-Ausnahmen nicht erfassbar |
| `updateSharePercent` | `Math.round(value)` (`AdminCommissionAssignmentsPage.tsx:163`) – Dezimalstellen werden ohne Hinweis gerundet |
| Validierung | Service prüft 0–100 (`commissionAdminService.ts:400-406`), UI zusätzlich (Zeilen 87-91) – 0 % und 100 % sind zulässig |

**0 % und 100 % werden korrekt abgebildet.** Der eigentliche Mangel ist, dass Dezimalanteile stillschweigend gerundet und Eurobeträge in der UI ausgeschlossen sind.

## 6.8 RLS und Admin-Erkennung

RLS-Migration `supabase/migrations/20260802103000_commission_rls.sql`:

| Tabelle | Lesen | Schreiben |
|---|---|---|
| `commission_plans`, `commission_plan_versions`, `commission_rules` | nur Admin | nur Admin |
| `commission_assignments`, `commission_assignment_versions` | Admin + eigener Rep | nur Admin |
| `commission_calculations`, `commission_cases` | Admin + eigener Rep | nur Admin |
| `commission_events` | Admin + Fallzugriff | nur Admin |
| `commission_bonus_payments`, `commission_payment_history` | Admin + eigener Rep | nur Admin |

Voraussetzungen: `is_active_commission_user()` und `is_admin()` bzw. `owns_commission_rep()`.

| Client-Gate | Prüfung | Beleg |
|---|---|---|
| v2-Shell | `adminOverviewService.canAccessAdmin` → Permission `admin.access` + `status === 'active'` | `v2/commission/CommissionShell.tsx:50-68`, `adminOverviewService.ts:58-60` |
| Legacy-Layout | identisch | `features/admin/AdminLayout.tsx:51-71` |
| Service-Mutationen | `requirePermission(…, 'admin.commission')` | `commissionAdminService.ts:202-204`, `commissionCatalogAdminService.ts:131-134` |
| `useAdminContext()` | liefert `UserContext` für **jeden** eingeloggten Nutzer, **ohne** Permission-Prüfung | `features/admin/AdminLayout.tsx:90-104` |
| Außendienstseite | Permission `commission.view`, Service erlaubt `field_service` + `admin` | `SalesCommissionPage.tsx:21-24`, `commissionAdminService.ts:1063-1065` |

**Diskrepanz:** UI-Gate prüft `admin.access`, Schreiboperationen `admin.commission`. Für die Rolle `admin` sind beide vorhanden (`permission.ts:179-184`), sodass in Produktion kein Konflikt entsteht. Bei künftigen Rollen wäre UI-Zugang ohne Schreibrecht möglich.

**Admin-RLS erlaubt Schreiben** – bestätigt durch den am 04.08. aktualisierten Assignment-Datensatz.

## 6.9 Historische Fälle

| Entität | wird durch Katalogänderungen berührt |
|---|---|
| `commission_calculations` (frozen) | **nein** – Admin-UI mutiert Berechnungen nicht; Snapshot inkl. Planversion bleibt unverändert |
| `commission_cases` | nur über `transitionCase` (Status, Kürzung, Zahlung), `commissionAdminService.ts:823-946` |
| `commission_payment_history` | nur bei dokumentierter Auszahlung |
| `commission_events` | Audit-Trail, additiv |
| Katalogänderungen (`upsertStandardRule`, `saveAssignment`) | wirken **nur auf zukünftige** Berechnungen |

`getOverview` liest Berechnungen ausschließlich zur Anzeige (`commissionAdminService.ts:619,644-645`).

**Bewertung:** Die Historisierung ist konzeptionell sauber und aktuell risikofrei, weil beide Tabellen leer sind.

## 6.10 Zusammenfassungstabelle

| Funktion | UI | Service | Tabelle | RLS | aktueller Fehler |
|---|---|---|---|---|---|
| Außendienst-Provisionsübersicht | `v2/commission/SalesCommissionPage` | `getSalesOverview` | `commission_cases`, `commission_bonus_payments` (lesend) | Rep lesend | **immer leer** – beide Tabellen haben 0 Zeilen, weil ohne Angebot keine Fälle entstehen |
| Standardprovisionen | `features/admin/commission/AdminCommissionModelsPage` (Legacy, rohe Buttons) | `getCatalog`, `upsertStandardRule` | `commission_rules` | Admin schreibend | `displaySharePercent` wird angezeigt und validiert, aber **nie gespeichert**; Formular erscheint **nach** zwei Tabellen ohne Scrollführung |
| Individuelle Vereinbarungen | `features/admin/commission/AdminCommissionAssignmentsPage` (Legacy, rohe Buttons) | `saveAssignment`, `getAssignmentDetail` | INSERT `commission_assignment_versions`, UPSERT `commission_assignments` | Admin schreibend | **Persistenz funktioniert** (4 Overrides, geändert 04.08. 10:53). Probleme: Button heißt „Anzeigen", Panel erscheint **unter** der Liste, Modellwechsel zeigt Standard statt gespeicherter Werte, Dezimalwerte werden stillschweigend gerundet, keine Euro-Ausnahmen |
| Provisionsfälle | `features/admin/commission/AdminCommissionCasesPage` (Legacy) | `getOverview`, `transitionCase` | `commission_cases`, `commission_payment_history`, `commission_events` | Admin schreibend | 0 Fälle vorhanden; Ladefehler still; Kürzung bei `reserved → released` wird ignoriert |
| Freigabe / Statuswechsel | dito | `transitionCase` | `commission_cases` | Admin | kein Fehler-Feedback |
| Auszahlung | `AdminCommissionPaymentsPage` (nur lesend) + Fälle-Panel | `getPaymentHistory`, `transitionCase('paid')` | `commission_payment_history` | Admin | Status `paid` ohne History-Eintrag, wenn Datum oder Referenz fehlt – ohne Hinweis |
| Sonderzahlung | `AdminCommissionBonusPage` (Legacy) | `createBonusPayment`, `updateBonusStatus` | `commission_bonus_payments` | Admin | leer; Statusbuttons ohne Fehler-Feedback; Rep-ID manuell einzugeben |
| Historie | `AdminCommissionHistoryPage` (Legacy) | `getEvents` | `commission_events` | Admin | Ladefehler still |

## 6.11 Befundliste Provision

| Nr. | Befund | Schwere |
|---|---|---|
| P1 | `/sales/commission` ist zwangsläufig leer: `commission_cases` und `commission_bonus_payments` haben 0 Zeilen; Fälle entstehen nur über `freezeCalculation`, das ein Angebot aus der Beratung voraussetzt. | **blockierend** (Folge von Dok. 04) |
| P2 | `displaySharePercent` bei Standardregeln: angezeigt, editierbar, validiert, **nie gespeichert**. Nach Reload steht wieder 100. | **hoch** |
| P3 | Bearbeitungsformulare aller drei Provisionspanels liegen im DOM **nach** der Tabelle, ohne `scrollIntoView`/Fokus. Auf Mobilgeräten unsichtbar. | **hoch** |
| P4 | Rohe, ungestylte `<button>`-Elemente in allen Provisionspanels → abweichende Buttonhöhen gegenüber dem restlichen v2-UI. | mittel |
| P5 | Kürzung wird beim Übergang `reserved → released` stillschweigend verworfen. | mittel |
| P6 | Zahlung `paid` ohne History-Eintrag, wenn Datum oder Referenz fehlt – ohne Warnung. | mittel |
| P7 | Sieben Ladepfade ohne Fehleranzeige; Audit-Fehler nur in der Konsole. | mittel |
| P8 | Dezimale Prozentwerte werden ohne Hinweis gerundet; Euro-Ausnahmen sind über die UI nicht erfassbar. | niedrig |
| P9 | Modellwechsel zeigt Standardwerte statt gespeicherter Overrides des anderen Modells. | niedrig |
| P10 | Die Schreibpfade für individuelle Vereinbarungen funktionieren nachweislich (Datensatz vom 04.08. mit 4 Overrides). Tabellenverwechslung liegt **nicht** vor, Admin-RLS erlaubt Schreiben. | Negativbefund |
| P11 | Historisierung eingefrorener Berechnungen ist korrekt; Katalogänderungen berühren Altfälle nicht. | Negativbefund |

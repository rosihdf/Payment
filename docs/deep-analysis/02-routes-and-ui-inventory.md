# 02 – Routen- und UI-Inventur

Grundlage: `src/app/router.tsx` (HEAD `223b3f1466…`), 62 Routeneinträge.
Nur Ist-Zustand, keine Änderungen.

Legende „für Kern notwendig": Der gewünschte Kern ist Kunden (anzeigen/anlegen/bearbeiten/zuweisen), Beratung (manuell, 0 €, optional Abrechnung), Angebot aus Beratung + Status, Provision Außendienst, Admin-Stammdaten + Provision.

## 2.1 Öffentliche Routen (ohne Auth)

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | `features/auth/LoginPage` | Legacy | Supabase Auth | anon | Anmeldung | nein | ja (Login funktioniert, 2 Profile aktiv) | **ja** | behalten |
| `/auth/callback` | `features/auth/AuthCallbackPage` | Legacy | Supabase Auth | anon | Magic-Link/Callback | nein | ja | ja | behalten |
| `/set-password` | `features/auth/AuthCallbackPage` | Legacy | Supabase Auth | anon | Passwort setzen | nein | teilweise | ja | behalten |
| `/offer-review/:token` | `features/offer/OfferReviewPage` | Legacy | Worker `/api/public/offers/:token` + Service-Role | anon (Kunde) | öffentliche Angebotsansicht | nein | ja (3 `offer_share_links`, 2 Fragen, 1 Änderungswunsch in DB) | nein | ignorieren (funktioniert, aber außerhalb Kern) |

## 2.2 Start und Kunden

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Redirect → `/sales` | v2 | – | alle | Einstieg | – | ja | ja | behalten |
| `/sales` | `v2/workspace/WorkspacePage` | v2 nativ | `salesWorkspaceService` (alle Repos) | alle | „Arbeitsplatz" Tagesarbeit | ja | **nein** – rendert ausschließlich `view.dayWork` (Überfällig/Heute/Blockiert/Nächste Kundenfälle), keine Kundenliste; Suchfeld filtert nichts Sichtbares | **nein** in dieser Form | ersetzen oder ignorieren |
| `/leads` | `v2/crm/LeadsPage` | v2 nativ | `leadService.searchLeads` | alle | Kundenliste | ja | ja, aber Rollenfilter abweichend (siehe Dok. 03) | **ja** | behalten, Filter korrigieren |
| `/leads/new` | `v2/crm/NewLeadPage` | v2 nativ | `leadService.createLead` | alle | Kunde anlegen | ja | ja (3 Leads in DB angelegt) | **ja** | behalten |
| `/leads/:id/edit` | `v2/crm/EditLeadPage` | v2 + Legacy-CSS | `leadService.updateLead` | alle | Kunde bearbeiten | nein | ja, **ohne Betreuerfeld** | **ja** | behalten, Betreuerfeld fehlt |
| `/leads/:id` | `v2/crm/LeadRecordPage` | v2 nativ | `useLeadRecord` | alle | Kundenakte | nein | ja | ja | behalten |

`/sales` ist der Startbildschirm. Dass dort **keine Kundenliste** erscheint, ist die direkte Erklärung für „Kunden erscheinen in einer Ansicht, in einer anderen nicht" (Beleg: `src/v2/workspace/WorkspacePage.tsx:116-136`).

## 2.3 Beratung

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/advice` | `v2/advice/AdviceEntry` → Hub oder Wizard | v2 nativ | `salesWizardService`, `bestPayComparisonService` | admin, field_service | Beratung | ja | **nein** – 0 Zeilen in `best_pay_comparison_sessions`, FK-Fehler in Produktionslogs (Dok. 04) | **ja** | behalten, reparieren |
| `/advice/quick` | Redirect → `/advice` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/sales/wizard` | `PreserveSearchRedirect` → `/advice` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/calculator` | `PreserveSearchRedirect` → `/advice` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/calculator/wizard` | `CalculatorWizardRedirect` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/calculator/bestpay` | Redirect → `/advice` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/calculator/bestpay/history` | Redirect → `/advice` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |

Sechs von sieben Beratungsrouten sind reine Altpfad-Weiterleitungen.

## 2.4 Angebote

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/offers` | `v2/offer/OffersPage` | v2 nativ | `offerService` | alle | Angebotsliste | ja | ja (1 Angebot in DB, Testdatensatz) | **ja** | behalten |
| `/offers/new` | `v2/offer/NewOfferPage` | **v2-Shell um `features/offer/OfferForm`** | `offerService.createOffer` | alle | Angebot manuell | nein | unbelegt in Produktion | nein | ignorieren |
| `/offers/:id/edit` | `v2/offer/EditOfferPage` | **v2-Shell um `features/offer/OfferForm`** | `offerService.updateOffer` | alle | Angebot bearbeiten | nein | unbelegt in Produktion | nein | ignorieren |
| `/offers/:id` | `v2/offer/OfferDetailPage` | **Hybrid: v2-Layout + 8 Legacy-Sections aus `features/offer/*`** | diverse | alle | Angebotsdetail + Workflow/Status | nein | teilweise (Workflow `ready_to_send` gesetzt) | **ja** (Statuspflege) | behalten, entschlacken |
| `/offers/:id/preview` | `v2/offer/OfferDocumentPreviewPage` | v2-Shell um Legacy | `offerDocumentService` | alle | PDF-Vorschau | nein | 1 `offer_documents`-Zeile | nein | ignorieren |
| `/offers/:offerId/documents/:documentId` | `v2/offer/OfferDocumentDetailPage` | v2-Shell um Legacy | `offerDocumentService` | alle | Dokumentdetail | nein | unbelegt | nein | ignorieren |

## 2.5 Provision

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/sales/commission` | `v2/commission/SalesCommissionPage` | v2 nativ | `commissionAdminService.getSalesOverview` | field_service, admin | eigene Provision | ja | ja, aber 0 `commission_cases` → immer leer | **ja** | behalten |
| `/admin/commission` | `features/admin/AdminCommissionPage` | **Legacy** | – | admin | Provisions-Einstieg | ja | ja | ja | zusammenführen |
| `/admin/commission/overview` | `v2/commission/CommissionOverviewPage` | **v2-Shell um `features/admin/commission/AdminCommissionOverviewPage`** | `getOverview` | admin | Übersicht | ja | ja | ja | behalten |
| `/admin/commission/standards` | `v2/commission/CommissionStandardsPage` | **v2-Shell um 2 Legacy-Panels** (`CommissionModelsPanel`, `CommissionAssignmentsPanel`) | `commission_rules`, `commission_assignment_versions` | admin | Standard + Mitarbeiterwerte | ja | teilweise (siehe Dok. 06) | **ja** | behalten, UI reparieren |
| `/admin/commission/cases` | `v2/commission/CommissionCasesPage` | v2-Shell um Legacy-Panel | `commission_cases` | admin | Provisionsfälle | ja | leer (0 Zeilen) | nein | ignorieren |
| `/admin/commission/bonus` | `v2/commission/CommissionBonusPage` | v2-Shell um Legacy-Panel | `commission_bonus_payments` | admin | Sonderzahlung | ja | leer (0 Zeilen) | nein | ignorieren |
| `/admin/commission/settlement` | `v2/commission/CommissionSettlementPage` | v2-Shell um 2 Legacy-Panels | `commission_payment_history`, `commission_events` | admin | Abrechnung/Historie | ja | leer bzw. 3 Events | nein | ignorieren |
| `/admin/commission/models` | Redirect → standards | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/admin/commission/assignments` | Redirect → standards | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/admin/commission/payments` | Redirect → settlement | v2 | – | – | Altpfad | nein | ja | nein | entfernen |
| `/admin/commission/history` | Redirect → settlement | v2 | – | – | Altpfad | nein | ja | nein | entfernen |

## 2.6 Verwaltung

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/admin` | `v2/admin/AdminOverviewPage` | v2 + `features/admin/AdminLayout` | `adminOverviewService` | admin | Verwaltungsübersicht | ja | ja | ja | behalten |
| `/admin/users` | `v2/admin/AdminUsersPage` | v2 + Legacy-Layout | Worker-API + `profiles` | admin | Benutzer | ja | ja (2 Profile) | **ja** | behalten |
| `/admin/roles` | `v2/admin/AdminRolesPage` | v2 + Legacy-Layout | `permission.ts` statisch | admin | Rollen | ja | nur Anzeige | nein | ignorieren |
| `/admin/catalog` | `v2/admin/AdminCatalogPage` | **v2-Shell um 3 Legacy-Panels** | `products`, `tariffs`, `price_rules` | admin | Stammdaten | ja | ja (19 Produkte, 2 Tarife, 3 Regeln aktiv) | **ja** | behalten |
| `/admin/pricing` | `features/admin/AdminPricingPage` | **Legacy** | `price_books`, `price_book_versions` | admin | Preisbuch | ja | ja (1 Version `published`) | **ja** | behalten |
| `/admin/products` | `features/admin/AdminProductsPage` | **Legacy** | `products` | admin | Produkte | ja | ja | ja | behalten |
| `/admin/products/manage` | `AdminProductsManageRedirect` | Legacy | – | – | Altpfad | nein | ja | nein | entfernen |
| `/admin/products/manage/new` | `features/product/NewProductPage` | **Legacy** | `products` | admin | Produkt anlegen | nein | ja | ja | behalten |
| `/admin/products/manage/:id/edit` | `features/product/EditProductPage` | **Legacy** | `products` | admin | Produkt bearbeiten | nein | ja | ja | behalten |
| `/admin/tariffs` | `AdminTariffsListRedirect` | Legacy | – | – | Altpfad | nein | ja | nein | entfernen |
| `/admin/tariffs/new` | `features/tariff/NewTariffPage` | **Legacy** | `tariffs` | admin | Tarif anlegen | nein | ja | ja | behalten |
| `/admin/tariffs/:id/edit` | `features/tariff/EditTariffPage` | **Legacy** | `tariffs` | admin | Tarif bearbeiten | nein | ja | ja | behalten |
| `/admin/approvals` | `v2/admin/AdminApprovalsPage` | v2 + Legacy-Layout | `approval_rules` | admin | Freigaberegeln | ja | 3 Zeilen | nein | ignorieren |
| `/admin/templates` | `v2/admin/AdminTemplatesPage` | v2 + Legacy-Layout | `document_templates` | admin | Vorlagen | ja | 2 Zeilen | nein | ignorieren |
| `/admin/data` | `v2/admin/AdminDataPage` | v2 + Legacy-Layout | `export_history`, `backup_history`, `data_migration_runs` | admin | Daten/Export | ja | alle 3 Tabellen leer | nein | ignorieren |
| `/admin/audit` | `v2/admin/AdminAuditPage` | v2 + Legacy-Layout | `audit_entries` | admin | Audit | ja | 9 Zeilen | nein | ignorieren |
| `/admin/system` | `v2/admin/AdminSystemPage` | v2 + Legacy-Layout | `system_keepalive` | admin | System | ja | 1 Zeile | nein | ignorieren |
| `/products` | Redirect → `/admin/catalog?tab=products` | v2 | – | – | Altpfad | nein | ja | nein | entfernen |

## 2.7 Verträge, Aktivierung, Profil

| Route | Komponente | v2/Legacy | Datenquelle | Rolle | Zweck | in Navigation | funktional belegt | Kern | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|
| `/contracts` | `v2/contract/ContractsPage` | v2 nativ | `contracts` | alle | Vertragsliste | ja | **nein** – 0 Zeilen | nein | ignorieren |
| `/contracts/:contractId` | `v2/contract/ContractDetailPage` | v2 nativ | `contracts`, `contract_versions` | alle | Vertragsdetail | nein | **nein** – 0 Zeilen | nein | ignorieren |
| `/activations` | `v2/activation/ActivationsPage` | v2 nativ | `activation_cases` | alle | Aktivierungen | ja | **nein** – 0 Zeilen | nein | ignorieren |
| `/activations/:activationId` | `v2/activation/ActivationDetailPage` | v2 nativ | 5 Aktivierungstabellen | alle | Aktivierungsdetail | nein | **nein** – 0 Zeilen | nein | ignorieren |
| `/profile` | `v2/profile/ProfilePage` | v2-Shell + `features/…/AppInfoSection` | `profiles` | alle | Profil, App-Info, Update | ja | ja | ja | behalten |

## 2.8 Zusammenfassung Routen

| Kategorie | Anzahl |
|---|---|
| Routeneinträge insgesamt | 62 |
| Reine Redirects/Altpfade | 13 |
| Für den Kern notwendig | 21 |
| Funktional in Produktion belegt (Daten vorhanden) | 24 |
| Auf leere Tabellen zeigend (Verträge, Aktivierung, Fälle, Bonus, Daten) | 11 |
| v2-Seiten, die nur Shells um Legacy-Inhalte sind | 13 |

## 2.9 UI-System – Ist-Matrix

### Zwei parallele Buttonsysteme

| System | Umfang | Höhe |
|---|---|---|
| `src/v2/ui/Button.tsx` | 1 Definition, 21 Consumer | `min-height: var(--control-height)` = 2,75rem; `compact` = 2rem (`Button.module.css:6-7,80-85`) |
| Rohe `<button>` in `src/features/` | **25 Dateien, ~98 Vorkommen** | teils `var(--touch-target)`, teils **ungestylt** = Browser-Default ~1,5–2rem |
| Rohe `<button>` in `src/v2/` | 13 Dateien, ~17 Vorkommen | eigene Modul-CSS (z. B. `WizardNav.tsx:27-37`, `CostsStep.tsx:56`) |

**Belegte Ursache unterschiedlicher Buttonhöhen:** Die Provisions-Panels rendern ungestylte `<button>`-Elemente ohne Klasse, z. B. `features/admin/commission/AdminCommissionModelsPage.tsx:232,247,378` und `AdminCommissionAssignmentsPage.tsx:260,328-333`. Diese erben nur Browser-Defaults, während benachbarte v2-Buttons 2,75rem hoch sind. Zusätzlich mischen sich zwei Tokens: `--control-height` (v2) und `--touch-target` (Basis), etwa `OfferWorkflowSection.module.css:49` gegen `Button.module.css:6`.

### Formularsystem

| Schicht | Datei | Nutzung |
|---|---|---|
| Kern-Inputs | `components/common/FormControl.tsx` | direkt in `features/offer/*`, `features/admin/commission/*`, `features/auth/*`, `features/tariff/*`, `features/product/*` |
| Legacy-Wrapper | `components/common/FormField.tsx` | `features/offer/*`, `TariffForm`, `ProductForm` |
| v2-Wrapper | `v2/ui/FormField.tsx:11-19` (Re-Export von `FormControl` + v2-Layout) | `v2/crm/*`, `v2/advice/steps/*`, `v2/admin/*`, `v2/contract/*`, `v2/activation/*` |

`v2/crm/LeadForm.tsx:4,17` importiert **beide** Wrapper gleichzeitig – ein belegtes Zeichen für unvollständige Migration. Ein zweites Input-System existiert nicht; es gibt aber drei Label-/Layoutstile.

### Dialoge

| Implementierung | Datei | Buttonquelle |
|---|---|---|
| v2 `Dialog` | `v2/ui/Dialog.tsx:80-100` | v2-`Button` |
| Legacy `ConfirmDialog` | `components/feedback/ConfirmDialog.tsx:49` | rohe `<button>` mit eigener CSS (`ConfirmDialog.module.css:38-47`) |

Beide sind gleichzeitig im Einsatz (`ConfirmDialog` in `AdviceHubPage`, `NewOfferPage`, `EditOfferPage`, `OfferDocumentDialogs`).

### Tabellen

| Implementierung | Mobile-Breakpoint | Scroll-`min-width` |
|---|---|---|
| `components/common/ResponsiveTable.tsx` | 720px | 36rem (`ResponsiveTable.module.css:78-88`) |
| `v2/ui/ResponsiveTable.tsx` | 719px | 36rem (`v2/ui/ResponsiveTable.module.css:109-119`) |

Beide gleichzeitig im Einsatz: Legacy in `AdminCommissionModelsPage.tsx:3`, `AdminCommissionAssignmentsPage.tsx:3`, `AdminCommissionCasesPage.tsx:3`; v2 in `AdminUsersPage.tsx:18` und weiteren v2-Adminseiten. `features/admin/AdminPriceRulesPanel.tsx:8` nutzt bereits die v2-Variante – die Trennung ist nicht sauber.

### Belegte Ursachen für Tabellenüberlauf

| Datei | Zeile | Regel |
|---|---|---|
| `features/admin/AdminLayout.module.css` | 95-98 | `.tableWrap .table { min-width: 36rem }` bei ≤720px |
| `components/common/ResponsiveTable.module.css` | 78-88 | `min-width: 36rem` |
| `v2/ui/ResponsiveTable.module.css` | 109-119 | `min-width: 36rem` |
| `v2/ui/ResponsiveTable.module.css` | 40-42 | `.numeric { white-space: nowrap }` |
| `v2/ui/StatusBadge.module.css` | 13 | `white-space: nowrap` |
| `components/common/FormControl.module.css` | 110 | `white-space: nowrap` |
| `features/.../RoleSwitcher.module.css` | 31-36 | `min-width: 11–14rem` im Header |

36rem = 576px. Bei 360px Viewport erzwingt das horizontales Scrollen; Aktionsspalten liegen dann außerhalb des sichtbaren Bereichs. Das ist die belegte Ursache für „mobile Tabellen laufen aus dem Viewport" und „Aktionen außerhalb des Viewports".

### Belegte Ursache „Bearbeiten-Formular erscheint unter der Liste"

Alle drei Provisions-Panels rendern das Bearbeitungsformular in der DOM-Reihenfolge **nach** der Tabelle, ohne Scroll- oder Fokusführung:

| Seite | Tabelle | Formular danach |
|---|---|---|
| `features/admin/commission/AdminCommissionModelsPage.tsx` | Zeilen 224-237 (Aktion „Bearbeiten" setzt nur `setSelectedId`) | **Zeilen 259-385** |
| `features/admin/commission/AdminCommissionAssignmentsPage.tsx` | Zeilen 252-272 (Aktion „Anzeigen") | **Zeilen 275-336** |
| `features/admin/commission/AdminCommissionCasesPage.tsx` | Zeilen 93-106 | **Zeilen 109-167+** |

Gegenbeispiel im gleichen Projekt: `v2/admin/AdminUsersPage.tsx:161-194` bearbeitet inline in den `<td>`-Zellen. Es existieren also zwei widersprüchliche Bearbeitungsmuster.

### CSS-Tokens

| Datei | Inhalt | genutzt in `features/` |
|---|---|---|
| `src/styles/variables.css` | Farben, `--touch-target`, `--space-*` | ja, alle 33 Feature-CSS-Module |
| `src/v2/styles/tokens.css` | `--control-height`, Safe-Area-Variablen, Statuspaare | **nur teilweise**; `--control-height` in `features/` **nicht** verwendet |
| `src/v2/styles/breakpoints.css` | `--bp-mobile-max: 719px` | **nein** – Feature-CSS nutzt Literale 640/720/768/960px |

Hartkodierte Werte statt Tokens u. a. in `OfferReviewPage.module.css:85-91` (`#fff`), `AppUpdateGate.module.css:42`, `v2/ui/Button.module.css:64-65` (`#991b1b`).

## 2.10 Mobile / PWA / APK – Vergleich

### Assetgleichheit: bewiesen identisch

| Prüfung | Ergebnis |
|---|---|
| `diff -rq dist android/app/src/main/assets/public` | **identisch**, einzige Abweichung: `cordova.js` und `cordova_plugins.js` (Capacitor-Shims) |
| Einstiegsbundle `dist/index.html` | `assets/index-BC-8sjn5.js` |
| Einstiegsbundle `android/.../public/index.html` | `assets/index-BC-8sjn5.js` |
| Einstiegsbundle live (`amrtech-payment.amrtech.workers.dev`) | `assets/index-BC-8sjn5.js` |
| SHA-256 lokale `app-release.apk` | `d8cee4a7d5c51993af04e0c4ad2a025da49327b7515450007abb6a8502068c53` |
| SHA-256 in veröffentlichter `android/latest.json` | **identisch**, `sizeBytes: 11191358` = Dateigröße lokal |
| `sourceCommit` in `latest.json` | `223b3f14667283bb47c50d920e647605590264d3` = `HEAD` = `main` = Tag `v1.0.2` |

**Belegt: Desktop, Live-PWA und APK führen bit-identisches Frontend aus.** Alle in Dokument 03–06 dokumentierten Fehler existieren in allen drei Auslieferungsformen gleichermaßen. Es gibt keinen „APK-spezifischen" Fehler und keinen veralteten APK-Stand.

### Vergleichsmatrix

| Aspekt | Desktop-Browser | PWA (installiert) | Capacitor APK |
|---|---|---|---|
| Webassets | `dist` via Worker | dieselben, über Service Worker gecacht | dieselben, aus `assets/public` |
| Fehlerbild | identisch | identisch | identisch |
| Buildbasis | `vite build` | `vite build` + `vite-plugin-pwa` | `vite build` → `npx cap sync` → Gradle |
| Datenmodus | `VITE_DATA_MODE=supabase` | dito | dito |
| Netzwerkziel | Supabase direkt | Supabase direkt | Supabase direkt (`androidScheme: 'https'`) |
| Updatepfad | Worker-Deploy | Service Worker `autoUpdate` (`skipWaiting`, `clientsClaim`) | `latest.json`-Prüfung + manueller APK-Download |
| App-Info | `features/profile/AppInfoSection` | dito | dito, zusätzlich Versionscode |
| OCR-Assets | `/ocr/**` HTTP 200 | zusätzlich `CacheFirst`-Runtime-Cache | im APK unter `assets/public/ocr/` enthalten |

### Viewport und Safe Areas – belegter Konfigurationsfehler

```7:8:index.html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1e3a5f" />
```

Das Viewport-Meta enthält **kein `viewport-fit=cover`**. Ohne dieses Attribut liefert `env(safe-area-inset-*)` in WebView und Safari konstant `0px`. Damit sind alle Safe-Area-Tokens wirkungslos:

| Token | Definition | Konsumenten |
|---|---|---|
| `--safe-area-top/right/bottom/left` | `env(safe-area-inset-*, 0px)`, `v2/styles/tokens.css:41-44` | `v2/layout/AppShell.module.css:7-9,23,36`, `v2/ui/Dialog.module.css:10-12,20,54-57` |

Der Kommentar in `tokens.css:40` und `docs/revision/AMRtech-Payment-UI-System.md` behaupten explizit `viewport-fit=cover` — die Datei `index.html` (und identisch `android/app/src/main/assets/public/index.html`) setzt es nicht. Die dokumentierte Safe-Area-Behandlung ist also implementiert, aber nicht aktiv. Konsequenz auf Geräten mit Notch/Gesture-Bar: Inhalte und die Unterkante der Bottom-Navigation können unter Systemelemente laufen, obwohl der CSS-Code dafür vorbereitet ist.

### Manifest

| Feld | Wert | Quelle |
|---|---|---|
| `name` / `short_name` | AMRtech Payment | `vite.config.ts:12-13` |
| `display` | `standalone` | `vite.config.ts:17` |
| `orientation` | **`portrait`** | `vite.config.ts:18` |
| `start_url` / `scope` | `/` | `vite.config.ts:19-20` |
| Icons | 192, 512, 512 maskable | `vite.config.ts:21-38` |
| Live erreichbar | `/manifest.webmanifest` HTTP 200 | geprüft |
| Im APK enthalten | `android/app/src/main/assets/public/manifest.webmanifest` | geprüft |

`orientation: portrait` erzwingt Hochformat. Die Tabellen mit `min-width: 36rem` (2.9) können damit auf Mobilgeräten **nicht** durch Drehen entschärft werden – der Nutzer hat keinen Ausweg aus dem horizontalen Scrollen.

### Tabellenbreiten und Dialoge auf Mobilgeräten

| Element | Verhalten unter 360–390 px |
|---|---|
| Tabellen (3 Implementierungen) | horizontales Scrollen erzwungen durch `min-width: 36rem` = 576px; Aktionsspalte außerhalb des Sichtbereichs |
| `v2/ui/Dialog` | `max-height: calc(100dvh - var(--safe-area-top) - var(--space-8))` – mit inaktivem Safe-Area-Token effektiv `100dvh - 2rem`; funktioniert, aber ohne Notch-Reserve |
| Legacy `ConfirmDialog` | keine Safe-Area-Berücksichtigung, eigene CSS (`ConfirmDialog.module.css:38-47`) |
| Provisions-Bearbeitungsformulare | liegen im DOM nach der Tabelle; im Hochformat außerhalb des ersten Bildschirms, ohne Scrollführung (2.9) |

### Updatefunktion

| Pfad | Ist-Zustand |
|---|---|
| PWA | `registerType: 'autoUpdate'` mit `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches` (`vite.config.ts:9,41-44`) – neuer Deploy ersetzt die Shell ohne Nutzeraktion |
| APK | `appUpdateService` liest `ANDROID_UPDATE_MANIFEST_URL` = `https://amrtech-payment-downloads.amrtech.workers.dev/android/latest.json` (`domain/appUpdate/updateManifest.ts:1-2`), Timeout 12 s |
| Manifestvalidierung | streng: `parseUpdateManifest` prüft 10 Felder, SHA-256-Format, HTTPS und Zeitstempel (`updateManifest.ts:75-134`) |
| Statuslogik | `deriveUpdateStatus` mit `mandatory` über `minimumVersionCode` (`updateManifest.ts:136-157`) |
| Live-Manifest | valide; `versionName 1.0.2`, `versionCode 10002`, `minimumVersionCode 10000`, `mandatory: false` |
| Ergebnis für Nutzer der 1.0.2 | Status `current` – korrekt, aber damit kein Weg, einen Fix ohne neue Version auszurollen |

**Bewertung:** Verpackung, Auslieferung, Update-Mechanik und Assetkonsistenz sind in Ordnung und nachweislich korrekt. Der einzige plattformspezifische Fehler ist das fehlende `viewport-fit=cover`. Alle übrigen mobilen Beschwerden sind CSS-Layoutprobleme des gemeinsamen Frontends (2.9), keine Plattformunterschiede.

## 2.11 Befunde

1. **13 von 62 Routen sind reine Altpfade**, 11 weitere zeigen auf vollständig leere Tabellen (Verträge, Aktivierungen, Provisionsfälle, Bonus, Daten/Export). Nur 21 Routen sind für den Kern nötig.
2. **13 v2-Seiten sind Shells um Legacy-Inhalte.** Der „Rebuild" hat Layouts ersetzt, nicht die Interaktionslogik. Insbesondere der komplette Provisionsbereich ist innen unverändert Legacy.
3. **Der Startbildschirm `/sales` enthält keine Kundenliste** und filtert seine Suche nicht auf die sichtbaren Bereiche. Er ist damit die Hauptquelle des Eindrucks widersprüchlicher Kundenansichten.
4. **Zwei Buttonsysteme, zwei Tabellensysteme, zwei Dialogsysteme, drei Formularlayouts** existieren gleichzeitig. Höhen- und Layoutinkonsistenzen sind die direkte Folge, nicht Zufall.
5. **Tabellenüberlauf ist strukturell festgeschrieben** (`min-width: 36rem` in drei Dateien) und nicht durch Datenmenge verursacht.
6. **APK, Live-PWA und lokaler Build sind bit-identisch** (gleiche Bundle-Hashes, gleiche APK-SHA-256 wie im veröffentlichten Manifest). Es gibt keinen APK-spezifischen Fehler.
7. **`viewport-fit=cover` fehlt in `index.html`**, dadurch sind alle Safe-Area-Tokens wirkungslos, obwohl `AppShell` und `Dialog` sie auswerten.
8. **`orientation: portrait` im Manifest** verhindert, dass Nutzer breite Tabellen durch Drehen des Geräts lesbar machen.

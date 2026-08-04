# AMRtech Payment – Gesamtanalyse (Ist-Zustand)

**Stand:** August 2026  
**Repository:** `/Users/micha/amrtech-payment-leads`  
**Git-HEAD (Analyse):** `91d6fe8` (nicht gepusht)  
**Produktions-Worker:** `amrtech-payment` (Version `db5ced2e`)

---

## 1. Executive Summary

Die Anwendung verfügt über eine **technisch solide Backend-Schicht** (Supabase, RLS, Repositories, Pricing-, Recommendation-, Offer-, Commission- und CRM-Domain). Die **sichtbare Oberfläche und der Beratungsworkflow** sind jedoch durch schrittweise Feature-Erweiterungen fragmentiert:

- Mehrere parallele Einstiege für dieselbe fachliche Aufgabe (Beratung, Kostenvergleich)
- Dieselben Felder werden in mehreren Wizard-Schritten abgefragt
- UI-Komponenten sind pro Feature-Modul dupliziert (Buttons, Tabellen, Badges)
- Monolithische Seiten (`SalesWizardPage` ~1500 LOC, `LeadDetailPage` ~1800 LOC)
- Hotfixes beheben Symptome, erzeugen aber neue Seiteneffekte

**Diagnose:** Kein isoliertes Einzelproblem mehr, sondern **strukturelle Frontend- und Workflow-Schuld** auf intakter Datenbasis.

---

## 2. Produktiver Stand und offene Commits

| Commit | Inhalt | Push |
|--------|--------|------|
| `91d6fe8` | Commission-Bearbeitung + ResponsiveTable | Nein |
| `1374848` | Beratung: Kostenmodi, 0 €, Billing-Fix | Nein |
| `8929c18` | Kunden-Angebotsreview (Phase 1B) | Nein |
| `3c9203a` | CRM Phase 1A (Kundenakte) | Nein |

**Freeze-Empfehlung bis Freigabe des Zielkonzepts:** Keine weiteren Hotfixes außer Sicherheits-/Datenverlustfehler, keine neue APK, kein Push.

---

## 3. Technische Basis (erhaltenswert)

| Bereich | Bewertung | Anmerkung |
|---------|-----------|-----------|
| Supabase + Auth | ✅ Behalten | Prod-Modus verpflichtend |
| RLS | ✅ Behalten | Commission-, Offer-, CRM-Policies vorhanden |
| Repository-Pattern | ✅ Behalten | Local/Supabase Dual-Mode |
| Pricing Engine | ✅ Behalten | `domain/pricingEngine` |
| Recommendation Engine | ✅ Behalten | `domain/recommendationEngine` |
| Commission Engine | ✅ Behalten | `domain/commissionEngine` |
| Billing Import / OCR | ✅ Behalten | Optional im Wizard, PWA-Assets |
| Offer + Versionen + Workflow | ✅ Behalten | Freigabe, Versand, Annahme |
| CRM-Datenmodell (Lead, Contact, Task) | ✅ Behalten | Phase 1A solide |
| Cloudflare Worker + R2 | ✅ Behalten | PWA + APK-Download |
| Android-Signing | ✅ Behalten | Externes Worktree, Keystore |

---

## 4. Routen-Inventur

### 4.1 Öffentlich / Auth

| Route | Seite | Zweck | Bewertung |
|-------|-------|-------|-----------|
| `/login` | LoginPage | Anmeldung | Behalten |
| `/auth/callback` | AuthCallbackPage | OAuth/Magic Link | Behalten |
| `/set-password` | AuthCallbackPage | Passwort setzen | Behalten |
| `/offer-review/:token` | OfferReviewPage | Kunden-Angebotsprüfung | Behalten |

### 4.2 Vertrieb (AppShell)

| Route | Seite | Hauptnutzer | Hauptaktion | Bewertung |
|-------|-------|-------------|-------------|-----------|
| `/` → `/sales` | SalesWorkspacePage | Außendienst | Tagesplan, Fälle | **Umbau** (Shell) |
| `/sales/commission` | SalesCommissionPage | Außendienst | Eigene Provision (read) | Behalten |
| `/leads` | LeadsPage | Außendienst | Kunden suchen | Behalten (Listen-Pattern) |
| `/leads/new` | NewLeadPage | Außendienst | Kunde anlegen | Behalten |
| `/leads/:id` | LeadDetailPage | Außendienst | Kundenakte | **Umbau** (11 Tabs → 5–6) |
| `/leads/:id/edit` | EditLeadPage | Außendienst | Stammdaten | Behalten |
| `/advice` | AdviceEntry → Hub/Wizard | Außendienst | Beratung | **Umbau** (Workflow) |
| `/offers` | OffersPage | Außendienst | Angebotsliste | Behalten |
| `/offers/new` | NewOfferPage | Außendienst | Angebot manuell | Behalten (Sekundärweg) |
| `/offers/:id` | OfferDetailPage | Außendienst | Angebot bearbeiten | Behalten (modular) |
| `/contracts` | ContractsPage | Außendienst | Vertragsliste | Behalten |
| `/contracts/:id` | ContractDetailPage | Außendienst | Vertrag | Behalten |
| `/activations` | ActivationsPage | Außendienst | Aktivierungsliste | Behalten |
| `/activations/:id` | ActivationDetailPage | Außendienst | Aktivierung | Behalten |
| `/profile` | ProfilePage | Alle | Profil, App-Info | Behalten |

### 4.3 Verwaltung (Admin)

| Route | Seite | Bewertung |
|-------|-------|-----------|
| `/admin` | AdminOverviewPage | Behalten |
| `/admin/users` | AdminUsersPage | Umbau (ResponsiveTable) |
| `/admin/roles` | AdminRolesPage | Behalten |
| `/admin/catalog` | AdminCatalogPage (Tabs) | Behalten |
| `/admin/commission/*` | 7 Commission-Seiten | **Zusammenlegen** (Overview↔Cases) |
| `/admin/approvals` | AdminApprovalsPage | Behalten |
| `/admin/templates` | AdminTemplatesPage | Behalten |
| `/admin/data` | AdminDataPage | Behalten |
| `/admin/audit` | AdminAuditPage | Behalten |
| `/admin/system` | AdminSystemPage | Behalten |

### 4.4 Legacy-Routen (Redirects, Code noch vorhanden)

| Route | Redirect | Orphan-Code |
|-------|----------|-------------|
| `/calculator/*` | → `/advice` | `BestPayComparisonPage`, `BestPayComparisonHistoryPage`, `CalculatorPage` |
| `/sales/wizard` | → `/advice` | — |
| `/products` | → `/admin/catalog` | — |
| `/admin/commission/standards` | = `/models` | Duplikat-Route |

**Empfehlung:** Legacy-Seiten entfernen (Phase 8), nicht weiter reparieren.

---

## 5. Navigation

### Ist-Zustand

**Hauptnavigation (5 Punkte):** Arbeitsplatz · Kunden · Beratung · Verwaltung · Profil

**Probleme:**
- Angebote, Verträge, Aktivierungen haben **keinen eigenen Menüpunkt** (nur über Kunden-Highlight)
- Admin hat **9 Subnav-Punkte** + **7 Commission-Subnav-Punkte** = verschachtelte Zweitnavigation
- Kein einheitliches Breadcrumb-System

### Kundenakte: 11 Tabs

| Tab | Inhalt | Problem |
|-----|--------|---------|
| Übersicht | Stand, Hauptaktion, Quick Actions | OK als Hub |
| Ansprechpartner | CRUD Kontakte | OK |
| Timeline | Aktivitäten, Filter | Überlappt mit Notizen/Aufgaben |
| Aufgaben | CRUD Tasks | Formular auch in Übersicht/Timeline |
| Notizen | CRUD Notizen | = Timeline-Typ „Notiz“ |
| Dokumente | Angebote, Verträge, Dateien | OK |
| Beratung | Session-Link | OK |
| Angebote | Liste | Doppelt zu Dokumente/Übersicht |
| Verträge | Liste | Doppelt |
| Aktivierungen | Liste | Doppelt |
| Provision | **Leer** (nur Link) | Entfernen oder befüllen |

**Empfehlung:** 5–6 Tabs: Übersicht · Kontakte · Vorgänge (Timeline+Aufgaben+Notizen) · Dokumente · Beratung & Angebote · Verträge & Aktivierung

---

## 6. Beratungsworkflow (Ist)

### Einstieg

- `/advice` ohne Query → **AdviceHubPage** (Session-Liste)
- `/advice?session=…` / `?new=1` / `?leadId=…` → **SalesWizardPage**

### Schritte (6 sichtbar, 7 intern)

| Schritt | Felder | Probleme |
|---------|--------|----------|
| 1 Kunde | Lead suchen / neu / anonym | Branche fehlt im Prospect-Step |
| 2 Ausgangslage | Kostenmodi, Ist-Kosten, optional Umsatz, Billing | Umsatz **doppelt** in Schritt 3 |
| 3 Bedarf | Umsatz, Transaktionen, Terminals, Laufzeit, Branche, Card-Mix | Redundanz zu Schritt 4 (Szenario-Config) |
| 4 Vergleich | Szenarien anlegen/berechnen, Varianten wählen | UX: „Szenario anlegen“ ohne klare Führung |
| 5 Angebot | Entwurf erzeugen, Freigabe | Angebot + Freigabe in einem sichtbaren Schritt |
| 6 Prüfung | Abschluss, Links | OK |

### Parallele Implementierungen

| Seite | Status | LOC (ca.) |
|-------|--------|-----------|
| SalesWizardPage | **Aktiv** | ~1500 |
| BestPayComparisonPage | Orphan | ~460 |
| CalculatorPage | Orphan | ~200 |
| AdviceHubPage | Aktiv | ~150 |

---

## 7. Bekannte Fehlerbilder (strukturell)

### Beratung
- Kostenmodi erst seit Hotfix `1374848` explizit; vorher implizite Validierung
- `persistNeed()` überschrieb Session-Werte (behoben, aber Pattern zeigt State-Mirror-Problem)
- Lokaler React-State spiegelt Session-State (`monthlyTotal`, `monthlyVolume`, …)

### Provision
- Supabase-Exceptions nicht abgefangen (behoben in `91d6fe8`)
- Bulk-`saveCatalog` blockierte Einzel-Saves (behoben: `saveRules`/`saveAssignments`)
- Admin zeigt `offerId.slice(0,8)` statt Angebotsnummer
- 7 Commission-Seiten mit Daten-Overlap (Overview ↔ Cases)

### Mobile / Tabellen
- `ResponsiveTable` nur auf 3 von 7 Commission-Seiten
- AdminUsersPage: Inline-Editing in Tabellenzellen → overflow
- Breakpoints inkonsistent (719/720/721 px)
- `--color-success-light` etc. in CSS referenziert, aber nicht in `variables.css`

### UI allgemein
- 22+ Module mit eigener `.primaryAction`-Definition
- Keine globale Button-Komponente
- Wizard nutzt rohe Checkboxen statt `CheckboxField`
- Technische Status-Labels für Admin sichtbar (`activation_pending`)

---

## 8. PWA / APK

| Aspekt | Web/PWA | APK |
|--------|---------|-----|
| Build | `dist/` via Vite | Gleicher `dist/` via Capacitor |
| Update | Service Worker autoUpdate | Manueller Download (R2 + Worker) |
| Version | package.json 1.0.0 | 1.0.0 (10000), 1.0.2 geplant |
| Android-Ordner | Nicht im Repo | Separates Worktree |

**Fazit:** Ein responsive Web-Fix gilt für PWA und APK gleichermaßen. Keine parallele APK-CSS-Welt nötig.

---

## 9. Klassifikation: Behalten / Umbauen / Entfernen

### Behalten (Domain + Services)
- Gesamte `domain/`-Schicht (Engines, Validierung, Snapshots)
- `services/` (Wizard, Offer, Commission, Lead, Billing, Recommendation)
- `repositories/` (Interfaces + Supabase + Local)
- Modulare Offer-Sections (`OfferWorkflowSection`, `OfferBillingImportSection`, …)
- `LeadForm`, `ResponsiveTable` (als Startpunkt UI-System)

### Umbauen (UI + Workflow)
- `SalesWizardPage` → neuer 6-Schritt-Wizard ohne Feld-Duplikate
- `LeadDetailPage` → reduzierte Tabs, eine Formular-Instanz pro Entität
- Commission-Admin → weniger Seiten, ein Tabellen-Pattern
- App-Shell, Navigation, Button/Form-System

### Entfernen
- `BestPayComparisonPage`, `BestPayComparisonHistoryPage`, `CalculatorPage`
- `/admin/commission/standards` (Duplikat-Route)
- Leerer Provision-Tab in Kundenakte
- `features/dashboard/` (leer)

---

## 10. Hauptursachen (Root Causes)

1. **Feature-weise UI-Entwicklung** ohne durchgängiges Designsystem
2. **Workflow-Erweiterung** (Calculator → Wizard → CRM → Offer → Commission) ohne Refactoring der Eingabeschritte
3. **State-Mirror** zwischen React-Local-State und Session-Persistenz
4. **Monolithische Seiten** statt composable Feature-Sections
5. **Hotfix-Kultur** ohne Freeze → jeder Fix erzeugt Regressionen an anderer Stelle
6. **Fehlende End-to-End-Abnahme** (nur Unit-Tests + HTTP-200-Smoke)

---

## 11. Nächste Schritte

Siehe begleitende Dokumente:
- `AMRtech-Payment-Zielkonzept.md` – Ziel-Workflow und Architektur
- `AMRtech-Payment-Feldmatrix.md` – Feld-Source-of-Truth
- `AMRtech-Payment-UI-System.md` – Verbindliches UI-System
- `AMRtech-Payment-Umbauplan.md` – Phasenplan
- `AMRtech-Payment-Test-und-Abnahme.md` – Abnahmekriterien

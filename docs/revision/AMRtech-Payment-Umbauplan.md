# AMRtech Payment – Umbauplan

**Stand:** August 2026  
**Strategie:** Variante B – Frontend-Neubau auf bestehender Domain  
**Geschätzter Gesamtaufwand:** 8–12 Wochen (1–2 Entwickler, abhängig von PO-Feedback-Zyklen)

---

## Phase 0 – Freeze und Inventur ✅

**Scope:** Analyse, Dokumentation, Feature-Freeze  
**Dauer:** 1 Woche  
**Status:** Abgeschlossen (dieses Dokumentenpaket)

| Aktivität | Ergebnis |
|-----------|----------|
| Ist-Inventur aller Routen | `AMRtech-Payment-Gesamtanalyse.md` |
| Feldmatrix | `AMRtech-Payment-Feldmatrix.md` |
| Zielkonzept | `AMRtech-Payment-Zielkonzept.md` |
| UI-System | `AMRtech-Payment-UI-System.md` |
| Testkonzept | `AMRtech-Payment-Test-und-Abnahme.md` |

**Abhängigkeiten:** PO-Freigabe des Konzepts  
**Abnahme:** PO signiert Zielkonzept + offene Entscheidungen geklärt  
**Commit/Deploy:** Keine  
**Rückfall:** Weiterbetrieb aktueller Version (Hotfix-Commits nicht pushen)

---

## Phase 1 – UI-Fundament

**Scope:** Tokens, Button, StatusBadge, Modal, ResponsiveTable flächendeckend  
**Dauer:** 1,5–2 Wochen

| Deliverable | Details |
|-------------|---------|
| `tokens.css` + `breakpoints.css` | Fehlende semantische Farben, zentrale Breakpoints |
| `Button` | Ersetzt `.primaryAction` etc. |
| `StatusBadge` | Generisches Primitive |
| `Modal` | Form-Dialoge |
| `ResponsiveTable` | Migration aller Admin-Raw-Tables |
| Storybook/Beispielseite | Optional: `/admin/system` erweitern als UI-Katalog |

**Tests:** Unit-Tests für Button/Modal; ResponsiveTable-Test (bestehend erweitern)  
**Abnahme:** UI-Katalog auf 360px + Desktop ohne Overflow; alle Admin-Tabellen responsive  
**Deploy:** Ja (nur UI-Infrastruktur, kein Workflow-Change)  
**Rückfall:** Feature-Flags; alte CSS-Klassen parallel bis Migration

---

## Phase 2 – Kunden und Kundenakte

**Scope:** LeadForm beibehalten; LeadDetailPage Tab-Reduktion  
**Dauer:** 1,5–2 Wochen

| Deliverable | Details |
|-------------|---------|
| 6-Tab-Kundenakte | Übersicht, Kontakte, Vorgänge, Beratung&Angebote, Verträge&Aktivierung, Dokumente |
| Vorgänge-Tab | Timeline + Aufgaben + Notizen (ein Formular-Kontext) |
| Provision-Tab entfernen | Link in Übersicht |
| PageHeader vereinheitlichen | Titel + Beschreibung + 1 Primary |
| Feld-Sync | Lead.industry aus Wizard need (Vorbereitung Phase 3) |

**Tests:** customerRecordView-Tests; Browser-Test Kundenakte Tabs  
**Abnahme:** Keine doppelten Formulare; mobile 360px grün  
**Deploy:** Ja  
**Rückfall:** Feature-Flag `VITE_CRM_V2`

---

## Phase 3 – Beratung komplett (Kernphase)

**Scope:** Neuer Wizard unter Feature-Flag  
**Dauer:** 2–3 Wochen

| Deliverable | Details |
|-------------|---------|
| `features/advice/` | Neuer Wizard, ~6 Step-Components |
| Schritt 1–6 | Gemäß Zielkonzept, keine Feld-Duplikate |
| State | Direkt auf Session, kein Local-State-Mirror |
| Kostenmodi | manual / billing_import / no_current_costs |
| Auto-Berechnung Schritt 4 | Default-Szenario beim Betreten |
| Billing-Import | Bestehende `OfferBillingImportSection` einbinden |
| Legacy | `/advice/legacy` für alten Wizard (intern) |

**Services:** `salesWizardService` beibehalten, API ggf. schlanker  
**Tests:** Bestehende Wizard-Tests erweitern; E2E-Klickpfad Beratung  
**Abnahme:** PO-Szenarien: mit/ohne Kunde, 0€, OCR, Angebot  
**Deploy:** Feature-Flag `VITE_ADVICE_V2=true` auf Staging  
**Rückfall:** Flag off → alter Wizard

---

## Phase 4 – Angebote und Freigaben

**Scope:** OfferDetailPage + Workflow UI vereinheitlichen  
**Dauer:** 1–1,5 Wochen

| Deliverable | Details |
|-------------|---------|
| OfferWorkflowSection | Inline-Panels → Modal |
| Kundenlink / Review | Phase 1B beibehalten, UI polish |
| Angebotsnummer überall | Keine UUID-Fragmente |
| Freigabe-Flow | Eine klare Hauptaktion pro Status |

**Tests:** offerWorkflow-Tests; E2E Freigabe  
**Abnahme:** Angebot erzeugen → Freigabe → Versand klickbar  
**Deploy:** Ja

---

## Phase 5 – BestPay-Handoff, Verträge, Aktivierung

**Scope:** Nach-Angebot-Prozesse UI-polish  
**Dauer:** 1 Woche

| Deliverable | Details |
|-------------|---------|
| ContractDetailPage | ResponsiveTable scroll |
| ActivationDetailPage | Modal statt Ad-hoc-Dialog |
| Handoff-Hinweise | Fachliche Texte in Schritt 6 |

**Abnahme:** Mobile Activation/Contract grün  
**Deploy:** Ja

---

## Phase 6 – Provision und Verwaltung

**Scope:** Commission-Admin konsolidieren  
**Dauer:** 1–1,5 Wochen

| Deliverable | Details |
|-------------|---------|
| 5 statt 7 Commission-Seiten | Overview/Cases/Payments zusammenlegen |
| offerNumber statt offerId | Admin-Tabellen |
| Mitarbeiter-Auswahl | Dropdown statt ID-Textfeld |
| Sonderzahlung | Modal in Fälle |

**Tests:** commissionCatalogAdminService, commissionShareModel, RLS-Tests  
**Abnahme:** Admin speichert Standard + Vereinbarung, Reload zeigt Wert  
**Deploy:** Ja

---

## Phase 7 – PWA / APK / Mobile Abnahme

**Scope:** Production-Build, Deploy, APK 1.0.2+  
**Dauer:** 1 Woche

| Deliverable | Details |
|-------------|---------|
| PWA Deploy | Worker `amrtech-payment` |
| APK Build | versionName 1.0.2, versionCode 10002 |
| ProfilePage | App-Info, Update-Check |
| Gerätetest | Dokumentiert (Android) |

**Abnahme:** Vollständiger Test- und Abnahmeplan (siehe Test-Dokument)  
**Deploy:** PWA ja; APK nach PWA-Smoke  
**Rückfall:** Vorherige APK-Version auf R2 behalten

---

## Phase 8 – Migration, Umschaltung, Alt-UI entfernen

**Scope:** Legacy entfernen, Flags entfernen  
**Dauer:** 1 Woche

| Entfernen | Details |
|-----------|---------|
| `SalesWizardPage` (alt) | Nach Abnahme Advice V2 |
| `BestPayComparisonPage` | Orphan |
| `CalculatorPage` | Orphan |
| Legacy-Routes | Redirects bleiben 301, Code weg |
| Feature-Flags | `VITE_ADVICE_V2`, `VITE_CRM_V2` |
| Duplikat-CSS | `.primaryAction` in Feature-Modulen |

**Abnahme:** Kein toter Code; grep findet keine Legacy-Imports  
**Deploy:** Final Production  
**Rückfall:** Git-Revert auf Phase-7-Tag

---

## Commit- und Deploy-Strategie

| Phase | Commit-Stil | Deploy |
|-------|-------------|--------|
| 0 | Keine Commits (Doku only) | Nein |
| 1–6 | `feat(ui-v2): …` pro Phase | Staging → Prod nach Abnahme |
| 7 | `chore(release): pwa and apk 1.0.2` | Prod |
| 8 | `chore: remove legacy advice ui` | Prod |

**Regel:** Max. 1 Commit pro Phase (keine Mini-Commit-Flut).  
**Push:** Erst nach PO-Abnahme pro Phase.

---

## Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| PO ändert Workflow mid-flight | Mittel | Hoch | Freeze nach Phase 0; Change Request pro Phase |
| Supabase RLS blockiert neue Flows | Niedrig | Hoch | RLS-Tests in CI; Staging mit Prod-Schema |
| Parallelbetrieb verwirrt Nutzer | Mittel | Mittel | Feature-Flag nur intern; kurze Parallel-Phase |
| Aufwand unterschätzt | Mittel | Mittel | Phase 3 als kritischen Pfad; Puffer 2 Wochen |
| APK-Gerätetest fehlt | Hoch | Mittel | Ehrlich dokumentieren; Emulator-Minimum |

---

## Aufwandsschätzung (Personentage)

| Phase | PT (min–max) |
|-------|--------------|
| 0 | 3–5 ✅ |
| 1 | 8–12 |
| 2 | 8–12 |
| 3 | 15–22 |
| 4 | 5–8 |
| 5 | 5–7 |
| 6 | 5–8 |
| 7 | 5–7 |
| 8 | 3–5 |
| **Gesamt** | **57–86 PT** |

Bei 1 Vollzeit-Entwickler: **12–17 Wochen**  
Bei 2 Entwicklern (parallel Phase 1+2): **8–12 Wochen**

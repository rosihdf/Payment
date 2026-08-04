# AMRtech Payment – Test- und Abnahmekonzept

**Stand:** August 2026  
**Grundsatz:** Ein Block gilt nicht als fertig, solange nur HTTP 200 oder Unit-Tests grün sind.

---

## 1. Testpyramide

```
                    ┌─────────────┐
                    │ PO-Abnahme  │  Manuell, Szenario-basiert
                    ├─────────────┤
                    │ Gerätetest  │  APK + echtes Smartphone
                    ├─────────────┤
                    │ E2E Browser │  Playwright/Cypress (neu)
                    ├─────────────┤
                    │ Viewport    │  Mobile 360/390/412 + Tablet
                    ├─────────────┤
                    │ Integration │  Service + Repository
                    ├─────────────┤
                    │ Domain/Unit │  Vitest (bestehend)
                    └─────────────┘
```

---

## 2. Bestehende Tests (behalten, nicht abschwächen)

| Bereich | Dateien (Auswahl) | Stand |
|---------|-------------------|-------|
| Wizard/Beratung | salesWizardServiceB01, costCaptureMode, adviceDraftPersistence | 994 Tests grün |
| Commission | commissionShareModel, commissionCatalogAdminService, commissionRlsMigration | Grün |
| Offer/Workflow | offerWorkflowB03, contractManagementC | Grün |
| CRM | customerRecordA05, salesDayWorkspaceA06 | Grün |
| Domain | pricing, recommendation, billing engines | Grün |

**Regel:** Keine `.skip`, keine `.only`, keine React-act-Warnungen neu einführen.

---

## 3. Neue Test-Ebenen (pro Phase)

### 3.1 Domain-Tests (bestehend erweitern)

| Test | Phase | Inhalt |
|------|-------|--------|
| Feldmatrix-Konsistenz | 3 | Kein Feld doppelt validiert |
| CostCaptureMode | 3 | Alle 3 Modi + 0 € |
| CustomerNeed-Ableitung | 3 | Lead + ManualInput + Baseline |
| Wizard-Schritt-Validierung | 3 | Pro Schritt Pflicht/Optional |

### 3.2 Service-Tests

| Test | Phase | Inhalt |
|------|-------|--------|
| Commission saveRules/saveAssignments | 6 | Granulares Persist |
| Wizard ohne State-Mirror | 3 | Session direkt |
| Offer-Create aus Wizard | 4 | Snapshot immutable |

### 3.3 Repository / RLS

| Test | Phase | Inhalt |
|------|-------|--------|
| commissionRlsMigration | 6 | Statische SQL-Checks (bestehend) |
| Supabase Integration (optional) | 6 | Admin upsert gegen Staging |
| Field service read-only | 6 | forbidden auf write |

### 3.4 Browser-Integration (neu einführen)

**Tool-Empfehlung:** Playwright

| Szenario | Phase |
|----------|-------|
| Login → Beratung → 0€ → Weiter → Angebot | 3 |
| Admin → Provision → Regel ändern → Reload | 6 |
| Kunde anlegen → Kundenakte → Tab wechseln | 2 |
| Angebot → Freigabe → Versand | 4 |

### 3.5 Mobile Viewport-Tests

**Tool:** Playwright mit Viewport-Emulation + visuelle Snapshots

| Viewport | Breite | Prüfung |
|----------|--------|---------|
| Small phone | 360px | scrollWidth === clientWidth (body) |
| iPhone 12 | 390px | Buttons sichtbar |
| Pixel | 412px | Tabellen als Cards |
| Tablet | 768px | Sidebar sichtbar |
| Desktop | 1280px | 2-Spalten-Formulare |

**Assertion pro Seite:**
```javascript
expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(
  await page.evaluate(() => document.body.clientWidth) + 1
);
```

Ausnahme: explizit markierte Scroll-Tabellen (`data-scroll-table="true"`).

### 3.6 Visuelle Screenshots

| Seite | Viewports | Phase |
|-------|-----------|-------|
| Beratung Schritt 1–6 | 360 + 1280 | 3 |
| Kundenakte Tabs | 360 + 1280 | 2 |
| Commission Admin | 360 + 1280 | 6 |
| Arbeitsplatz | 360 + 1280 | 2 |

Speicherort: `tmp-screenshots/revision/` (nicht committen).

---

## 4. PWA-Smoke (verbindlich pro Release)

**Nicht ausreichend:** Nur `smoke-production.mjs` (HTTP 200 + SPA-Root).

### Manueller Smoke (Admin + Außendienst)

| # | Szenario | Rolle |
|---|----------|-------|
| 1 | Login | Alle |
| 2 | Arbeitsplatz laden | AD |
| 3 | Kunde suchen, Kundenakte öffnen | AD |
| 4 | Beratung: Kunde wählen | AD |
| 5 | Ausgangslage: manuell, 0 €, Weiter | AD |
| 6 | Bedarf: Umsatz, Weiter | AD |
| 7 | Empfehlung: Variante wählen | AD |
| 8 | Angebot erzeugen | AD |
| 9 | Zurück in Schritte → Werte bleiben | AD |
| 10 | OCR-Option öffnet Import | AD |
| 11 | Provision: Standard ändern, Reload | Admin |
| 12 | Provision: Vereinbarung ändern, Reload | Admin |
| 13 | Mobile 360px: Provision, Users, Beratung | Admin/AD |
| 14 | Keine UUID in Vertriebs-UI | AD |

### Automatisierbar (Ziel Phase 7)

Mindestens Szenarien 1–8 als Playwright-Suite.

---

## 5. APK-Gerätetest

| # | Prüfung | Gerät/Emulator |
|---|---------|----------------|
| 1 | App startet, Login | Physisch bevorzugt |
| 2 | Beratung komplett (wie PWA-Smoke) | Physisch |
| 3 | Tabellen als Cards | Physisch |
| 4 | Safe Area (Notch) | Physisch |
| 5 | Profil → App-Info sichtbar | Physisch |
| 6 | Update-Check (falls implementiert) | Physisch |
| 7 | Offline-Hinweis (PWA) | Optional |

**Dokumentation:** Gerätetest-Protokoll in Release-Notes; wenn offen, ehrlich vermerken.

---

## 6. Testdaten

| Datensatz | Zweck |
|-----------|-------|
| Demo-Seed (bestehend) | Unit/Integration |
| `TEST – Phase 1B Kundenlink` | Offer-Review E2E |
| Dedizierte Revision-Test-Leads | Browser-E2E (neu anlegen) |
| Admin-User (active, role=admin) | Commission-Tests |
| Field-Service-User | Read-only-Tests |

**Regel:** Testdaten mit `TEST-` Präfix, in Staging/Prod klar erkennbar.

---

## 7. CI-Pipeline (Ziel)

| Step | Tool | Blockiert Merge |
|------|------|-----------------|
| Lint | oxlint | Ja |
| Typecheck | tsc -b | Ja |
| Unit/Integration | vitest | Ja |
| Build | vite build --mode production | Ja |
| OCR-Verify | verify-ocr-build-assets | Ja |
| Secretscan | secretscan-dist | Ja |
| git diff --check | whitespace | Ja |
| Playwright (optional) | playwright test | Ja (ab Phase 3) |
| Viewport-Check (optional) | custom script | Ja (ab Phase 1) |

---

## 8. Abnahmekriterien pro Phase

### Phase 1 – UI-Fundament
- [ ] Button-Komponente auf ≥3 Seiten migriert
- [ ] Alle Admin-Tabellen responsive (360px)
- [ ] Keine `--color-*-light` Undef-Variablen
- [ ] Viewport-Test grün für Admin-Seiten

### Phase 2 – Kundenakte
- [ ] ≤6 Tabs
- [ ] Kein leerer Provision-Tab
- [ ] Ein Formular-Kontext für Vorgänge
- [ ] Mobile Smoke Kundenakte

### Phase 3 – Beratung
- [ ] Kein Kartenumsatz in Schritt 2
- [ ] 0 € durchgängig
- [ ] Kein State-Mirror (Session direkt)
- [ ] E2E: Beratung bis Angebot
- [ ] Legacy unter Flag erreichbar

### Phase 4 – Angebote
- [ ] Freigabe-Flow E2E
- [ ] Keine UUID in UI

### Phase 6 – Provision
- [ ] Admin save + reload
- [ ] AD read-only
- [ ] ≤5 Commission-Seiten

### Phase 7 – Release
- [ ] PWA-Smoke 14 Punkte grün
- [ ] APK gebaut + signiert
- [ ] Gerätetest dokumentiert

### Phase 8 – Cleanup
- [ ] Kein Legacy-Wizard-Code
- [ ] Kein orphan BestPayComparison
- [ ] Feature-Flags entfernt

---

## 9. PO-Abnahme (manuell, verbindlich)

Pro Phase: PO führt Checkliste in Staging durch, signiert in Ticket/Dokument.

| Phase | PO-Zeitaufwand |
|-------|----------------|
| 0 Konzept | 2h Review |
| 1 UI | 1h |
| 2 CRM | 2h |
| 3 Beratung | 4h (kritisch) |
| 4 Angebot | 2h |
| 5–6 Rest | 2h |
| 7 Release | 3h (inkl. Mobile) |

---

## 10. Regression-Scope (immer)

Bei jeder Phase mindestens prüfen:

- Login / Logout
- Kunden CRUD
- Angebotsliste + Detail
- Tarife/Produkte Admin (read)
- PWA lädt (Service Worker)
- Keine Console-Errors auf Startseite
- Bestehende Unit-Tests grün (994+)

---

## 11. Was explizit nicht zählt

| Prüfung | Warum nicht ausreichend |
|---------|-------------------------|
| HTTP 200 Smoke | Kein Workflow |
| Bundle baut | Kein Verhalten |
| Lint grün | Keine Fachlichkeit |
| Einzelner Unit-Test | Kein Zusammenspiel |
| Dev-Server lokal | ≠ Production/PWA |

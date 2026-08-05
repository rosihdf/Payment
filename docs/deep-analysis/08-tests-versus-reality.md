# 08 – Tests gegen Realität

Nur Ist-Zustand. Keine Änderungen.

## 8.0 Hauptbefund vorweg

**Alle Tests laufen im Local-/Demo-Datenmodus gegen `localStorage`. Kein einziger Test läuft gegen eine echte Supabase-Instanz.** `localStorage` kennt keine Fremdschlüssel, keine RLS und kein Layout. Genau in diesen drei Bereichen liegen alle real gemeldeten Fehler. Die grüne Testsuite ist deshalb kein Widerspruch zum defekten Produkt, sondern die logische Folge des Testaufbaus.

## 8.1 Umfang

| Ebene | Umfang |
|---|---|
| Vitest-Dateien | **154** in `src/test/` |
| Vitest-Testfälle | ca. 1073 (Angabe aus dem RC1-Bericht) |
| Playwright-Specs | **4** Dateien: `field-flow.spec.ts`, `admin-flow.spec.ts`, `rc-extras.spec.ts`, `public-offer-review.spec.ts` |
| Playwright-Testfälle | ca. 13 |
| `console.log/warn/error` im Produktivcode | 0 |

## 8.2 Klassifizierung der Vitest-Tests

| Kategorie | Dateien | Anteil | Was wirklich geprüft wird | Beispiele |
|---|---|---|---|---|
| **Domain-/Pure-Function-Tests** (`.ts`, keine UI) | ~104 | 68 % | reine Rechenlogik, Normalisierung, Validierung – ohne jede Infrastruktur | `pricingEvaluationEngine.test.ts`, `commissionCalculationEngine.test.ts`, `normalizeLead.test.ts`, `costCaptureMode.test.ts` |
| **Render-/String-Tests** (`.tsx`, keine Interaktion) | ~19 | 13 % | dass eine Komponente ohne Absturz rendert und bestimmte Texte enthält | `routing.test.tsx`, `accessDenied.test.tsx`, `v2ResponsiveViewport.test.tsx` |
| **Echte State-Interaktion** (`userEvent`) | **29** | 19 % | Klicks, Eingaben, Zustandsübergänge in jsdom | `leadCreate.test.tsx`, `productForm.test.tsx`, `commissionAdminUiPersistence.test.tsx` |
| **Persistenztests** (`localStorage`) | **18** | 12 % | Schreiben/Lesen im Browser-Storage, Migrationen | `offerStorageMigration.test.ts`, `commissionProvisionPersistence.test.ts` |
| **Mock-Service-Tests** (`vi.mock`) | **8** | 5 % | Aufrufverhalten gegen einen gefälschten Supabase-Client | `supabaseAuthService.test.ts`, `adminUsersApiWorker.test.ts` |
| **Supabase-/RLS-bezogen** | **14** | 9 % | Konfigurationsprüfung und **Textanalyse von SQL-Dateien** | `supabaseInfraB01.test.ts`, `commissionRlsMigration.test.ts` |
| **Responsive-/Overflow-Tests** | **1** | <1 % | siehe 8.3 | `v2ResponsiveViewport.test.tsx` |
| **Snapshot-Tests** | 0 | 0 % | – | – |

Zwei Drittel der Suite prüft Rechenlogik. Diese Tests sind aussagekräftig für Berechnungen und wertlos für Infrastruktur, Persistenz und Layout.

## 8.3 Der Overflow-Test kann Overflow nicht erkennen

```99:104:src/test/v2ResponsiveViewport.test.tsx
function assertNoHorizontalOverflow(label: string) {
  const root = document.documentElement;
  const body = document.body;
  expect(root.scrollWidth, `${label}: html overflow`).toBeLessThanOrEqual(root.clientWidth + 1);
  expect(body.scrollWidth, `${label}: body overflow`).toBeLessThanOrEqual(body.clientWidth + 1);
}
```

Viewport-Simulation: `document.documentElement.style.width = '${width}px'` plus `window.innerWidth` (`v2ResponsiveViewport.test.tsx:121-124`).

| Problem | Konsequenz |
|---|---|
| jsdom berechnet **kein CSS-Layout** | `scrollWidth` und `clientWidth` sind praktisch immer gleich; die Assertion ist strukturell immer erfüllt |
| `min-width: 36rem` auf Tabellen wird nicht ausgewertet | die dokumentierte Overflow-Ursache (Dok. 02) ist unsichtbar |
| `white-space: nowrap` wird nicht ausgewertet | breite Zellen erzeugen keinen messbaren `scrollWidth` |
| `matchMedia` ist im Setup hartkodiert: `matches: query.includes('min-width')` (`src/test/setup.ts:36-47`) | **alle** Desktop-Media-Queries greifen immer, Mobile-Zweige werden nie getestet |
| getestete Routen | `/sales`, `/leads`, `/advice`, `/offers/:id`, `/contracts/:id`, `/activations/:id`, `/admin/users`, `/admin/catalog`, `/admin/commission/overview` – **nicht** `/admin/commission/standards` und `/admin/commission/cases`, die die breitesten Tabellen enthalten |

Der Test ist ein Smoke-Test („rendert ohne Absturz"), kein Layout-Regressionstest. Er kann per Konstruktion nicht rot werden, wenn eine Tabelle überläuft.

## 8.4 Datenmodus in Tests

| Modus | Wie gesetzt | Umfang |
|---|---|---|
| Local/Demo (Default) | kein `VITE_DATA_MODE` → `Local*Repository` + `resetDemoDataForTests()` | ~95 % aller UI-Tests |
| explizit `local` | `vi.stubEnv('VITE_DATA_MODE', 'local')` | `adminUsersUiB05.test.tsx:95` |
| `supabase` mit Mock-URL | `vi.stubEnv('VITE_DATA_MODE', 'supabase')` + Mock-Client | `profileSupabaseUi.test.tsx:14`, `adminUsersUiB05.test.tsx:117`, `requireAuthRedirect.test.tsx:13` |
| RLS-Prüfung | **Textanalyse der Migrationsdateien**, keine Datenbank | `commissionRlsMigration.test.ts` |
| Supabase-Client gemockt | `vi.mock('@supabase/supabase-js')` | `adminUsersApiWorker.test.ts`, `supabaseAuthService.test.ts` |

**Kein Test führt eine echte Query gegen `vohnqrftkuefkugabcob` oder eine lokale Postgres-Instanz aus.** Damit ist keine Fremdschlüssel-, Constraint- oder RLS-Verletzung testbar.

## 8.5 Playwright E2E

| Spec | Datenmodus | Seed / Persistenz | Gemockt |
|---|---|---|---|
| `field-flow.spec.ts` | Demo (Vite-Dev-Server, `PROD === false`) | `seedDemoData()` beim App-Start, `seedPricingCatalogForE2E()` per `addInitScript` | – |
| `admin-flow.spec.ts` | Demo + `RoleSwitcher` | `localStorage`, `page.reload()` für Provisionsprüfung | – |
| `rc-extras.spec.ts` | Demo | Beratungs-Reload, Mitarbeitervereinbarung | öffentliche Angebots-API via `page.route` |
| `public-offer-review.spec.ts` | Dev-Server | – | `/api/public/offers/*` **vollständig gemockt** |

`playwright.config.ts:6-11` startet den Vite-Dev-Server. Weil `PROD === false`, greift der Demo-Modus. `e2e/helpers.ts:53-61` schreibt 5 localStorage-Keys vor dem `goto`.

Nicht abgedeckt: Supabase-Modus, echte RLS-Zuordnung, mobile Viewports mit Overflow-Prüfung, das Provisions-Fälle-Panel, echte OCR-Verarbeitung.

## 8.6 Warum die realen Fehler unentdeckt blieben

| Realer Fehler | Warum kein Test ihn findet | Beleg |
|---|---|---|
| **(a) Keine Kunden in „Meine Kunden"** | Zwei Gründe. Erstens prüft kein Test den Supabase-Modus mit echtem `assigned_sales_user_id`; `leadService.test.ts:142` testet den Rollenfilter gegen ein In-Memory-Repository mit Demo-Zuordnungen aus `DEMO_LEAD_ASSIGNMENTS`. Zweitens gibt es keinen Test, der prüft, dass `/sales` überhaupt Kunden anzeigt – die Seite rendert nur `dayWork`, und im Demo-Seed existieren Aufgaben, in Produktion nicht (`sales_tasks` = 0 Zeilen). | `leadService.ts:218-224`, `normalizeLead.ts:22-31`, `WorkspacePage.tsx:116-136` |
| **(b) Beratungsbuttons ohne Wirkung** | Die Fehlerursache ist ein Fremdschlüssel in Postgres. `localStorage` hat keine Fremdschlüssel, also ist die identische Codereihenfolge im Demo-Modus fehlerfrei. Zusätzlich gibt es keinen Test, der prüft, dass ein fehlgeschlagener Persistenzaufruf eine Fehlermeldung erzeugt – `ensurePersisted` hat kein `.catch`, und kein Test provoziert eine Ablehnung. | `salesWizardService.ts:158-159`, `useAdviceSession.ts:54-93`, Dok. 04 |
| **(c) Werte werden gelöscht** | Der Dezimalfehler (`centsToInput`/`parseEuroToCents`) wird durch keinen Test abgedeckt: es existiert kein Test, der „12,50" tippt und danach den Sitzungswert prüft. Die Formatter werden nur isoliert mit vollständigen Zahlen getestet. Das Race durch fehlende Entprellung ist in jsdom nicht reproduzierbar, weil `localStorage` synchron antwortet. | `formatters.ts:8-22`, `CostsStep.tsx:77-83` |
| **(d) Bearbeiten-Formular erscheint unten** | Es existiert kein Test auf DOM-Reihenfolge, Scrollposition oder Sichtbarkeit im Viewport. `commissionAdminUiPersistence.test.tsx` findet Elemente per Text und ist gegenüber der Position blind. In jsdom gibt es kein Scrolling. | `AdminCommissionModelsPage.tsx:259`, `AdminCommissionAssignmentsPage.tsx:275` |
| **(e) Provision speichert nicht** | Der Schreibpfad für Mitarbeiterwerte funktioniert tatsächlich (Dok. 06). Der reale Fehler ist, dass `displaySharePercent` bei Standardregeln validiert, aber nicht persistiert wird. Kein Test prüft „Wert eingeben → speichern → neu laden → derselbe Wert steht da" für dieses Feld. `commissionProvisionPersistence.test.ts:12-13` verweist selbst darauf, dass Supabase-UI-Tests fehlen. | `AdminCommissionModelsPage.tsx:59-78`, `commissionCatalogAdminService.ts:232-270` |
| **(f) Tabellen laufen über** | Die einzige Overflow-Assertion ist in jsdom wirkungslos (8.3), `matchMedia` liefert immer Desktop, und Playwright läuft ausschließlich in Desktop-Chrome ohne Overflow-Prüfung. Die beiden Seiten mit den breitesten Tabellen sind vom Viewport-Test gar nicht erfasst. | `v2ResponsiveViewport.test.tsx:99-104,121-124`, `setup.ts:36-47`, `AdminLayout.module.css:97` |

### Gemeinsames Muster

| Blind Spot | Betroffene reale Fehler |
|---|---|
| Keine Datenbank im Test → keine Constraints, keine RLS | (a), (b), (e) |
| Kein Layout im Test → keine Overflow-, Position- oder Sichtbarkeitsprüfung | (d), (f) |
| Keine Fehlerpfad-Tests → stille Ablehnungen unbemerkt | (b), (e) |
| Keine zeichenweise Eingabeprüfung → Formatter-Rundreise ungetestet | (c) |

## 8.7 Konkret fehlende Testpfade

### Priorität hoch (deckt die gemeldeten Fehler ab)

| Nr. | Fehlender Testpfad | Deckt ab |
|---|---|---|
| T1 | Integrationstest gegen eine echte Postgres-/Supabase-Instanz (lokal via `supabase start`), der `persistWizardSession` aufruft und die Fremdschlüsselbedingung prüft | (b) |
| T2 | Test, der einen abgelehnten Persistenzaufruf simuliert und prüft, dass eine sichtbare Fehlermeldung erscheint (`advice.error` gesetzt bzw. Toast) | (b), (e) |
| T3 | Eingabetest „12,50" zeichenweise in das Ist-Kostenfeld tippen und danach `session.manualInput.monthlyTotalCostsCents === 1250` prüfen | (c) |
| T4 | Supabase-Integrationstest: Lead mit `assigned_sales_user_id = User A` anlegen, als User B lesen, Sichtbarkeit in `/leads` **und** `/sales` vergleichen | (a) |
| T5 | Test, der prüft, dass ein neu angelegter Kunde ohne Aufgabe auf dem Startbildschirm auffindbar ist | (a) |
| T6 | Playwright-Test bei 360 px und 390 px auf `/admin/commission/standards` und `/admin/commission/cases` mit Assertion `document.scrollingElement.scrollWidth <= innerWidth` | (f) |
| T7 | Test, der nach Klick auf „Bearbeiten" prüft, dass das Formular im Viewport sichtbar ist (`toBeInViewport()` in Playwright) | (d) |
| T8 | Round-Trip-Test für jedes Provisionsformularfeld: Wert setzen → speichern → neu laden → identischer Wert | (e) |

### Priorität mittel

| Nr. | Fehlender Testpfad |
|---|---|
| T9 | Beratungswizard: jeder Button jedes Schritts mit Zustandsassertion nach dem Klick (Modusbuttons, „Weiter", „Zurück", „Empfehlung berechnen", „Angebot erzeugen") |
| T10 | Nebenläufigkeitstest: zwei schnelle Feldänderungen hintereinander, Prüfung, dass die letzte gewinnt |
| T11 | Angebotspfad im Supabase-Modus: Beratung → Empfehlung → Angebot → `offers` und `offer_versions` prüfen |
| T12 | Provisionsfall entstehen lassen (`freezeCalculation`) und in `/sales/commission` sichtbar machen |
| T13 | Vergleich der Computed-Höhe von v2-`Button` gegen rohe `<button>`-Elemente in den Provisionspanels |
| T14 | Verhalten bei leerem/mehrdeutigem Preisbuch: Prüfung, dass eine verständliche Meldung erscheint statt „Noch keine Empfehlung berechnet" |

### Priorität niedrig

| Nr. | Fehlender Testpfad |
|---|---|
| T15 | Token-Konsistenz `--control-height` gegen `--touch-target` in gemischten Formularen |
| T16 | `ConfirmDialog` gegen `Dialog`: gleiche Aktion, gleiche Buttongröße |
| T17 | Mobile-Zweige der Media-Queries mit realistischem `matchMedia`-Mock |
| T18 | OCR-Pfad mit echter Datei im Browser (Playwright), nicht mit Mock-Provider |

## 8.8 Bewertung des Qualitätsgates

| Gate | Aussagekraft für die gemeldeten Fehler |
|---|---|
| Vitest (1073 Tests) | **keine** für (a), (b), (d), (e), (f); begrenzt für (c) |
| Playwright (13 Tests) | **keine** – Demo-Modus, Desktop, teils gemockte API |
| Lint / Typecheck | keine – alle Fehler sind typkorrekt |
| Production-Build | keine |
| OCR-Verify | prüft nur, dass Assets im Build liegen; bestätigt korrekt (Dok. 04) |
| Secretscan | keine |
| RLS-/Repository-Tests | **irreführend** – prüfen SQL-Dateien als Text, nicht deren Wirkung |
| Responsive-Tests | **irreführend** – Assertion in jsdom strukturell immer erfüllt |
| PWA-Smoke / Android-Build / APK-Signatur | prüfen Verpackung, nicht Verhalten |

**Kernaussage:** Das Qualitätsgate war grün, weil es genau die drei Dimensionen nicht abdeckt, in denen die Anwendung versagt: Datenbankintegrität, echte Rollen-/Sichtbarkeitslogik und tatsächliches Layout. Es liegen keine falsch geschriebenen Tests vor, sondern eine systematische Lücke in der Teststrategie.

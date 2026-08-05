# AMRtech Payment – Tiefenanalyse, Abschlussbericht

Erhebung: 2026-08-04. Grundlage: Codeanalyse auf `HEAD 223b3f1466…`, Live-Prüfung von PWA, Worker und APK, direkte Leseabfragen gegen das Produktions-Supabase-Projekt `vohnqrftkuefkugabcob` inklusive Postgres-Logs.

**Keine Implementierung. Kein Commit. Keine Migration. Kein Deploy.** Alle Datenbankzugriffe waren lesend. Geändert wurden ausschließlich die elf Analysedokumente unter `docs/deep-analysis/`.

## Teildokumente

| Dokument | Inhalt |
|---|---|
| `01-git-release-inventory.md` | Git-Stand, Live-Deployment, APK-Version |
| `02-routes-and-ui-inventory.md` | 62 Routen, UI-System, Mobile/PWA/APK-Vergleich |
| `03-customer-data-flow.md` | Kunden-Datenfluss, Betreuerzuordnung, Team-Filter, Schema, Datenqualität |
| `04-advice-workflow.md` | Beratungsworkflow, Ausgangslage, Bedarf, OCR/Abrechnungsimport |
| `05-offer-flow.md` | Angebotserzeugung, Statusmodelle, Freigabe, PDF, Kundenlink |
| `06-commission-flow.md` | Provision: Außendienstsicht, Standardregeln, Vereinbarungen, Fälle |
| `07-database-inventory.md` | 58 Tabellen, Funktionen, Trigger, Policies, Migrationen, Advisor, Logs |
| `08-tests-versus-reality.md` | Klassifizierung der Tests, Ursachen der Testblindheit, fehlende Pfade |
| `09-core-dependency-map.md` | Abhängigkeitskarte des Kerns, kritische Pfadkette |
| `10-repair-options.md` | Befundliste F1–F26, Optionen A–D mit Aufwand und Risiko |

## 1. Tatsächliche Hauptursachen

### Hauptursache 1 – Ein Fremdschlüssel blockiert den gesamten Kern

`salesWizardService.persistWizardSession` schreibt in `user_active_sessions`, **bevor** die referenzierte Sitzung in `best_pay_comparison_sessions` existiert. Der Fremdschlüssel `user_active_sessions_comparison_session_id_fkey` ist nicht `DEFERRABLE`. Jeder erste Speicherversuch der Beratung scheitert in Postgres.

Drei unabhängige Belege:

1. `best_pay_comparison_sessions` = **0 Zeilen**, `user_active_sessions` = **0 Zeilen** – obwohl Angebote, Empfehlungsdatensätze und Abrechnungssitzungen existieren.
2. Der Produktions-Postgres-Log enthält als **einzige** wiederkehrende Fehlerklasse genau diese FK-Verletzung: 6 Einträge am 2026-08-03 gegen 16:06 CEST, über 60 Einträge am 2026-08-04 zwischen 12:44 und 12:48 CEST während der Live-Nutzung.
3. `sales_activities` (10 Zeilen) enthält **keinen einzigen** `advice_started`-Eintrag. Die Methode ist nie bis dahin gelaufen.

Dasselbe Vorgehen ist an anderer Stelle korrekt geordnet (`bestPayComparisonService.ts:184-186`: erst speichern, dann Zeiger setzen). Die UI ruft aber den falsch geordneten Pfad.

### Hauptursache 2 – Der Fehler ist für den Nutzer unsichtbar

`ensurePersisted` und `withPersist` in `useAdviceSession.ts` haben **kein `.catch`**. Alle sechs Aufrufstellen in `AdviceWizardPage.tsx` sind `void`-Aufrufe. Ergebnis: `busy` wird korrekt zurückgesetzt, der Zustand ändert sich nicht, `advice.error` bleibt `null`, kein Toast erscheint. Der Klick hat sichtbar keine Wirkung.

**Diese zwei Ursachen erklären fünf der acht gemeldeten Beratungsprobleme** (hängender Schritt Ausgangslage, funktionslose Modusbuttons, unzuverlässige Kosteneingabe, 0 € ohne Wirkung, Abrechnung einlesen ohne Wirkung).

### Hauptursache 3 – Dezimaleingabe ist konstruktiv unmöglich

`centsToInput` und `parseEuroToCents` bilden ein kontrolliertes Paar. Bei der Eingabe „12,50" entfernt `centsToInput` das Komma sofort nach dem Tastendruck; das Feld erfasst am Ende **1.250,00 €**. Zusätzlich löst jeder Tastendruck einen vollständigen Serverumlauf ohne Entprellung und ohne Merge-Schutz aus, und `disabled={busy}` deaktiviert das Feld währenddessen. Das erzeugt den Eindruck „Werte werden gelöscht" – unabhängig von Ursache 1.

### Hauptursache 4 – Keine Betreuerzuweisung in der Oberfläche

`leads.assigned_sales_user_id` existiert und wird von RLS und Clientfiltern ausgewertet, aber **weder `NewLeadPage` noch `EditLeadPage` enthalten ein Betreuerfeld**. Alle 3 Produktionskunden gehören dem Admin (`ef9cba97-…`); der Außendienst-Account (`35b167e8-…`) hat null zugeordnete Kunden. „Meine Kunden" ist für ihn korrekt leer, und die App bietet keinen Weg, das zu ändern.

### Hauptursache 5 – Drei unterschiedliche Sichtbarkeitsfilter

| Ort | Filter |
|---|---|
| `leadService.ts:218-224` | nur `assignedSalesUserId` |
| `salesWorkspaceService.ts:182-187` | `assignedSalesUserId` **oder** `createdByUserId` |
| RLS-Policy auf `leads` | `assignedSalesUserId` **oder** `createdByUserId` |

Drei Wahrheiten für eine Frage. Verstärkend: `/sales` rendert ausschließlich aufgabengetriebene `dayWork`-Abschnitte, und `sales_tasks` hat **0 Zeilen** – der Startbildschirm ist strukturell leer. Das Suchfeld berechnet `searchHits`, rendert sie aber nicht. Der „Team"-Filter ist ein Admin-Alles-Schalter; ein Teammodell existiert nicht, `profiles.sales_team_id` ist bei beiden Profilen NULL.

### Hauptursache 6 – Zwei parallele UI-Systeme

Der „Rebuild" hat Layouts ersetzt, nicht die Interaktionslogik. **13 von 62 Routen sind v2-Shells um unveränderte Legacy-Inhalte**, der komplette Provisionsbereich gehört dazu.

| Doppelung | Umfang |
|---|---|
| Buttons | `v2/ui/Button` (21 Consumer, 2,75rem) gegen rohe `<button>` in 25 Dateien / ~98 Vorkommen, teils völlig ungestylt |
| Tabellen | `components/common/ResponsiveTable` und `v2/ui/ResponsiveTable`, beide gleichzeitig im Einsatz |
| Dialoge | Legacy `ConfirmDialog` und `v2/ui/Dialog`, beide gleichzeitig im Einsatz |
| Formulare | `FormControl`, Legacy-`FormField`, v2-`FormField`; `v2/crm/LeadForm.tsx` importiert **zwei** davon gleichzeitig |

Konkrete Folgen: Bearbeitungsformulare der drei Provisionspanels liegen im DOM **nach** der Tabelle ohne Scroll- oder Fokusführung; `min-width: 36rem` (576px) in drei CSS-Dateien erzwingt bei 360px Viewport horizontales Scrollen, und `orientation: portrait` im Manifest nimmt dem Nutzer den Ausweg über Drehen.

### Hauptursache 7 – Die Tests konnten diese Fehler nicht finden

Alle 1073 Vitest-Tests und alle 13 Playwright-Tests laufen im Local-/Demo-Modus gegen `localStorage`. Dort gibt es keine Fremdschlüssel, keine RLS und – in jsdom – kein CSS-Layout. Die einzige Overflow-Assertion vergleicht `scrollWidth` mit `clientWidth` in jsdom und ist damit strukturell immer erfüllt. `matchMedia` ist im Setup hartkodiert auf „Desktop trifft immer zu". Die Testsuite deckt genau die drei Dimensionen nicht ab, in denen die Anwendung versagt.

## 2. Zustand der Datenbank

**Gesund.** Es existiert kein Befund, der eine Schemaneuentwicklung technisch erforderlich macht.

| Aspekt | Befund |
|---|---|
| Tabellen | 58, **alle** mit aktivem RLS |
| Views / Storage Buckets / Edge Functions / Realtime | 0 / 0 / 0 / 0 |
| Funktionen | 13, alle RLS-Helper bzw. Keepalive |
| Trigger | 1 (`profiles_privilege_guard`) |
| Migrationen | 25, sämtlich am 01.–02.08.2026 angelegt; **neun** tragen Varianten von `production_baseline_catalog` |
| Fremdschlüssel | 49 |
| Advisor | 0 ERROR, 4 WARN (`touch_system_keepalive` für `anon` ausführbar, Leaked-Password-Protection deaktiviert, `system_keepalive` mit RLS ohne Policy, 12 `SECURITY DEFINER`-Helper) |
| Postgres-Log | **eine einzige** Fehlerklasse: die FK-Verletzung aus Hauptursache 1. Keine RLS-Verweigerungen, keine anderen Constraint-Verletzungen, keine Timeouts |
| Strukturelles Muster | fast jede Tabelle: `id text PK`, gespiegelte Filterspalten, `data jsonb`. Synchron gehalten ausschließlich vom Anwendungscode, ohne Trigger oder Check |
| Typinkonsistenz | `profiles.user_id` ist `uuid`, alle referenzierenden Felder sind `text`; **kein einziger FK auf `profiles`** |
| Fehlende Indizes | u. a. `leads.assigned_sales_user_id`, obwohl RLS und Clientfilter darauf filtern |

## 3. Zustand der Kern-Daten

**Korrekt, aber minimal – und in einem Punkt fachlich blockierend.**

| Bereich | Bestand | Bewertung |
|---|---|---|
| Profile | 2 (1 admin, 1 field_service, beide active) | in Ordnung, `sales_team_id` bei beiden NULL |
| Kunden | 3, alle dem Admin zugeordnet | **fachlich blockierend** – Außendienst hat 0 Kunden. 1 Lead heißt „2", 1 ist explizit Testdatensatz |
| Katalog | 2 Tarife, 19 Produkte, 2 Laufzeiten, 1 Preisbuch, 1 Version `published` ab 2026-01-01, 3 aktive Preisregeln | **vollständig und korrekt.** Kein Reparaturbedarf |
| Provisionsstammdaten | 2 Pläne, 15 Regeln, 3 Assignments, 3 Assignment-Versionen | vorhanden; individuelle Overrides funktionieren nachweislich |
| Beratungssitzungen | **0** | Folge von Hauptursache 1 |
| Provisionsfälle / Berechnungen | **0 / 0** | Folge von Hauptursache 1 |
| Angebote | 1 (Testdatensatz) | kein produktives Angebot |
| Aufgaben (`sales_tasks`) | **0** | Startbildschirm strukturell leer |
| Verträge, Aktivierung, OCR-Daten, Export/Backup | **0** in 20 Tabellen | Altlast bzw. nie genutzt |
| Datenqualität | keine verwaisten Betreuer, keine Nullwerte in Pflichtspalten, keine doppelten Zuordnungen, JSONB stimmt mit Spalten überein | positiv |

28 von 58 Tabellen sind vollständig leer. Fachlich relevant sind insgesamt ~73 Zeilen.

## 4. Zustand der UI

| Aspekt | Bewertung |
|---|---|
| Routen | 62 Einträge, davon 13 reine Altpfad-Redirects und 11 auf vollständig leere Tabellen. **21 sind für den Kern nötig** |
| v2-Anteil | 13 Seiten sind Shells um unveränderte Legacy-Inhalte; der Provisionsbereich ist innen komplett Legacy |
| Doppelsysteme | 2 Buttonsysteme, 2 Tabellensysteme, 2 Dialogsysteme, 3 Formularlayouts – gleichzeitig aktiv |
| Startbildschirm | `/sales` enthält keine Kundenliste; Suche berechnet, aber rendert nicht |
| Kundenbearbeitung | funktioniert, **ohne Betreuerfeld** |
| Beratung | vollständig blockiert |
| Angebot | Liste und Statuspflege funktionsfähig, aber ohne Angebote wirkungslos; Detailseite enthält 8 Legacy-Sections |
| Provision | Außendienstsicht korrekt, strukturell leer; Adminformulare unter der Tabelle, `displaySharePercent` wird nicht gespeichert |
| Mobil | `min-width: 36rem` in drei CSS-Dateien; `orientation: portrait` verhindert Drehen; `viewport-fit=cover` fehlt in `index.html`, dadurch sind alle Safe-Area-Tokens wirkungslos, obwohl `AppShell` und `Dialog` sie auswerten |
| Tokens | `src/v2/styles/tokens.css` wird in `features/` nur teilweise genutzt; `--control-height` dort gar nicht; Breakpoints als Literale statt Tokens |

### Desktop, PWA und APK sind bit-identisch

| Prüfung | Ergebnis |
|---|---|
| `diff -rq dist android/.../public` | identisch außer `cordova.js`, `cordova_plugins.js` |
| Einstiegsbundle lokal / APK / live | jeweils `assets/index-BC-8sjn5.js` |
| SHA-256 der lokalen `app-release.apk` | `d8cee4a7d5c5…68c53` – **identisch** mit `sha256` in der veröffentlichten `android/latest.json` |
| `sourceCommit` im Manifest | `223b3f1466…` = `HEAD` = `main` = Tag `v1.0.2` |

Die APK enthält damit nachweislich denselben fehlerhaften Frontendstand. Es gibt keinen plattformspezifischen Fehler außer dem fehlenden `viewport-fit=cover`. Verpackung, Auslieferung und Update-Mechanik sind korrekt.

## 5. Zustand der Services

| Bereich | Bewertung |
|---|---|
| Umfang | 84 Services (23.948 Zeilen), 39 Supabase- und 37 Local-Repositories (5.937 Zeilen), 223 Domänenmodule (22.959 Zeilen) |
| Rechenkerne | **funktionsfähig und gut abgedeckt.** `domain/pricingEngine`, `domain/recommendationEngine`, `domain/commissionEngine` sind reine Funktionen mit ~104 Domänentests |
| Katalogzugriff | funktionsfähig, Produktionsdaten korrekt gelesen |
| Kostenmodus und 0-€-Validierung | **nachweislich korrekt** (`=== null` und `=== 0`, keine Truthiness-Falle), durch Unit-Test bestätigt |
| Beratung | `salesWizardService` (962 Zeilen) enthält den blockierenden Reihenfolgefehler; `bestPayComparisonService` (828 Zeilen) lädt bei jedem Zugriff alle Sitzungen und filtert im Speicher; `SupabaseBestPayComparisonRepository.save` liest vor jedem Schreiben |
| Angebot | funktionsfähig; `createOffer` erzwingt `leadId`, obwohl anonym gerechnet werden darf; blockierende Pricing-Findings werden als `ok: true` zurückgegeben; drei persistierte Statusmodelle, `Offer.status` fachlich informationslos |
| Provision | Schreibpfad für individuelle Vereinbarungen **funktioniert nachweislich** (Datensatz vom 04.08. mit 4 Overrides), Admin-RLS erlaubt Schreiben, keine Tabellenverwechslung. `displaySharePercent` bei Standardregeln hat in `commission_rules` **kein Zielfeld** |
| Fehlerbehandlung | durchgängige Schwachstelle: sieben Ladepfade in der Provision ohne Fehleranzeige, `void`-Aufrufe in der Beratung, stille Abbrüche im Importpfad |
| OCR | vollständig clientseitig über Tesseract, kein Server-OCR, Assets live (HTTP 200) und in der APK vorhanden. Als optionaler Helfer isolierbar – einzige Kopplung ist `session.costBaselineId`, bereits per Lazy-Import getrennt |
| Altlast | `paymentComparisonService` + `domain/calculator` (Vorgänger des Wizards), Vertrags- und Aktivierungsservices, Export/Backup/Migration – alle ohne Kernbezug |

## 6. Zustand der Tests

| Ebene | Umfang | Aussagekraft für die gemeldeten Fehler |
|---|---|---|
| Vitest | 154 Dateien, ca. 1073 Fälle, 24.264 Zeilen | keine für 5 von 6 Fehlern |
| davon Domänen-/Pure-Function-Tests | ~104 Dateien (68 %) | hoch für Berechnungen, null für Infrastruktur |
| davon echte Interaktionstests | 29 Dateien (19 %) | nur in jsdom, nur `localStorage` |
| davon Persistenztests | 18 Dateien (12 %) | ausschließlich `localStorage` |
| davon „RLS-Tests" | 14 Dateien | prüfen **Migrationsdateien als Text**, nicht deren Wirkung |
| davon Responsive-Tests | 1 Datei | Assertion in jsdom strukturell immer erfüllt |
| Playwright | 4 Specs, 13 Fälle, 655 Zeilen | Demo-Modus, Desktop-Chrome, öffentliche API teils gemockt |
| Tests gegen echte Datenbank | **0** | – |
| Snapshot-Tests | 0 | – |

Die Qualitätsgates (Lint, Typecheck, Build, Secretscan, PWA-Smoke, APK-Signatur) prüfen Verpackung und Typkorrektheit. Alle gefundenen Fehler sind typkorrekt. Zwei Gates sind aktiv irreführend: die RLS-Textanalyse und der Responsive-Test.

Dokument 08 listet 18 konkret fehlende Testpfade (T1–T18), davon 8 mit direkter Zuordnung zu den gemeldeten Fehlern.

## 7. Sicher weiterverwendbare Teile

| Baustein | Belegter Zustand |
|---|---|
| Supabase-Schema der 17 Kerntabellen | strukturell tragfähig, RLS überall aktiv, keine korrupten Daten |
| Alle RLS-Policies und 13 Helper-Funktionen | keine einzige Verweigerung im Produktionslog |
| Produktionskatalog (2 Tarife, 19 Produkte, 2 Laufzeiten, Preisbuch `published`, 3 Preisregeln) | vollständig und korrekt |
| `domain/pricingEngine`, `domain/recommendationEngine`, `domain/commissionEngine`, `domain/shared` | reine Funktionen, ~104 Domänentests |
| `domain/bestPayComparison/costCaptureMode.ts`, `comparisonSummary.ts` | Validierungslogik nachweislich korrekt, inkl. 0 € |
| Provisionsstammdaten und Override-Schreibpfad | funktioniert nachweislich in Produktion |
| Auth (`supabaseAuthService`), Worker `amrtech-payment`, Worker `amrtech-payment-downloads` | funktionsfähig, Live geprüft |
| Update-Mechanik (`domain/appUpdate`, strenge Manifestvalidierung) | valides Live-Manifest, korrekte Statuslogik |
| OCR-Assets und Tesseract-Pipeline | live HTTP 200, in APK enthalten |
| `v2/ui`-Basiskomponenten, `AppShell`, Tokens | Basis nutzbar, Tokens nur teilweise durchgesetzt |
| Build- und Releasekette | dist = APK = Live, SHA-256-Kette geschlossen |

## 8. Teile, die den Kern blockieren

| Rang | Blocker | Wirkung |
|---|---|---|
| 1 | Schreibreihenfolge in `salesWizardService.persistWizardSession` gegen `user_active_sessions_comparison_session_id_fkey` | **Beratung, Angebot, Provisionsfall, Außendienstprovision – 7 von 10 Kernfunktionen** |
| 2 | Fehlende Fehlerbehandlung in `useAdviceSession` und allen sechs UI-Aufrufstellen | macht Blocker 1 unsichtbar und unauffindbar |
| 3 | `centsToInput`/`parseEuroToCents` als kontrolliertes Paar, ohne Entprellung, mit `disabled={busy}` | manuelle Kostenerfassung unbrauchbar, auch nach Behebung von Blocker 1 |
| 4 | Fehlendes Betreuerfeld in `NewLeadPage`/`EditLeadPage` | Kernfunktion 2 (Zuweisung) und damit Kernfunktion 3 (Außendienstsicht) unmöglich |
| 5 | Drei divergierende Sichtbarkeitsfilter plus leerer `/sales`-Startbildschirm | widersprüchliche Kundenansichten |
| 6 | `displaySharePercent` ohne Zielfeld in `commission_rules` | Standardprovision nicht editierbar |
| 7 | Provisionsformulare unter der Tabelle ohne Scroll/Fokus; `min-width: 36rem`; `orientation: portrait`; fehlendes `viewport-fit=cover` | Provision und Tabellen mobil nicht bedienbar |
| 8 | Fehlendes Testfundament (keine DB-Tests, wirkungslose Overflow-Assertion, Desktop-`matchMedia`) | jede Reparatur bleibt unbelegt und kann erneut unbemerkt brechen |

### Kritische Pfadkette

Die zehn Kernfunktionen hängen in einer Reihe. Stufe 2 – „Beratung persistiert die Sitzung" – ist der Engpass. Die Stufen 3 bis 9 sind **Folgefehler**, nicht eigenständige Defekte. Die Stufen 1, 6, 9 und 10 sind unabhängig reparaturbedürftig, aber nicht blockiert.

## 9. Vergleich der Optionen A–D

| Kriterium | A: bestehenden Stand reparieren | B: neue Oberflächen auf bestehenden Services | C: neue Oberflächen und Services auf bestehender DB | D: neues minimales Schema mit Datenübernahme |
|---|---|---|---|---|
| **Aufwand gesamt** | **26–43 PT** | 35–53 PT | 52–78 PT | 57–88 PT |
| Aufwand bis Beratung nutzbar | **1–2 PT** | 3–5 PT | 8–12 PT | 18–25 PT |
| Schemaänderung | optional | keine | keine | vollständig |
| Datenmigration | keine | keine | keine | ~73 Zeilen |
| Wiederverwendung Services | vollständig | vollständig | nur Engines | nur Engines |
| Wiederverwendung Tests | vollständig + Ausbau | teilweise | gering | gering |
| Beseitigt UI-Doppelsysteme strukturell | nein (nur durch Sanierung) | ja | ja | ja |
| Beseitigt JSONB-Doppelwahrheit strukturell | nein | nein | nein | ja |
| Behält bewährte RLS | ja | ja | nachgebildet | nein |
| Behält PDF, Kundenlink, OCR | ja | ja (nur umgeroutet) | teilweise | gefährdet |
| Toter Code danach | ~0 | ~12.500 Zeilen | ~66.000 Zeilen | ~66.000 Zeilen + Altschema |
| Höchstes Einzelrisiko | flächige CSS-/Komponentensanierung über 33 Feature-CSS-Module | Servicemodell ist auf den alten Wizard zugeschnitten | JSONB- und RLS-Semantik erneut korrekt nachbilden | neues Schema und neue RLS ohne Bewährung |

Vollständige Aufschlüsselung mit 22 Einzelmaßnahmen für Option A und je 10–11 für B, C, D in `10-repair-options.md`.

## 10. Risiken

| Risiko | Betrifft | Bewertung |
|---|---|---|
| Vereinheitlichung der Sichtbarkeitsfilter kann Kunden ausblenden oder fremde Kunden zeigen | A, B, C, D | mittel–hoch |
| Umstellung des Eingabemusters betrifft alle Eurofelder in Beratung und Bedarf | A | mittel |
| Konsolidierung der drei Statusmodelle berührt bestehende Angebotsdaten | A | mittel |
| Flächige CSS-/Komponentensanierung über 33 Feature-CSS-Module und ~98 rohe Buttons | A | mittel–hoch |
| Servicesignaturen sind auf den alten Wizard zugeschnitten; neue UI muss dem Modell folgen oder es anpassen | B | mittel |
| Toter Code in `src/features` bleibt liegen, zugehörige Tests laufen weiter grün und täuschen Abdeckung vor | B, C, D | mittel |
| Doppelung Spalte ↔ `data jsonb` muss in einer neuen Zugriffsschicht erneut korrekt bedient werden – dasselbe Muster, das heute den Demo-Fallback `user_001` greifen lässt | C | hoch |
| RLS-Semantik muss exakt nachgebildet werden; Abweichung erzeugt genau die heutigen Filterwidersprüche | C | hoch |
| Bestehender Testkorpus (24.264 Zeilen) wird für den Kern wertlos | C, D | hoch |
| Neues Schema und neue RLS ohne Bewährung; die aktuelle RLS ist nachweislich fehlerfrei | D | hoch |
| PDF, Kundenlink (3 aktive Sharelinks), öffentliche Angebotsansicht und OCR-Pipeline hängen am Altschema | D | hoch |
| Zwei Schemata bzw. zwei Servicewelten während der Umstellung | C, D | mittel–hoch |
| Ohne neues Testfundament bleibt bei **jeder** Option unbelegbar, ob der Kern funktioniert | A, B, C, D | **hoch** |
| Testmüll in Produktion (Lead „2", `lead_test_p1b_smoke_20260802`, Testangebot, Testimportsitzung) verfälscht jede Abnahme | A, B, C, D | niedrig |
| Das Schema wurde in zwei Tagen mit neun Nacharbeitsmigrationen aufgebaut; eine erneute schnelle Modellierung birgt dasselbe Risiko | D | mittel |

## 11. Belastbare Feststellungen ohne Wertung

1. Ein einziger Reihenfolgefehler in zwei Codezeilen blockiert 7 von 10 Kernfunktionen.
2. Die Datenbank ist gesund. Kein Befund macht eine Schemaneuentwicklung technisch erforderlich.
3. Der Produktionskatalog ist vollständig und veröffentlicht. Keine Option muss Stammdaten neu aufbauen.
4. Es existiert keine produktive Beratungshistorie (0 Sitzungen) und kein Provisionsfall (0 Fälle). Die Datenlage spricht gegen kein Vorgehen.
5. Die Rechenkerne für Preis, Empfehlung und Provision sind in allen vier Optionen wiederverwendbar.
6. Etwa 70 % des Produktivcodes (79.856 Zeilen) und des Schemas (58 Tabellen) sind für den gewünschten Kern nicht erforderlich. Nur Option A behält alles davon in Betrieb.
7. Die UI-Doppelsysteme sind der Umfangstreiber in Option A und entfallen in B, C und D.
8. APK, PWA und lokaler Build sind bit-identisch. Der einzige plattformspezifische Befund ist ein fehlendes Attribut im Viewport-Meta.
9. Die grüne Testsuite ist kein Widerspruch zum defekten Produkt, sondern die Folge des Testaufbaus: kein Test berührt eine Datenbank, keiner berechnet Layout.
10. Es wurde kein einziger Fehler gefunden, der auf fehlerhafte Berechnungslogik zurückgeht. Alle Befunde liegen in Schreibreihenfolge, Fehlerbehandlung, Eingabebehandlung, Sichtbarkeitsfiltern, fehlenden Formularfeldern und CSS.

## Abgrenzung

Diese Analyse enthält keine Empfehlung für eine der vier Optionen. Es wurden keine Codeänderungen, keine Migrationen, keine Commits, keine Pushes und keine Deployments durchgeführt. Sämtliche Datenbankzugriffe waren lesend. Geändert wurden ausschließlich die elf Dokumente unter `docs/deep-analysis/`.

# 04 – Beratungsworkflow und Abrechnungseinlesen (OCR)

Nur Ist-Zustand. Keine Änderungen.

## 4.0 Hauptbefund vorweg

**Die Beratung kann im Produktionsmodus keine Sitzung speichern. Jeder erste Speicherversuch bricht mit einem Fremdschlüsselfehler in der Datenbank ab. Der Fehler wird im Frontend nirgends aufgefangen oder angezeigt.**

Drei voneinander unabhängige Belege:

1. **Datenbank leer:** `best_pay_comparison_sessions` = **0 Zeilen**, `user_active_sessions` = **0 Zeilen** – obwohl Angebote, Empfehlungsdatensätze und Abrechnungssitzungen existieren.
2. **Produktionslogs:** Der Postgres-Log des Projekts `vohnqrftkuefkugabcob` enthält dutzende Einträge
   `ERROR: insert or update on table "user_active_sessions" violates foreign key constraint "user_active_sessions_comparison_session_id_fkey"`
   – Cluster am **2026-08-03 16:06 CEST** (6 Einträge) und **2026-08-04 12:45–12:48 CEST** (über 60 Einträge, fortlaufend während der Live-Nutzung).
3. **Kein Audit-Trail:** `persistWizardSession` ruft `recordAdviceStarted` mit `sourceKey = advice_started:<sessionId>`. In `sales_activities` (10 Zeilen) existiert **kein einziger** `advice_started`-Eintrag. Die Methode ist also nie bis zu diesem Punkt gelaufen.

### Ursache im Code

```152:162:src/services/salesWizardService.ts
  async persistWizardSession(
    session: BestPayComparisonSession,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession> {
    session.entryMode = 'wizard';
    session.wizard.enabled = true;
    await this.bestPayComparisonRepository.setActiveSessionId(context.userId, session.id);
    const saved = await this.persist(session);
    await this.recordAdviceStarted(saved, context);
    return saved;
  }
```

`setActiveSessionId` schreibt **zuerst** in `user_active_sessions`:

```88:101:src/repositories/supabase/SupabaseBestPayComparisonRepository.ts
  async setActiveSessionId(userId: string, sessionId: string | null): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from(ACTIVE_SESSIONS_TABLE).upsert(
      {
        user_id: userId,
        comparison_session_id: sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`Aktive Vergleichssitzung speichern fehlgeschlagen: ${error.message}`);
    }
  }
```

Die Zieltabelle hat aber einen Fremdschlüssel auf die noch nicht existierende Sitzung:

```
user_active_sessions_comparison_session_id_fkey:
  FOREIGN KEY (comparison_session_id) REFERENCES best_pay_comparison_sessions(id) ON DELETE SET NULL
```

Der Fremdschlüssel ist nicht `DEFERRABLE`. Die Reihenfolge ist damit zwingend falsch: **Kind vor Eltern.** `persist(session)` in Zeile 159 wird nie erreicht.

Zum Vergleich – derselbe Vorgang in einem anderen Service ist korrekt geordnet:

```184:186:src/services/bestPayComparisonService.ts
    await this.saveSession(session);
    await this.setActiveSessionId(context, session.id);
```

`bestPayComparisonService.createSession` speichert erst die Sitzung, dann den Aktivzeiger. Die UI nutzt aber `persistWizardSession`, nicht `createSession`.

### Warum der Nutzer keine Fehlermeldung sieht

```54:93:src/v2/advice/useAdviceSession.ts
      persistPromiseRef.current = salesWizardService
        .persistWizardSession(current, userContext)
        .then((saved) => { … })
        .finally(() => {
          persistPromiseRef.current = null;
          setBusy(false);
        });
      const saved = await persistPromiseRef.current;
```

Es gibt **kein `.catch`**. Der Fehler wird zu einer abgelehnten Promise, die durch `withPersist` (Zeilen 95-117, nur `try/finally`) hindurchpropagiert. Alle Aufrufer im Wizard sind `void`-Aufrufe ohne Fehlerbehandlung:

| Aufrufer | Zeile |
|---|---|
| `onSelectMode={(mode) => void advice.setCostCaptureMode(mode)}` | `AdviceWizardPage.tsx:346` |
| `onPatchCosts={(cents) => void advice.patchManualInput({…})}` | `AdviceWizardPage.tsx:347` |
| `onPatchCurrentProvider={… void advice.patchProspect({…})}` | `AdviceWizardPage.tsx:348` |
| `onCalculate={() => void advice.calculateRecommendation()}` | `AdviceWizardPage.tsx:367` |
| `onClick={() => void handleNext()}` (Weiter) | `AdviceWizardPage.tsx:444` |
| `onClick={() => void advice.goBack()}` (Zurück) | `AdviceWizardPage.tsx:440` |

Ergebnis: `busy` wird korrekt auf `false` zurückgesetzt, der Zustand ändert sich nicht, `advice.error` bleibt `null`, es erscheint kein Toast. **Der Klick hat sichtbar keine Wirkung.** Genau das beschreibt der Nutzer.

### Symptom-Zuordnung

| Symptom | Erklärung durch 4.0 |
|---|---|
| „Beratung bleibt im Schritt Ausgangslage hängen" | `handleNext` → `goNext` → `ensurePersisted` schlägt fehl; kein Schrittwechsel, keine Meldung |
| „Modusbuttons reagieren nicht" | `setCostCaptureMode` → `withPersist` → `ensurePersisted` schlägt fehl |
| „Manuelle Kosteneingabe funktioniert nicht zuverlässig" | jeder Tastendruck ruft `patchManualInput` → schlägt fehl; zusätzlich Dezimalfehler (4.3) |
| „0 € Ist-Kosten funktionieren nicht" | Modusauswahl `no_current_costs` schlägt fehl, bevor `monthlyTotalCostsCents = 0` gesetzt wird |
| „Abrechnung einlesen funktioniert nicht" | `setCostCaptureMode('billing_import')` schlägt fehl, `startBillingImport` wird nie erreicht (4.4) |

**Ein einziger Reihenfolgefehler erklärt fünf der acht gemeldeten Beratungsprobleme.**

### Warum kein Test das gefunden hat

Im Local-/Demo-Modus schreibt `LocalBestPayComparisonRepository` in `localStorage`. Dort existiert **keine referentielle Integrität**. Dieselbe Codereihenfolge ist im Demo-Modus vollkommen unauffällig. Alle 1073 Vitest-Tests und alle Playwright-Tests laufen im Demo-Modus (siehe Dokument 08).

## 4.1 Schrittübersicht

| Sichtbarer Schritt | Step-ID | Komponente |
|---|---|---|
| Kunde | `prospect` | `src/v2/advice/steps/ProspectStep.tsx` |
| Ausgangslage | `costs` | `src/v2/advice/steps/CostsStep.tsx` |
| Bedarf | `need` | `src/v2/advice/steps/NeedStep.tsx` |
| Empfehlung | `variants` | `src/v2/advice/steps/RecommendationStep.tsx` |
| Angebot / Freigabe | `offer` / `approval` | `src/v2/advice/steps/OfferStep.tsx` |
| Prüfung & Nachfassen | `closing` | `src/v2/advice/steps/ClosingStep.tsx` |

Einstieg: `AdviceEntry.tsx:7-16` entscheidet nach URL-Parametern (`session`, `new=1`, `leadId`) zwischen Hub und Wizard.

## 4.2 Schritt „Ausgangslage" im Detail

### Buttons und Handler

```56:61:src/v2/advice/steps/CostsStep.tsx
            <button
              key={mode}
              type="button"
              className={costCaptureMode === mode ? styles.choiceActive : styles.choiceButton}
              disabled={busy}
              onClick={() => onSelectMode(mode)}
```

| Modus | Label | Quelle Label |
|---|---|---|
| `manual` | „Kosten manuell eingeben" | `domain/bestPayComparison/costCaptureMode.ts:7-8` |
| `billing_import` | „Abrechnung einlesen" | `costCaptureMode.ts:8-9` |
| `no_current_costs` | „Noch keine Payment-Lösung / aktuelle Kosten 0 €" | `costCaptureMode.ts:9-10` |

| Prüfpunkt | Befund |
|---|---|
| Buttontyp | `type="button"` – korrekt, kein Submit |
| disabled | `disabled={busy}` – während jedes laufenden Persistenzvorgangs nicht klickbar |
| Handler-Kette | `onSelectMode` → `AdviceWizardPage.tsx:346` → `useAdviceSession.ts:211-224` → `withPersist` → `salesWizardService.updateCostCaptureMode` |
| Lokaler Modus-State | **existiert nicht.** Der Modus wird abgeleitet: `useMemo(() => resolveCostCaptureMode(session), [session])` (`useAdviceSession.ts:381-384`) |
| Führende Wahrheit | `session.wizard.costCaptureMode`, gesetzt in `salesWizardService.ts:516-539` |
| Normalisierung | `costCaptureMode` wird beim Lesen erhalten (`bestPayComparisonStorageMigration.ts:91`) – kein Feldverlust |

**Bewertung:** Die Buttons sind technisch korrekt implementiert (richtiger Typ, korrekte Handlerkette, kein doppelter State). Sie wirken nur deshalb nicht, weil der dahinterliegende Persistenzaufruf abbricht (4.0). Es gibt **keinen** zweiten, konkurrierenden Modus-State.

### State-Initialisierung und useEffect-Abhängigkeiten

`useAdviceSession` enthält **keine** `useEffect`-Hooks. Die drei Effekte liegen in `AdviceWizardPage.tsx`:

| Effekt | Zeilen | Abhängigkeiten | Risiko für Werteverlust |
|---|---|---|---|
| Bootstrap | 97-172 | `bindSessionToUrl, navigate, searchParams, services.offerWorkflowService, services.salesWizardService, showToast, userContext` | setzt `setSessionRef.current(active)` (Zeile 154) und **überschreibt** den lokalen Zustand. Schutz: `bootstrappedRef.current === bootKey` (Zeile 102) |
| Leads laden | 174-176 | `services.leadService, userContext` | keins |
| URL-Sync | 180-190 | `advice.persisted, advice.session, bindSessionToUrl, searchParams` | setzt `bootstrappedRef` **vor** dem URL-Wechsel (Zeile 188), damit der Bootstrap nicht erneut feuert |

`searchParams` ist eine Objektreferenz; ändert sie sich ohne Änderung von `bootKey`, greift der Guard und der Effekt bricht sofort ab. Das Bootstrapping ist damit nicht die Quelle des Datenverlusts.

### persistNeed / persistSession

| Aktion | Servicemethode | geschriebene Session-Felder |
|---|---|---|
| Modus wählen | `updateCostCaptureMode` (`salesWizardService.ts:516-539`) | `wizard.costCaptureMode`; bei `no_current_costs` zusätzlich `manualInput.monthlyTotalCostsCents = 0` (Zeilen 526-530) |
| Abrechnung starten | `startBillingImport` (`498-513`) | `billingImportSessionId`, `wizard.costCaptureMode = 'billing_import'` |
| Manuelle Kosten | `updateNeed` (`541-554`) → `bestPayComparisonService.updateManualInput` | `manualInput.*` |
| Anbieter | `updateProspectDraft` (`393-420`) | `wizard.prospectDraft.notes` |
| Zentrale Persistenz | `persist` (`103-116`) → `bestPayComparisonRepository.save` | gesamte Sitzung als JSONB |

Es gibt **kein Autosave-Timer und keine Entprellung.** Jeder einzelne Tastendruck im Kostenfeld löst einen vollständigen Serverumlauf aus.

### Validierungsfunktion und Weiter-Handler

Kette: `handleNext` (`AdviceWizardPage.tsx:241-263`) → `advice.goNext()` (`useAdviceSession.ts:291-309`) → `salesWizardService.goNext` (`234-289`) → `validateStep` (`307-391`) → für `costs`: `validateCostCaptureStep` (`costCaptureMode.ts:27-64`).

| Modus | Blockiert wenn | 0-€-Behandlung |
|---|---|---|
| keiner gewählt | `!mode` | Meldung „Bitte wählen Sie…" (`costCaptureMode.ts:31-35`) |
| `manual` | `monthlyTotalCostsCents === null` | **0 € ausdrücklich erlaubt** (`costCaptureMode.ts:40-45`) |
| `billing_import` | `!session.costBaselineId` | irrelevant, Baseline muss bestätigt sein (`47-53`) |
| `no_current_costs` | `monthlyTotalCostsCents !== 0` | strikte Gleichheit `=== 0` (`55-61`) |

**Wichtiger Negativbefund:** Die Validierung verwendet durchgängig `=== null` und `=== 0`, **nicht** `!value` oder Truthiness. Es gibt in der Validierung **keine** 0-€-Falle. Der Unit-Test `src/test/costCaptureMode.test.ts:35-47` bestätigt das. Dass 0 € live nicht funktioniert, liegt ausschließlich daran, dass der Modus nie gespeichert wird (4.0).

Schritt `need` blockiert, wenn **weder** `monthlyCardVolumeCents` **noch** `annualCardVolumeCents` **noch** `costBaselineId` vorliegt (`salesWizardService.ts:325-337`).

### Alte und neue State-Wahrheiten

| Wahrheit | Ort | Status |
|---|---|---|
| `session.wizard.costCaptureMode` | Session-JSONB | **führend** |
| Ableitung aus `costBaselineId`/`billingImportSessionId`/`monthlyTotalCostsCents` | `resolveCostCaptureMode` (`costCaptureMode.ts:12-25`) | Legacy-Fallback für Altsitzungen |
| `wizard.approvalAcknowledgedAt` | Session-JSONB | im Code als deprecated markiert (`salesWizardService.ts:129`), nur UI-Wiederaufnahme |

Es existiert genau eine aktive Wahrheit plus ein dokumentierter Legacy-Fallback. Doppelte Modus-States sind **nicht** die Ursache.

## 4.3 Zweiter unabhängiger Fehler: Dezimaleingabe unmöglich

Auch nach Behebung von 4.0 bleibt das manuelle Kostenfeld unbrauchbar.

```8:22:src/v2/advice/formatters.ts
export function centsToInput(cents: number | null): string {
  if (cents === null) {
    return '';
  }
  return String(cents / 100).replace('.', ',');
}

export function parseEuroToCents(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}
```

Das Feld ist vollständig kontrolliert – der angezeigte Wert wird aus dem Session-Zustand zurückgerechnet:

```77:83:src/v2/advice/steps/CostsStep.tsx
              value={centsToInput(session.manualInput.monthlyTotalCostsCents)}
              onChange={(event) => {
                const cents = parseEuroToCents(event.target.value);
                if (cents !== null || event.target.value.trim() === '') {
                  onPatchCosts(cents);
                }
              }}
```

Ablauf bei der Eingabe „12,50":

| Tastendruck | Eingabewert | `parseEuroToCents` | gespeicherte Cents | `centsToInput` zeigt |
|---|---|---|---|---|
| `1` | `1` | 100 | 100 | `1` |
| `2` | `12` | 1200 | 1200 | `12` |
| `,` | `12,` | `parseFloat("12.")` = 12 → **1200** | 1200 | **`12`** – das Komma verschwindet |
| `5` | `125` | 12500 | 12500 | `125` |
| `0` | `1250` | 125000 | 125000 | `1250` |

Ergebnis: statt 12,50 € werden **1.250,00 €** erfasst. Das Komma kann nie stehen bleiben, weil `centsToInput` es sofort wegnormalisiert. Dieselbe Mechanik gilt für jedes Eurofeld, das `centsToInput`/`parseEuroToCents` als kontrolliertes Paar nutzt.

Zusätzlich: `disabled={busy}` am Anbieterfeld (`CostsStep.tsx:126`) deaktiviert das Feld während jedes Serverumlaufs. Bei einem Umlauf pro Tastendruck verliert das Feld den Fokus – auch das erzeugt den Eindruck „Werte werden gelöscht".

### Race-Risiko ohne Entprellung

`patchManualInput` → `withPersist` → `updateNeed` liest die Sitzung serverseitig neu, mutiert sie und schreibt zurück; anschließend `setSession(updated)` ersetzt den gesamten lokalen Zustand (`useAdviceSession.ts:107-110`). Anders als `ensurePersisted` (Zeilen 69-80) und `patchProspect` (Zeilen 145-157) enthält `withPersist` **keine** Merge-Absicherung. Kommen zwei Umläufe außer der Reihe zurück, überschreibt die ältere Antwort den neueren Eingabewert. Bei einem Umlauf pro Tastendruck ist das der Normalfall, nicht die Ausnahme.

Verschärfend: `bestPayComparisonService.getSession` lädt für jeden Zugriff **alle** Sitzungen und filtert im Speicher (`bestPayComparisonService.ts:171`), und `SupabaseBestPayComparisonRepository.save` führt vor jedem Schreiben ein `getById` aus (Zeilen 62-68). Pro Tastendruck fallen damit mehrere vollständige Tabellenabrufe an.

## 4.4 Schritt „Bedarf" – Feld-für-Feld

| Fachliches Feld | aktuelle Erfassung | zweite Erfassung | führender State | DB-Ziel | Problem |
|---|---|---|---|---|---|
| Branche | `NeedStep.tsx:31-45` → `manualInput.industry` | `wizard.prospectDraft.industry` (Schema + Sync bei Leadanlage, `salesWizardService.ts:414-418,472`) | `manualInput.industry` | `best_pay_comparison_sessions.data`, bei Leadanlage auch `leads.data` | zwei Felder, ein fachlicher Wert; ProspectStep zeigt kein Branchenfeld, der Wert kann nur aus NeedStep kommen |
| Monatlicher Kartenumsatz | `NeedStep.tsx:46-58` → `manualInput.monthlyCardVolumeCents` | Abrechnungsimport-Baseline kann Umsatz liefern; `annualCardVolumeCents` als Alternative | `manualInput.monthlyCardVolumeCents` | Session-JSONB | drei mögliche Quellen (monatlich, jährlich, Baseline); Validierung akzeptiert jede (`salesWizardService.ts:326-336`) |
| Monatliche Transaktionen | `NeedStep.tsx:60-71` → `manualInput.monthlyTransactions` | – | dito | Session-JSONB | optional, keine Doppelung |
| Anzahl Terminals | `NeedStep.tsx:73-84` → `manualInput.terminalCount` | Kopie in `SalesWizardScenario.config` (`salesWizardService.ts:47-53`), Rückschreibung bei `selectScenarioVariant` (`820-825`) | `manualInput.terminalCount` | Session-JSONB | Szenario-Kopie kann von `manualInput` abweichen |
| Laufzeitpräferenz | `NeedStep.tsx:86-98` → `manualInput.preferredTermMonths` | ebenfalls in `Scenario.config` | `manualInput.preferredTermMonths` | Session-JSONB | wie Terminals |
| Zahlungsnutzung (4 Checkboxen) | `NeedStep.tsx:101-124` → `manualInput.paymentUsage.*` | ebenfalls in `Scenario.config` | `manualInput.paymentUsage` | Session-JSONB | wie Terminals |
| Ist-Kosten monatlich | `CostsStep.tsx:72-85` → `manualInput.monthlyTotalCostsCents` | `costBaselineId` → `customer_cost_baselines`; Baseline hat Vorrang (`comparisonSummary.ts:90-98`) | Baseline vor Manuell | Session-JSONB / `customer_cost_baselines` | zwei Wahrheiten mit stillem Vorrang der Baseline |
| Aktueller Anbieter | `CostsStep.tsx:121-128` → `wizard.prospectDraft.notes` | – | `prospectDraft.notes` | Session-JSONB | fachlicher Wert in einem Notizfeld |
| Firma/Kontakt/Telefon/E-Mail | `ProspectStep` → `wizard.prospectDraft.*` | nach Leadanlage in `leads` | `prospectDraft` bis Leadanlage, danach Lead | `leads` | zwei Wahrheiten nach Leadanlage, keine Rücksynchronisation |

`NeedStep.tsx:29` trägt den Hinweis „Einmalig erfassen – keine Doppelabfragen in späteren Schritten". Der `RecommendationStep` hat tatsächlich keine Konfigurations-UI. Die Doppelungen liegen also nicht zwischen Schritten, sondern zwischen **Domänenobjekten** (`manualInput` vs. `prospectDraft` vs. `Scenario.config` vs. Baseline).

## 4.5 Abrechnungseinlesen / OCR

### Einstieg und Kette

| Stufe | Ort |
|---|---|
| UI-Einstieg | Modusbutton „Abrechnung einlesen", `CostsStep.tsx:52` |
| Modus setzen + Session anlegen | `useAdviceSession.ts:211-224` → `updateCostCaptureMode`, danach `startBillingImport` **nur wenn** `next && !next.billingImportSessionId` (Zeile 215) |
| Service | `bestPayComparisonService.startBillingImport:457-480` → `billingImportService.getOrCreateFreeSession:227-268` |
| UI nachgeladen | `lazy(() => import('features/offer/OfferBillingImportSection'))`, `CostsStep.tsx:13-16`, gerendert nur bei vorhandener `session.billingImportSessionId` (Zeilen 90-104) |
| Platzhalter ohne Session-ID | „Abrechnungsimport wird vorbereitet…", `CostsStep.tsx:105-107` |
| Datei/Foto | `OfferBillingImportSection.handleFilesSelected:95-114` → `addFilesToSession:293-370` |
| OCR ausführen | `handleExtractAll:116-127` → `extractAllPendingDocuments` → `extractDocument:883-907` |
| Baseline bestätigen | `handleConfirmBaseline:225-240` → `confirmSessionBaseline:758-839` |
| Übernahme in Beratung | `onBaselineConfirmed` → `syncBaselineFromBilling:519-535` setzt `costBaselineId`, `costBaselineVersion` |

### Worker/API/Assets

| Aspekt | Befund |
|---|---|
| Server-OCR | **existiert nicht.** Kein Backend-Endpunkt, keine Edge Function (`list_edge_functions` = leer) |
| Ausführung | vollständig im Browser über Tesseract: `lazyBrowserOcrExtractionProvider.ts:42-61` → `browserOcrExtractionProvider.ts:47-54` |
| Assets | `ocr/worker/worker.min.js`, `ocr/core/`, `ocr/lang/*.traineddata.gz` (`billingOcrAssetPaths.ts:31-36`), zwingend Same-Origin (`assertSameOriginOcrAssetUrl:39-63`) |
| Live-Verfügbarkeit | **bestätigt**: `/ocr/worker/worker.min.js` HTTP 200, 111.162 Bytes; `/ocr/lang/deu.traineddata.gz` HTTP 200, 1.333.102 Bytes |
| APK-Verfügbarkeit | **bestätigt**: `android/app/src/main/assets/public/ocr/` enthält `core`, `lang` (`deu`, `eng`), `worker` |
| PDF | eingebetteter Text mit OCR-Fallback (`billingDocumentExtraction.ts:15-24`) |
| Dateiablage | `billingSessionFileStore.ts` – nur im Speicher der Browsersitzung |

### Warum „Abrechnung einlesen" keine Wirkung zeigt

| Kandidat | Bewertung |
|---|---|
| OCR-Assets fehlen | **ausgeschlossen** – live und in der APK vorhanden (HTTP 200, korrekte Größen) |
| Fehlende Berechtigung | **ausgeschlossen** für den Produktions-Admin: `canAccessCalculator` erlaubt `admin` und `field_service` (`bestPayComparisonService.ts:102-104`) |
| Server-OCR nicht erreichbar | **entfällt** – es gibt keinen Server-OCR |
| **Sitzung wird nie persistiert** | **bestätigte Ursache.** `setCostCaptureMode` läuft über `withPersist` → `ensurePersisted` → `persistWizardSession` → FK-Fehler (4.0). `updateCostCaptureMode` und `startBillingImport` werden nie erreicht, `billingImportSessionId` bleibt `null`, die Importoberfläche wird nie gerendert. |

Der einzige Beleg dafür, dass die Import-Mechanik grundsätzlich funktioniert, ist ein **manuell angelegter** Datensatz: `billing_import_sessions` enthält genau eine Zeile mit `id = billing_import_session_1a6ee9bc-…`, `lead_id = lead_test_p1b_smoke_20260802`, `offer_id = offer_test_p1b_smoke_20260802`, `status = created`, `documents = 0`. Sie gehört zum Testdatensatz vom 2026-08-03 13:57 UTC, nicht zu einer Nutzersitzung. Alle Folgetabellen (`billing_source_documents`, `billing_extracted_fields`, `billing_period_records`, `customer_cost_baselines`, `billing_cost_line_items`) sind **leer** – es wurde in Produktion noch nie ein Dokument verarbeitet.

### Weitere stille Abbruchbedingungen im Importpfad

| Bedingung | Wirkung | Beleg |
|---|---|---|
| `busy === true` | Modusbuttons nicht klickbar | `CostsStep.tsx:60` |
| `!session.billingImportSessionId` | nur Ladehinweis statt Import-UI | `CostsStep.tsx:105-107` |
| `getSessionData` liefert `null` | „Keine Berechtigung für den Abrechnungsimport." | `billingImportService.ts:842-846`, `OfferBillingImportSection.tsx:292-293` |
| `startBillingImport` → `forbidden` | keine Importsitzung, kein Hinweis | `bestPayComparisonService.ts:461-464` |
| OCR-Assets nicht ladbar | `BILLING_OCR_ASSET_UNAVAILABLE` | `lazyBrowserOcrExtractionProvider.ts:67-76` |
| `!view?.sessionId` beim Upload | Handler kehrt ohne Meldung zurück | `OfferBillingImportSection.tsx:96-97` |
| `canConfirm === false` | Button „Werte übernehmen" fehlt ohne Erklärung | `billingImportViews.ts:374-378`, `OfferBillingImportSection.tsx:511-517` |

### Isolierbarkeit von OCR

| Kriterium | Befund |
|---|---|
| Eigener Modus im Wizard | ja – `billing_import` ist einer von drei Modi, `manual` und `no_current_costs` funktionieren ohne ihn |
| Eigene Tabellen | ja – 6 Tabellen (`billing_*`, `customer_cost_baselines`), keine davon vom Kern zwingend benötigt |
| Kopplung an den Wizard | **eine** Kopplung: `session.costBaselineId` als Alternative zu `manualInput.monthlyTotalCostsCents` in `resolveCurrentMonthlyCosts` (`comparisonSummary.ts:90-98`) und in der `need`-Validierung (`salesWizardService.ts:326-336`) |
| UI-Kopplung | `CostsStep` lädt `OfferBillingImportSection` **lazy** (`CostsStep.tsx:13-16`) – die Legacy-Komponente ist damit bereits abgetrennt |
| Baseline hat Vorrang | ja – wenn eine Baseline existiert, überschreibt sie den manuellen Wert stillschweigend |

**Bewertung:** OCR ist als optionaler Helfer isolierbar. Es greift nur über ein einzelnes Feld (`costBaselineId`) in den Wizard ein und ist bereits per Lazy-Import getrennt. Das Deaktivieren des Modus `billing_import` beschädigt weder `manual` noch `no_current_costs` noch die Angebotserzeugung.

## 4.6 Persistenzübersicht Beratung

| Auslöser | Servicemethode | Supabase-Tabelle |
|---|---|---|
| erster Fortschritt | `persistWizardSession` (`152-162`) | `user_active_sessions` (**scheitert**), `best_pay_comparison_sessions` (nie erreicht) |
| Modus / Kosten / Bedarf | `updateCostCaptureMode`, `updateNeed` (`516-554`) | `best_pay_comparison_sessions` |
| Kontaktdaten | `updateProspectDraft` (`393-420`) | `best_pay_comparison_sessions` |
| Kunde zuweisen/anlegen | `assignLead`, `createLeadFromProspect` (`423-495`) | `best_pay_comparison_sessions`, `leads`, `sales_activities` |
| Abrechnung starten | `startBillingImport` (`498-513`) | `billing_import_sessions` |
| Schrittwechsel | `goNext`, `goBack`, `setStep` (`219-305`) | `best_pay_comparison_sessions` |
| Empfehlung | `calculateScenario` (`667-796`) | `best_pay_comparison_sessions`, `recommendation_records` |
| Variante wählen | `selectScenarioVariant` (`799-826`) | `best_pay_comparison_sessions` |
| Angebot erzeugen | `createOffer` (`829-854`) | `offers`, `offer_versions`, `best_pay_comparison_sessions` |
| Freigabe | `acknowledgeApproval` (`857-903`) | `offer_workflow_events`, `offer_versions` |
| Abschluss | `completeWizard` (`906-954`) | `best_pay_comparison_sessions` |

Da Stufe 1 scheitert, ist **keine** der folgenden Stufen in Produktion erreichbar.

## 4.7 Befundliste Beratung

| Nr. | Befund | Schwere |
|---|---|---|
| B1 | `persistWizardSession` schreibt `user_active_sessions` vor `best_pay_comparison_sessions` und verletzt damit `user_active_sessions_comparison_session_id_fkey`. Belegt durch 0 Zeilen in beiden Tabellen, dutzende FK-Fehler im Produktionslog (03.08. und 04.08.2026) und fehlende `advice_started`-Aktivitäten. | **blockierend** |
| B2 | Kein `.catch` in `ensurePersisted`/`withPersist`, alle UI-Aufrufe sind `void`. Fehler sind für den Nutzer unsichtbar. | **blockierend** |
| B3 | `centsToInput`/`parseEuroToCents` als kontrolliertes Paar machen Dezimaleingaben unmöglich; „12,50" wird zu 1.250,00 €. | **hoch** |
| B4 | Ein Serverumlauf pro Tastendruck, keine Entprellung, `withPersist` ohne Merge-Schutz → Race mit Wertüberschreibung. | **hoch** |
| B5 | `disabled={busy}` an Eingabefeld und Modusbuttons während jedes Umlaufs → Fokusverlust, „toter" Klick. | mittel |
| B6 | `getSession` lädt alle Sitzungen; `save` liest vor jedem Schreiben. Mehrere Volltabellenabrufe pro Tastendruck. | mittel |
| B7 | Vier Wahrheiten für Bedarfsfelder (`manualInput`, `prospectDraft`, `Scenario.config`, Cost-Baseline) mit stillem Vorrang der Baseline. | mittel |
| B8 | Fachlicher Wert „Aktueller Anbieter" liegt im Notizfeld `prospectDraft.notes`. | niedrig |
| B9 | Validierung für 0 € und Kostenmodus ist korrekt implementiert und getestet – hier besteht **kein** Reparaturbedarf. | Negativbefund |
| B10 | OCR-Assets sind live und in der APK vorhanden und ausliefernd – hier besteht **kein** Reparaturbedarf. | Negativbefund |

# Phase 2E – Testbaseline bereinigen

**Basis:** Phase 2D `356d71c`  
**Version:** unverändert `1.0.27`  
**Push / Release:** nein  

---

## Block A – Klassifikation der 6 Fails (vor Fix)

| # | Test | Klassifikation | Ursache |
|---|------|----------------|---------|
| 1 | `adviceDraftPersistence` – Vorwärtssprung | **Veraltete Erwartung** | Phase 1: `WizardNav` deaktiviert unreachable Steps (`disabled`), kein Fehlertext mehr |
| 2 | `salesWizardNavigationB01` – Vorwärtsnavigation | **Veraltete Erwartung** | Erwartete `/Bitte mit „Weiter“ fortfahren/` statt `disabled` + 3→1→3 |
| 3 | `salesWizardProspectStep` – Kunde erst mit Weiter | **Veraltete Erwartung** | `assignLead()` persistiert bei Kundenauswahl (Phase-1-Session-Wahrheit) |
| 4–6 | `commissionAssignmentRpc.remote` ×3 | **Remote-/Environment-Abhängigkeit** | Remote-DB ohne Phase-2D-Regel-IDs; Test lief in Standard-`vitest`-Suite wegen vorhandener Credentials |

Keine echte Produktregression in Wizard-Navigation oder `maxReachedStep`.

---

## Block B – Wizard-Fixes

- Tests erwarten **deaktivierte Schrittleiste** statt Fehlermeldung beim Vorwärtssprung.
- Navigationstest erweitert um **3→1→3** (zurück zu Kunde, erneut zu Ausgangslage).
- Kundentest: Session entsteht bei **Lead-Zuordnung**, kein Duplikat bei Weiter.
- Service-Regression weiterhin in `adviceNeedSessionPhase1.test.ts` (nicht dupliziert).

---

## Block C/D – Remote-RPC

- `**/*.remote.test.ts` aus Standard-`vitest.config.ts` ausgeschlossen.
- Neues Script: `npm run test:remote` (`vitest.remote.config.ts`).
- Remote-Tests prüfen Phase-2D-Regel-IDs auf Remote; **skip** wenn Migration fehlt (kein pauschales `it.skip`).

---

## Ergebnis

| Prüfung | Status |
|---------|--------|
| `npm test` (lokal, deterministisch) | **1122 passed**, 4 skipped |
| Remote-Suite (`npm run test:remote`) | separat, env-abhängig |
| TypeScript + Build | **grün** |
| Phase-2D-Kern (74) | unverändert grün |

**Baseline für Phase 3: grün.**

import { describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import {
  formatVariantComparisonLabel,
  hasMeaningfulCostCapture,
  resolveCostCaptureMode,
  validateCostCaptureStep,
} from '../domain/bestPayComparison/costCaptureMode';
import { DEFAULT_SALES_WIZARD_STATE } from '../domain/bestPayComparison/salesWizard';

function wizardSession(
  overrides: Partial<ReturnType<typeof createBestPayComparisonSession>> = {},
) {
  return createBestPayComparisonSession('user_001', {
    entryMode: 'wizard',
    wizard: {
      ...DEFAULT_SALES_WIZARD_STATE,
      enabled: true,
      prospectDraft: { ...DEFAULT_SALES_WIZARD_STATE.prospectDraft },
      scenarios: [],
    },
    ...overrides,
  });
}

describe('costCaptureMode', () => {
  it('blockiert ohne gewählten Modus', () => {
    const session = wizardSession();
    expect(validateCostCaptureStep(session)).toEqual({
      ok: false,
      message: 'Bitte wählen Sie, wie die aktuelle Situation berücksichtigt werden soll.',
    });
  });

  it('erlaubt manuell mit 0 €', () => {
    const session = wizardSession();
    session.wizard.costCaptureMode = 'manual';
    session.manualInput.monthlyTotalCostsCents = 0;
    expect(validateCostCaptureStep(session)).toEqual({ ok: true });
  });

  it('erlaubt keine aktuellen Kosten mit 0 €', () => {
    const session = wizardSession();
    session.wizard.costCaptureMode = 'no_current_costs';
    session.manualInput.monthlyTotalCostsCents = 0;
    expect(validateCostCaptureStep(session)).toEqual({ ok: true });
    expect(hasMeaningfulCostCapture(session)).toBe(true);
  });

  it('blockiert Import ohne bestätigte Baseline', () => {
    const session = wizardSession({
      billingImportSessionId: 'billing_001',
    });
    session.wizard.costCaptureMode = 'billing_import';
    expect(validateCostCaptureStep(session)).toEqual({
      ok: false,
      message: 'Bitte Abrechnung prüfen und Ist-Kosten bestätigen.',
    });
  });

  it('erlaubt Import mit bestätigter Baseline', () => {
    const session = wizardSession({
      billingImportSessionId: 'billing_001',
      costBaselineId: 'baseline_001',
    });
    session.wizard.costCaptureMode = 'billing_import';
    expect(validateCostCaptureStep(session)).toEqual({ ok: true });
  });

  it('leitet Modus aus Legacy-Daten ab', () => {
    const session = wizardSession({
      costBaselineId: 'baseline_001',
    });
    expect(resolveCostCaptureMode(session)).toBe('billing_import');

    const manual = wizardSession();
    manual.manualInput.monthlyTotalCostsCents = 120_00;
    expect(resolveCostCaptureMode(manual)).toBe('manual');
  });

  it('zeigt bei 0 € Ist-Kosten keinen Ersparnisvergleich', () => {
    const label = formatVariantComparisonLabel(
      {
        candidateId: 'c1',
        tariffId: 't1',
        tariffName: 'Tarif A',
        productId: null,
        productName: null,
        termMonths: 36,
        monthlyTotalCostsCents: 99_00,
        annualTotalCostsCents: 1188_00,
        oneTimeCostsCents: null,
        savingsMonthlyCents: -99_00,
        savingsAnnualCents: null,
        savingsPercent: null,
        isHigherCost: true,
        commissionTotalCents: null,
        score: 90,
        rank: 1,
        primaryReasons: [],
      },
      0,
    );
    expect(label).toContain('Neue monatliche Kosten');
    expect(label).toContain('Kein Vergleich mit bisherigen Kosten möglich');
    expect(label).not.toContain('Ersparnis');
  });
});

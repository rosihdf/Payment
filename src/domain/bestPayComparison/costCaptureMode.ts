import type { BestPayComparisonSession } from './bestPayComparisonSession';
import type { BestPayComparisonVariantSummary } from './bestPayComparisonSession';

export type CostCaptureMode = 'manual' | 'billing_import' | 'no_current_costs';

export const COST_CAPTURE_MODE_LABELS: Record<CostCaptureMode, string> = {
  manual: 'Kosten manuell eingeben',
  billing_import: 'Abrechnung einlesen',
  no_current_costs: 'Noch keine Payment-Lösung / aktuelle Kosten 0 €',
};

export function resolveCostCaptureMode(
  session: BestPayComparisonSession,
): CostCaptureMode | null {
  if (session.wizard.costCaptureMode) {
    return session.wizard.costCaptureMode;
  }
  if (session.costBaselineId || session.billingImportSessionId) {
    return 'billing_import';
  }
  if (session.manualInput.monthlyTotalCostsCents !== null) {
    return 'manual';
  }
  return null;
}

export function validateCostCaptureStep(
  session: BestPayComparisonSession,
): { ok: true } | { ok: false; message: string } {
  const mode = resolveCostCaptureMode(session);
  if (!mode) {
    return {
      ok: false,
      message: 'Bitte wählen Sie, wie die aktuelle Situation berücksichtigt werden soll.',
    };
  }

  switch (mode) {
    case 'manual':
      if (session.manualInput.monthlyTotalCostsCents === null) {
        return {
          ok: false,
          message: 'Bitte monatliche Ist-Kosten eingeben (0 € ist zulässig).',
        };
      }
      return { ok: true };
    case 'billing_import':
      if (!session.costBaselineId) {
        return {
          ok: false,
          message: 'Bitte Abrechnung prüfen und Ist-Kosten bestätigen.',
        };
      }
      return { ok: true };
    case 'no_current_costs':
      if (session.manualInput.monthlyTotalCostsCents !== 0) {
        return {
          ok: false,
          message: 'Aktuelle Kosten konnten nicht als 0 € bestätigt werden.',
        };
      }
      return { ok: true };
  }
}

export function hasMeaningfulCostCapture(session: BestPayComparisonSession): boolean {
  const mode = resolveCostCaptureMode(session);
  if (!mode) {
    return false;
  }
  if (mode === 'no_current_costs') {
    return session.manualInput.monthlyTotalCostsCents === 0;
  }
  if (mode === 'billing_import') {
    return Boolean(session.billingImportSessionId || session.costBaselineId);
  }
  return session.manualInput.monthlyTotalCostsCents !== null;
}

export function formatEuro(cents: number | null): string {
  if (cents === null) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatVariantComparisonLabel(
  variant: BestPayComparisonVariantSummary,
  currentMonthlyCostsCents: number | null,
): string {
  const monthly = formatEuro(variant.monthlyTotalCostsCents);
  if (currentMonthlyCostsCents === 0) {
    return `Neue monatliche Kosten ${monthly} · Kein Vergleich mit bisherigen Kosten möglich`;
  }
  return `BestPay ${monthly} / Monat · Ersparnis ${formatEuro(variant.savingsMonthlyCents)}`;
}

export function formatCurrentCostsLabel(currentMonthlyCostsCents: number | null): string {
  if (currentMonthlyCostsCents === 0) {
    return 'Keine bisherigen Kosten (0 €)';
  }
  return formatEuro(currentMonthlyCostsCents);
}

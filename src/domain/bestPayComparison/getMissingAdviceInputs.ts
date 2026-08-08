import type { CustomerCostBaseline } from '../billingImport/customerCostBaseline';
import { assessNeedCompleteness } from '../recommendation/customerNeed';
import type { BestPayComparisonSession, BestPayManualInput } from './bestPayComparisonSession';
import { buildCustomerNeedForComparison } from './buildCustomerNeedForComparison';

export type AdviceInputSeverity = 'error' | 'warning';

export interface MissingAdviceInput {
  field: string;
  label: string;
  severity: AdviceInputSeverity;
}

const FIELD_LABELS: Record<string, string> = {
  monthlyCardVolumeCents: 'Monatsumsatz',
  terminalCount: 'Terminalanzahl',
  paymentUsage: 'Einsatzart',
  cardMix: 'Kartenmix',
  cardMixSumImplausible: 'Kartenmix (Summe)',
  monthlyTransactionsMissing: 'Transaktionsanzahl',
  preferredTermMonths: 'Vertragslaufzeit',
};

function cardMixFieldMissing(input: BestPayManualInput): boolean {
  const parts = [
    input.girocardPercent,
    input.debitPercent,
    input.creditPercent,
    input.otherPercent,
  ];
  if (parts.every((value) => value === null)) {
    return true;
  }
  return parts.some((value) => value === null);
}

export function getMissingAdviceInputs(input: {
  manualInput: BestPayManualInput;
  baseline?: CustomerCostBaseline | null;
  leadId?: string | null;
  salesRepresentativeId?: string;
}): MissingAdviceInput[] {
  const need = buildCustomerNeedForComparison({
    manualInput: input.manualInput,
    baseline: input.baseline ?? null,
    salesRepresentativeId: input.salesRepresentativeId ?? 'system',
    leadId: input.leadId ?? null,
  });
  const status = assessNeedCompleteness(need);
  const missing: MissingAdviceInput[] = [];

  for (const field of status.missingFields) {
    missing.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      severity: 'error',
    });
  }

  if (cardMixFieldMissing(input.manualInput)) {
    if (!missing.some((entry) => entry.field === 'cardMix')) {
      missing.push({
        field: 'cardMix',
        label: FIELD_LABELS.cardMix ?? 'Kartenmix',
        severity: 'warning',
      });
    }
  } else if (!need.cardMix.isComplete) {
    missing.push({
      field: 'cardMix',
      label: FIELD_LABELS.cardMix ?? 'Kartenmix',
      severity: 'warning',
    });
  }

  for (const warning of status.warnings) {
    if (warning === 'cardMixIncomplete' && missing.some((entry) => entry.field === 'cardMix')) {
      continue;
    }
    missing.push({
      field: warning,
      label: FIELD_LABELS[warning] ?? warning,
      severity: 'warning',
    });
  }

  if (
    input.manualInput.preferredTermMonths === null ||
    input.manualInput.preferredTermMonths === 0
  ) {
    missing.push({
      field: 'preferredTermMonths',
      label: FIELD_LABELS.preferredTermMonths ?? 'Vertragslaufzeit',
      severity: 'warning',
    });
  }

  return missing;
}

export function getMissingAdviceInputsFromSession(
  session: BestPayComparisonSession,
  baseline?: CustomerCostBaseline | null,
): MissingAdviceInput[] {
  return getMissingAdviceInputs({
    manualInput: session.manualInput,
    baseline,
    leadId: session.leadId,
    salesRepresentativeId: session.createdByUserId,
  });
}

export function getBlockingNeedValidationMessage(
  session: BestPayComparisonSession,
  baseline?: CustomerCostBaseline | null,
): string | null {
  const hasVolume =
    session.manualInput.monthlyCardVolumeCents !== null ||
    session.manualInput.annualCardVolumeCents !== null ||
    Boolean(baseline) ||
    Boolean(session.costBaselineId);
  if (!hasVolume) {
    return 'Bitte Umsatz oder bestätigte Kostenbasis erfassen.';
  }

  const missing = getMissingAdviceInputsFromSession(session, baseline);
  const blocking = missing.find((entry) => entry.severity === 'error');
  return blocking ? `${blocking.label} fehlt.` : null;
}
